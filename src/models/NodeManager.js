// 引入Node模型
const Node = require('./Node');
const { ipcRenderer } = require('electron');

/**
 * 节点管理器类
 */
class NodeManager {
  /**
   * 构造函数
   * @param {CanvasManager} canvasManager - 画布管理器实例
   */
  constructor(canvasManager) {
    this.name = ""
    this.canvasManager = canvasManager;

    // 节点集合
    this.nodes = new Map();

    // 节点操作历史
    this.history = [];
    this.currentHistoryIndex = -1;

    // 选中的节点
    this.selectedNode = null;
    // 悬浮的节点
    this.hoverNode = null;

    // 调整大小状态
    this.resizing = false;
    this.resizeNodeId = null;
    this.resizeHandle = null;
    this.resizeStartX = 0;
    this.resizeStartY = 0;

    // 调整节点位置
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.dragNodeId = null;
    this.dragStartX = 0;
    this.dragStartY = 0;

    // 节点ID计数器
    this.nodeCounter = 0;

    // 标题栏高度
    this.titleHeight = 25;
    this.titleMargin = 8;

    // 监听来自主进程的事件
    this.setupListeners();
    this.canvasManager.onRedraw = this.drawNodes.bind(this)
  }

  /**
   * 设置事件监听器
   */
  setupListeners() {
    // 监听设置节点标题的事件
    ipcRenderer.on('set-node-title', (event, { nodeId, title }) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.title = title;
        this.canvasManager.redraw();
      }
    });
  }

  /**
   * 添加节点
   * @param {number} x - 节点的X坐标
   * @param {number} y - 节点的Y坐标
   * @param {object} options - 节点选项
   * @returns {string} 新节点的ID
   */
  addNode(x, y, options = {}) {
    const id = 'node_' + (++this.nodeCounter);
    const { defaultSessionId, sessionIds } = app.settingsManager.getSettings()
    const node = {
      x,
      y,
      width: 600,
      height: 400,
      url: '',
      title: '',
      sessionId: options?.sessionId && sessionIds.includes(options.sessionId) ? options.sessionId : defaultSessionId,
      ...options,
      id,
      selected: true,
      preview: "",
    };

    this.hoverNode = id
    this.nodes.set(id, node);
    // 保存操作历史
    this.saveToHistory();
    // 自动选中新节点
    this.selectNode(id);
    // 重绘画布
    this.canvasManager.redraw();
    return id;
  }

  /**
   * 选择节点
   * @param {string} nodeId - 节点ID
   */
  selectNode(nodeId) {
    // 取消之前选中的节点
    // if (this.selectedNode) {
    //   const prevNode = this.nodes.get(this.selectedNode);
    //   if (prevNode) {
    //     prevNode.selected = false;
    //   }
    // }
    for (const node of this.nodes.values()) {
      node.selected = false
    }

    // 选中新节点
    if (nodeId && this.nodes.has(nodeId)) {
      const node = this.nodes.get(nodeId);
      node.selected = true;
      this.selectedNode = nodeId;
      // 将选中的节点移到最前
      this.bringToFront(nodeId);
      this.viewBringToFront(nodeId)
    } else {
      this.selectedNode = null;
    }

    // 重绘画布
    this.canvasManager.redraw();
  }

  /**
   * 计算可见区域内的节点
   * @returns {Map<string, object>} 可见区域内的节点集合
   */
  calculateVisibleAreaNodes() {
    // 获取画布的可见区域范围
    const { width, height } = this.canvasManager.canvas;
    const { offsetX, offsetY, scale } = this.canvasManager;

    // 计算可见区域在画布坐标系中的边界
    const visibleLeft = -offsetX / scale;
    const visibleTop = -offsetY / scale;
    const visibleRight = (width - offsetX) / scale;
    const visibleBottom = (height - offsetY) / scale;

    // 创建一个新的Map来存储可见的节点
    const visibleNodes = new Map();

    // 遍历所有节点，检查是否在可见区域内
    this.nodes.forEach((node, nodeId) => {
      // 考虑节点标题栏的区域
      const nodeLeft = node.x;
      const nodeTop = node.y - this.titleHeight - this.titleMargin; // 包括标题栏
      const nodeRight = node.x + node.width;
      const nodeBottom = node.y + node.height;

      // 检查节点是否与可见区域相交
      if (
        nodeRight >= visibleLeft &&
        nodeLeft <= visibleRight &&
        nodeBottom >= visibleTop &&
        nodeTop <= visibleBottom
      ) {
        // 如果节点在可见区域内，添加到可见节点集合
        visibleNodes.set(nodeId, node);
      }
    });

    return visibleNodes;
  }

  checkClickNode(e, nodeId) {
    if (!this.nodes.has(nodeId)) return
    const canvasPos = this.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
    const canvasX = canvasPos.x
    const canvasY = canvasPos.y
    const nodeData = this.nodes.get(nodeId);
    const { x, y, width, height } = nodeData;

    // const isHovering = state.hoveringNode === nodeId;
    const isHovering = false
    const isSelected = nodeData.selected;
    const hasUrl = nodeData.url != null;
    const showTitle = isHovering || isSelected || hasUrl;

    // 首先检查是否点击了节点的logo（当标题栏可见时）
    if (showTitle) {
      // 检查Logo点击
      const logoX = x + 15;
      const logoY = y - this.titleHeight / 2 - this.titleMargin;
      const logoRadius = 5;
      const dx = canvasX - logoX;
      const dy = canvasY - logoY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= logoRadius) {
        // 转换为屏幕坐标
        const screenLogoPos = this.canvasManager.canvasToScreen(logoX, logoY);
        // 点击了Logo，显示会话选择器
        this.showSessionSelector(nodeId, screenLogoPos.x, screenLogoPos.y);
        return true;
      }

      // 检查标题栏区域
      if (
        canvasX >= x &&
        canvasX <= x + width &&
        canvasY >= y - this.titleHeight - this.titleMargin &&
        canvasY <= y - this.titleMargin
      ) {
        // 检查刷新按钮
        const btnSize = 16;
        const btnMargin = 4;
        const rightPadding = 0;
        const refreshBtnX = x + width - (btnSize + btnMargin) * 2 - rightPadding;
        const refreshBtnY = y - this.titleHeight - this.titleMargin + (this.titleHeight - btnSize) / 2;

        if (
          canvasX >= refreshBtnX &&
          canvasX <= refreshBtnX + btnSize &&
          canvasY >= refreshBtnY &&
          canvasY <= refreshBtnY + btnSize
        ) {
          // console.log("点击 refresh");
          this.refreshNode(nodeId);
          return true
        }

        // 检查关闭按钮
        const closeBtnX = x + width - btnSize - rightPadding;
        const closeBtnY = y - this.titleHeight - this.titleMargin + (this.titleHeight - btnSize) / 2;

        if (
          canvasX >= closeBtnX &&
          canvasX <= closeBtnX + btnSize &&
          canvasY >= closeBtnY &&
          canvasY <= closeBtnY + btnSize
        ) {
          // console.log("点击 close");
          this.closeNode(nodeId);
          return true
        }
        // console.log("点击 title");
        this.startDrag(nodeId, e.clientX, e.clientY);
        return true
      }
    }

    // 检查内容区域（用于拖动）
    if (
      canvasX >= x &&
      canvasX <= x + width &&
      canvasY >= y &&
      canvasY <= y + height
    ) {
      // 点击内容区域
      return true;
    }

    return false;
  }

  viewBringToFront(nodeId) {
    ipcRenderer.invoke("top-web-contents-view", { nodeId })
  }

  /**
   * 将节点移到最前
   * @param {string} nodeId - 节点ID
   */
  bringToFront(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    const node = this.nodes.get(nodeId);
    // 删除原节点
    this.nodes.delete(nodeId);
    // 重新添加到最后（最前面）
    this.nodes.set(nodeId, node);
  }

  /**
   * 移动节点
   * @param {string} nodeId - 节点ID
   * @param {number} x - 新的X坐标
   * @param {number} y - 新的Y坐标
   */
  moveNode(nodeId, x, y) {
    if (!this.nodes.has(nodeId)) return;

    const node = this.nodes.get(nodeId);
    node.x = x;
    node.y = y;

    // 重绘画布
    this.canvasManager.redraw();
  }

  /**
   * 调整节点大小
   * @param {string} nodeId - 节点ID
   * @param {string} handle - 调整控制点
   * @param {number} startX - 开始X坐标
   * @param {number} startY - 开始Y坐标
   */
  startResize(nodeId, handle, startX, startY) {
    if (!this.nodes.has(nodeId)) return;

    this.resizing = true;
    this.resizeNodeId = nodeId;
    this.resizeHandle = handle;
    this.resizeStartX = startX;
    this.resizeStartY = startY;

    // 将调整中的节点标记为选中
    this.selectNode(nodeId);
  }

  /**
   * 调整节点大小
   * @param {number} x - 当前X坐标
   * @param {number} y - 当前Y坐标
   */
  resizeNode(x, y) {
    if (!this.resizing || !this.resizeNodeId || !this.nodes.has(this.resizeNodeId)) return;

    const node = this.nodes.get(this.resizeNodeId);
    const deltaX = x - this.resizeStartX;
    const deltaY = y - this.resizeStartY;

    // 记录原始尺寸，用于判断缩放方向
    const originalWidth = node.width;
    const originalHeight = node.height;
    const originalX = node.x;
    const originalY = node.y;

    // 根据不同控制点调整大小
    switch (this.resizeHandle) {
      case 'nw': // 左上
        node.x += deltaX;
        node.y += deltaY;
        node.width -= deltaX;
        node.height -= deltaY;
        break;
      case 'ne': // 右上
        node.y += deltaY;
        node.width += deltaX;
        node.height -= deltaY;
        break;
      case 'sw': // 左下
        node.x += deltaX;
        node.width -= deltaX;
        node.height += deltaY;
        break;
      case 'se': // 右下
        node.width += deltaX;
        node.height += deltaY;
        break;
    }

    // 确保节点尺寸不小于最小值
    const minSize = 100;
    let xOffset = 0;
    let yOffset = 0;

    if (node.width < minSize) {
      if (this.resizeHandle.includes('w')) {
        xOffset = minSize - node.width;
        node.x -= xOffset;
      }
      node.width = minSize;
    }

    if (node.height < minSize) {
      if (this.resizeHandle.includes('n')) {
        yOffset = minSize - node.height;
        node.y -= yOffset;
      }
      node.height = minSize;
    }

    // 检测缩放方向
    const isWidthIncreasing =
      (this.resizeHandle.includes('e') && deltaX > 0) ||
      (this.resizeHandle.includes('w') && deltaX < 0);
    const isHeightIncreasing =
      (this.resizeHandle.includes('s') && deltaY > 0) ||
      (this.resizeHandle.includes('n') && deltaY < 0);

    // 只有当满足以下条件时才更新起始位置：
    // 1. 节点尺寸正在增加
    // 2. 节点尺寸大于最小值
    // 3. 或者虽然到达最小值，但鼠标方向改变为增加尺寸
    const shouldUpdateStartX =
      originalWidth > minSize ||
      node.width > minSize ||
      isWidthIncreasing;

    const shouldUpdateStartY =
      originalHeight > minSize ||
      node.height > minSize ||
      isHeightIncreasing;

    // 根据条件更新起始位置
    if (shouldUpdateStartX) {
      this.resizeStartX = x;
    }
    if (shouldUpdateStartY) {
      this.resizeStartY = y;
    }
    // 重绘画布
    this.canvasManager.redraw();
  }

  /**
   * 结束调整大小
   */
  endResize() {
    if (this.resizing) {
      this.resizing = false;
      // 保存操作历史
      this.saveToHistory();
    }
  }

  startDrag(nodeId, startX, startY) {
    if (!this.nodes.has(nodeId)) return;
    const { x, y } = this.nodes.get(nodeId);
    this.isDragging = true;
    this.startX = startX
    this.startY = startY;
    this.dragNodeId = nodeId;
    this.dragStartX = x
    this.dragStartY = y
  }

  drag(mouseX, mouseY) {
    if (!this.nodes.has(this.dragNodeId)) return;
    const nodeData = this.nodes.get(this.dragNodeId);
    const dx = mouseX - this.startX;
    const dy = mouseY - this.startY;
    nodeData.x = this.dragStartX + dx / this.canvasManager.scale;
    nodeData.y = this.dragStartY + dy / this.canvasManager.scale;
    this.canvasManager.redraw();
  }

  endDrag() {
    if (this.isDragging) {
      this.isDragging = false;
      this.saveToHistory();
    }
  }

  /**
   * 获取指定位置的节点
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @returns {string|null} 节点ID或null
   */
  getNodeAtPosition(x, y, padding = 0) {
    // 倒序遍历节点（从最前面的开始）
    const nodesArray = Array.from(this.nodes.entries()).reverse();
    for (const [nodeId, node] of nodesArray) {
      const rect = { x: node.x - padding, y: node.y - padding, width: node.width + padding * 2, height: node.height + padding * 2 }
      // 检查点是否在节点内
      if (this.isPointInNode(x, y, rect)) {
        return nodeId;
      }
      // 检查点是否在标题栏内
      if (this.isPointInNodeTitle(x, y, rect)) {
        return nodeId;
      }
    }
    return null;
  }

  /**
   * 判断点是否在节点内
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {object} rect - 节点对象
   * @returns {boolean} 是否在节点内
   */
  isPointInNode(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
      y >= rect.y && y <= rect.y + rect.height;
  }

  /**
   * 判断点是否在节点标题栏内
   * @param {number} x - X坐标
   * @param {number} y - Y坐标
   * @param {object} rect - 节点对象
   * @returns {boolean} 是否在标题栏内
   */
  isPointInNodeTitle(x, y, rect) {
    return x >= rect.x && x <= rect.x + rect.width &&
      y >= rect.y - this.titleHeight - this.titleMargin && y <= rect.y;
  }

  /**
   * 刷新节点
   * @param {string} nodeId - 节点ID
   */
  refreshNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    ipcRenderer.invoke('reload-web-contents-view', { nodeId });
  }

  /**
   * 关闭节点
   * @param {string} nodeId - 节点ID
   */
  closeNode(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    ipcRenderer.invoke('remove-web-contents-view', { nodeId });
    // 从节点集合中删除
    this.nodes.delete(nodeId);
    // 如果关闭的是当前选中的节点，清除选择状态
    if (this.selectedNode === nodeId) {
      this.selectedNode = null;
    }
    // 保存操作历史
    this.saveToHistory();
    // 重绘画布
    this.canvasManager.redraw();
  }

  /**
   * 设置节点URL
   * @param {string} nodeId - 节点ID
   * @param {string} url - URL
   */
  setNodeUrl(nodeId, url) {
    if (!this.nodes.has(nodeId)) return;

    const node = this.nodes.get(nodeId);
    node.url = url;

    // 保存操作历史
    this.saveToHistory();

    // 重绘画布
    this.canvasManager.redraw();
  }

  /**
   * 设置节点会话ID
   * @param {string} nodeId - 节点ID
   * @param {string} sessionId - 会话ID
   */
  setNodeSession(nodeId, sessionId) {
    if (!this.nodes.has(nodeId)) return;
    const node = this.nodes.get(nodeId);
    // 如果会话ID发生变化
    if (node.sessionId !== sessionId) {
      node.sessionId = sessionId;
      ipcRenderer.invoke("update-web-contents-view-session", {
        nodeId, nodeBounds: { x: node.x, y: node.y, width: node.width, height: node.height }, sessionId
      })
      // 保存操作历史
      this.saveToHistory();
      // 重绘画布
      this.canvasManager.redraw();
    }
  }


  /** 更新Web内容视图位置 */
  updateWebContentsView(nodeId, visible = false) {
    if (!this.nodes.has(nodeId)) return;
    const node = this.nodes.get(nodeId);
    const { x, y, width, height } = node;
    const { scale, offsetX, offsetY } = this.canvasManager
    let bounds = { x: 0, y: 0, width: 0, height: 0 }
    // 减少一次计算，只有当需要展示的时候才进行计算
    if (visible) {
      bounds = {
        x: Math.round(x * scale + offsetX),
        y: Math.round(y * scale + offsetY),
        width: Math.round(width * scale),
        height: Math.round(height * scale)
      };
    }
    const nodeBounds = { x, y, width, height }
    ipcRenderer.invoke('refresh-web-contents-view', { nodeId, bounds, nodeBounds, visible }).then(res => {
      node.content = !res.success ? "正在加载网页中..." : res?.content ?? null
    })
  }

  /**
   * 创建Web内容视图
   * @param {string} nodeId - 节点ID
   */
  createWebContentsView(nodeId) {
    if (!this.nodes.has(nodeId)) return;
    const node = this.nodes.get(nodeId);
    const webContentsLoading = node?.webContentsLoading
    // 已经在加载
    if (webContentsLoading) return
    // 如果URL为空或不合法，直接返回
    if (!node.url) return;
    const { x, y, width, height, url, sessionId } = node;
    const { scale, offsetX, offsetY } = this.canvasManager
    const bounds = {
      x: Math.round(x * scale + offsetX),
      y: Math.round(y * scale + offsetY),
      width: Math.round(width * scale),
      height: Math.round(height * scale)
    };
    const nodeBounds = { x, y, width, height }
    // 通知主进程创建Web内容视图
    node.webContentsLoading = true
    ipcRenderer.invoke('create-web-contents-view', {
      nodeId, url, sessionId, bounds, nodeBounds
    }).then(res => {
      if (res?.webContentsId) {
        node.webContentsId = res.webContentsId
        node.webContentsLoading = false
      }
    })
  }

  /**
 * 计算最佳的画布偏移量和缩放比例，以居中显示所有节点
 * @param {Array} nodes - 节点数组，每个节点包含 x, y, width, height 属性
 * @param {number} canvasWidth - 画布宽度
 * @param {number} canvasHeight - 画布高度
 * @param {number} padding - 边距（可选，默认为 20）
 * @returns {Object} 包含 offsetX, offsetY 和 scale 的对象
 */
  calculateOptimalViewport(padding = 20, nodes = []) {
    if (nodes.length === 0) {
      nodes = Array.from(this.nodes.entries()).map(([nodeId, node]) => ({ nodeId, ...node }))
    }

    const { width: canvasWidth, height: canvasHeight } = this.canvasManager.ctx.canvas
    if (!nodes || nodes.length === 0) {
      return { offsetX: 0, offsetY: 0, scale: 1 };
    }
    // 计算所有节点的边界
    let num = 99999
    let minX = num;
    let minY = num;
    let maxX = -num;
    let maxY = -num;
    nodes.forEach(node => {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    });

    // 计算节点组的宽度和高度
    const nodesWidth = maxX - minX + (padding * 2);
    const nodesHeight = maxY - minY + (padding * 2);
    // 计算最佳缩放比例
    const scaleX = canvasWidth / nodesWidth;
    const scaleY = canvasHeight / nodesHeight;
    const scale = Math.min(scaleX, scaleY);
    // 计算居中偏移量
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const offsetX = (canvasWidth / 2) - (centerX * scale);
    const offsetY = (canvasHeight / 2) - (centerY * scale);
    return { offsetX, offsetY, scale };
  }

  /** 节点位置调整 以更可读的方式放置每个节点 */
  arrange(direction = 'left', gap = 20, selectedNodes = []) {
    // 获取所有被选中的节点
    if (selectedNodes.length === 0) {
      selectedNodes = Array.from(this.nodes.entries())
        // .filter(([nodeId, node]) => node.selected)
        .map(([nodeId, node]) => ({ nodeId, ...node }));
    }

    // 如果没有选中的节点，直接返回
    if (selectedNodes.length === 0) return;
    // 最大迭代次数，防止无限循环
    const maxIterations = 10;
    // 标记是否所有节点位置都稳定了
    let isStable = false;
    // 当前迭代次数
    let iteration = 0;

    // 创建节点位置映射，用于跟踪节点位置变化
    const nodePositions = new Map();
    selectedNodes.forEach(node => {
      nodePositions.set(node.nodeId, { x: node.x, y: node.y });
    });

    while (!isStable && iteration < maxIterations) {
      // 默认假设本次迭代后所有节点都会稳定
      isStable = true;
      iteration++;

      // 更新节点数据（可能在上一次迭代中位置已经改变）
      for (let i = 0; i < selectedNodes.length; i++) {
        const nodeId = selectedNodes[i].nodeId;
        const node = this.nodes.get(nodeId);
        selectedNodes[i].x = node.x;
        selectedNodes[i].y = node.y;
        selectedNodes[i].width = node.width;
        selectedNodes[i].height = node.height;
      }

      // 根据方向对节点进行排序
      switch (direction) {
        case 'left':
          // 先按照x坐标从小到大排序
          selectedNodes.sort((a, b) => a.x - b.x);
          // 从左到右处理每个节点
          for (let i = 0; i < selectedNodes.length; i++) {
            const current = selectedNodes[i];
            let newX = 0; // 从最左侧开始

            // 检查当前节点是否与之前的节点重叠
            for (let j = 0; j < selectedNodes.length; j++) {
              // 跳过当前节点自身
              if (j === i) continue;

              const other = selectedNodes[j];
              // 检查是否在垂直方向上有重叠
              if (!(current.y + current.height <= other.y || current.y >= other.y + other.height)) {
                // 如果other节点在current节点左侧，考虑其位置
                if (other.x < current.x || (other.x === current.x && j < i)) {
                  // 有重叠，计算新的x位置
                  newX = Math.max(newX, other.x + other.width + gap);
                }
              }
            }

            // 更新节点位置
            const node = this.nodes.get(current.nodeId);
            const oldPosition = nodePositions.get(current.nodeId);

            // 如果位置有变化，更新节点并标记为不稳定
            if (node.x !== newX) {
              node.x = newX;
              current.x = newX; // 更新当前数组中的位置，以便后续节点计算
              isStable = false;
            }

            // 更新位置映射
            nodePositions.set(current.nodeId, { x: node.x, y: node.y });
          }
          break;

        case 'right':
          // 获取画布宽度或使用节点中最右侧的位置
          const maxX = Math.max(...selectedNodes.map(node => node.x + node.width));
          // 先按照x坐标从大到小排序
          selectedNodes.sort((a, b) => (b.x + b.width) - (a.x + a.width));
          // 从右到左处理每个节点
          for (let i = 0; i < selectedNodes.length; i++) {
            const current = selectedNodes[i];
            let newX = maxX - current.width; // 从最右侧开始

            // 检查当前节点是否与其他节点重叠
            for (let j = 0; j < selectedNodes.length; j++) {
              // 跳过当前节点自身
              if (j === i) continue;

              const other = selectedNodes[j];
              // 检查是否在垂直方向上有重叠
              if (!(current.y + current.height <= other.y || current.y >= other.y + other.height)) {
                // 如果other节点在current节点右侧，考虑其位置
                if ((other.x + other.width) > (current.x + current.width) ||
                  ((other.x + other.width) === (current.x + current.width) && j < i)) {
                  // 有重叠，计算新的x位置
                  newX = Math.min(newX, other.x - gap - current.width);
                }
              }
            }

            // 更新节点位置
            const node = this.nodes.get(current.nodeId);

            // 如果位置有变化，更新节点并标记为不稳定
            if (node.x !== newX) {
              node.x = newX;
              current.x = newX; // 更新当前数组中的位置，以便后续节点计算
              isStable = false;
            }

            // 更新位置映射
            nodePositions.set(current.nodeId, { x: node.x, y: node.y });
          }
          break;

        case 'top':
          // 先按照y坐标从小到大排序
          selectedNodes.sort((a, b) => a.y - b.y);
          // 从上到下处理每个节点
          for (let i = 0; i < selectedNodes.length; i++) {
            const current = selectedNodes[i];
            let newY = 0; // 从最顶部开始

            // 检查当前节点是否与其他节点重叠
            for (let j = 0; j < selectedNodes.length; j++) {
              // 跳过当前节点自身
              if (j === i) continue;

              const other = selectedNodes[j];
              // 检查是否在水平方向上有重叠
              if (!(current.x + current.width <= other.x || current.x >= other.x + other.width)) {
                // 如果other节点在current节点上方，考虑其位置
                if (other.y < current.y || (other.y === current.y && j < i)) {
                  // 有重叠，计算新的y位置
                  newY = Math.max(newY, other.y + other.height + gap);
                }
              }
            }

            // 更新节点位置
            const node = this.nodes.get(current.nodeId);

            // 如果位置有变化，更新节点并标记为不稳定
            if (node.y !== newY) {
              node.y = newY;
              current.y = newY; // 更新当前数组中的位置，以便后续节点计算
              isStable = false;
            }

            // 更新位置映射
            nodePositions.set(current.nodeId, { x: node.x, y: node.y });
          }
          break;

        case 'bottom':
          // 获取画布高度或使用节点中最底部的位置
          const maxY = Math.max(...selectedNodes.map(node => node.y + node.height));
          // 先按照y坐标从大到小排序
          selectedNodes.sort((a, b) => (b.y + b.height) - (a.y + a.height));
          // 从下到上处理每个节点
          for (let i = 0; i < selectedNodes.length; i++) {
            const current = selectedNodes[i];
            let newY = maxY - current.height; // 从最底部开始

            // 检查当前节点是否与其他节点重叠
            for (let j = 0; j < selectedNodes.length; j++) {
              // 跳过当前节点自身
              if (j === i) continue;

              const other = selectedNodes[j];
              // 检查是否在水平方向上有重叠
              if (!(current.x + current.width <= other.x || current.x >= other.x + other.width)) {
                // 如果other节点在current节点下方，考虑其位置
                if ((other.y + other.height) > (current.y + current.height) ||
                  ((other.y + other.height) === (current.y + current.height) && j < i)) {
                  // 有重叠，计算新的y位置
                  newY = Math.min(newY, other.y - gap - current.height);
                }
              }
            }

            // 更新节点位置
            const node = this.nodes.get(current.nodeId);

            // 如果位置有变化，更新节点并标记为不稳定
            if (node.y !== newY) {
              node.y = newY;
              current.y = newY; // 更新当前数组中的位置，以便后续节点计算
              isStable = false;
            }

            // 更新位置映射
            nodePositions.set(current.nodeId, { x: node.x, y: node.y });
          }
          break;

        default:
          console.warn(`未支持的排序方向: ${direction}`);
          return;
      }

      // 如果所有节点位置稳定，或者达到最大迭代次数，则退出循环
      if (isStable || iteration >= maxIterations) {
        break;
      }
    }

    // 保存操作历史
    this.saveToHistory();
    // 重绘画布
    this.canvasManager.redraw();
  }

  /** 检测2个bounds是否重合 */
  isOverlapping(bounds1, bounds2) {
    // 检查矩形1的左边是否在矩形2的右边之左
    // 且矩形1的右边是否在矩形2的左边之右
    // 且矩形1的顶部是否在矩形2的底部之上
    // 且矩形1的底部是否在矩形2的顶部之下
    return bounds1.x < bounds2.x + bounds2.width &&
      bounds1.x + bounds1.width > bounds2.x &&
      bounds1.y < bounds2.y + bounds2.height &&
      bounds1.y + bounds1.height > bounds2.y;
  }

  clearHistory() {
    // 节点操作历史
    this.history = [];
    this.currentHistoryIndex = -1;
  }

  /**
   * 保存操作历史
   */
  saveToHistory() {
    // 如果当前不在历史末尾，裁剪掉后面的历史记录
    if (this.currentHistoryIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentHistoryIndex + 1);
    }

    const lastHistroy = this.history.length > 0 ? this.history[this.history.length - 1] : null
    // 将当前状态添加到历史记录中
    const currentState = JSON.stringify(this.getState())

    if (lastHistroy && currentState === lastHistroy) {
      // console.log("跳过", currentState);
      return
    }

    this.history.push(currentState);
    // 更新历史索引
    this.currentHistoryIndex = this.history.length - 1;

    // 限制历史记录数量，最多保留50条
    const maxHistoryLength = 50;
    if (this.history.length > maxHistoryLength) {
      this.history = this.history.slice(-maxHistoryLength);
      this.currentHistoryIndex = this.history.length - 1;
    }
  }

  /**
   * 从历史状态恢复节点
   * @param {Object} state - 状态对象
   * @returns {boolean} 是否成功恢复
   */
  async restoreFromState(stateStr) {
    try {
      const state = JSON.parse(stateStr)
      this.nodes.clear();
      // TODO：日后修复，这里代价太高需要修复
      await ipcRenderer.invoke('remove-web-contents-view-all')
      state.nodes.forEach(([nodeId, node]) => {
        this.nodes.set(nodeId, node);
      });

      // 更新节点计数器
      this.updateNodeCounter();
      // 清除选中状态
      this.selectedNode = null;
      // 重绘画布
      this.canvasManager.redraw();
      return true;
    } catch (error) {
      console.error('恢复状态失败:', error);
      return false;
    }
  }

  /**
   * 更新节点计数器
   */
  updateNodeCounter() {
    let maxCounter = 0;
    for (const [nodeId, nodeData] of this.nodes.entries()) {
      if (nodeId.startsWith('node_')) {
        const counter = parseInt(nodeId.substring(5));
        if (!isNaN(counter) && counter > maxCounter) maxCounter = counter;
      }
    }
    this.nodeCounter = maxCounter;
  }

  /**
   * 撤销操作
   * @returns {boolean} 是否成功撤销
   */
  undo() {
    if (this.currentHistoryIndex <= 0) return false;
    this.currentHistoryIndex--;
    const state = this.history[this.currentHistoryIndex];
    return this.restoreFromState(state);
  }

  /**
   * 重做操作
   * @returns {boolean} 是否成功重做
   */
  redo() {
    if (this.currentHistoryIndex >= this.history.length - 1) return false;
    this.currentHistoryIndex++;
    const state = this.history[this.currentHistoryIndex];
    return this.restoreFromState(state);
  }

  getState() {
    const state = {
      nodes: Array.from(this.nodes.entries()).map(([key, value]) => {
        const { previewImage, content, previewLoading, webContentsId, webContentsLoading, ...other } = value
        return [key, other]
      })
    };
    return state
  }

  /**
   * 保存画布状态
   */
  saveCanvasState() {
    if (!this.name?.trim()) {
      ipcRenderer.invoke("set-web-contents-view-visible", { status: false })
      app.showConfirm("请输入您的名称：", () => {
        const input = document.createElement("input")
        input.className = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
        input.type = "text"
        input.placeholder = "请输入您的名称"
        return [input]
      }, ["取消", "保存"]).then(([input]) => {
        const name = input.value.trim()
        if (name) {
          this.name = input.value.trim()
          this.saveCanvasState()
        } else {
          app.showNotification("请输入您的名称")
        }
      }).finally(() => {
        ipcRenderer.invoke("set-web-contents-view-visible", { status: true })
      })
      return
    }
    ipcRenderer.invoke('save-canvas-state', { name: this.name, state: this.getState() });
  }

  loadViews() {
    const visibleNodes = this.calculateVisibleAreaNodes();
    const nodeIds = Array.from(this.nodes.keys());
    nodeIds.forEach(nodeId => {
      if (visibleNodes.has(nodeId)) {
        this.createWebContentsView(nodeId)
      }
    });
  }

  /** 初始化节点 本地存储数据无效进行初始化 */
  initNode() {
    if (this.nodes.size === 0) {
      this.addNode(0, 0, { url: "https://www.baidu.com" })
    }
    const initialState = { nodes: Array.from(this.nodes.entries()) };
    this.history = [initialState];
    this.currentHistoryIndex = 0;
    // 加载视图
    this.loadViews()
    // 重绘画布
    this.canvasManager.redraw();
  }

  /**
   * 加载画布状态
   */
  async loadCanvasState(name = "") {
    await ipcRenderer.invoke('remove-web-contents-view-all')
    const { state } = await ipcRenderer.invoke('load-canvas-state', { name });
    if (state && state.nodes) {
      this.name = name !== "" ? name : "default"
      this.nodes.clear();
      for (const [nodeId, node] of state.nodes.entries()) {
        node.selected = false
        this.nodes.set(nodeId, node)
      }

      if (this.nodes.size === 0) {
        this.addNode(0, 0, { url: "https://www.baidu.com" })
      }

      // 更新节点计数器
      this.updateNodeCounter();
      // 清除选中状态
      this.selectedNode = null;
      // 添加初始状态到历史记录
      const initialState = { nodes: Array.from(this.nodes.entries()) };
      this.history = [initialState];
      this.currentHistoryIndex = 0;
      // 加载视图
      this.loadViews()
      // 重绘画布
      this.canvasManager.redraw();
      return true;
    } else {
      this.initNode()
    }
    return false;
  }


  drawNode(nodeId) {
    if (!this.nodes.has(nodeId)) return
    const ctx = this.canvasManager.ctx;
    const { scale, offsetX, offsetY, darkMode } = this.canvasManager;

    // ctx.save()
    // // 应用变换
    // ctx.translate(offsetX, offsetY);
    // ctx.scale(scale, scale);

    const mousePos = this.canvasManager.mousePos || { x: 0, y: 0 };
    const mouseX = mousePos.x;
    const mouseY = mousePos.y;
    const nodeData = this.nodes.get(nodeId);

    const { x, y, width, height, title, url, preview, content, previewImage, previewLoading, selected, sessionId } = nodeData;
    const isHovering = this.getNodeAtPosition(mouseX, mouseY) === nodeId;
    // console.log(isHovering)

    // 节点颜色 - 根据深色模式调整
    const nodeBackground = darkMode ? '#262839' : '#ffffff';
    const nodeStroke = selected || this.resizeNodeId === nodeId
      ? '#1e88e5'
      : darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    const emptyNodeBg = darkMode ? '#333345' : '#f0f0f0';
    const emptyNodeText = darkMode ? '#aaaaaa' : '#999999';
    const titleBarBg = darkMode ? '#323347' : '#eee';
    const logoColor = sessionId ? '#4a6fff' : darkMode ? '#aeb0b6' : '#8e9297';
    const titleTextColor = darkMode ? '#cccccc' : '#666';
    const buttonColor = darkMode ? '#aeb0b6' : '#8e9297';
    const buttonHoverColor = '#ffffff';
    const resizeHandleColor = 'rgba(255, 255, 255, 0.1)';

    // 绘制节点背景（内容区）
    ctx.fillStyle = nodeBackground;
    ctx.lineWidth = selected || this.resizeNodeId === nodeId ? 2 : 1;
    ctx.strokeStyle = nodeStroke;

    const p = app.settingsManager.getSettings().nodePadding;

    // 绘制节点主体
    ctx.beginPath();
    ctx.roundRect(x - p, y - p, width + p * 2, height + p * 2, 8);
    ctx.fill();
    ctx.stroke();

    // 如果节点没有URL，使用灰色填充表示空内容

    if (!url || content) {
      ctx.fillStyle = emptyNodeBg;
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 0);
      ctx.fill();

      // 显示提示文字在中央
      ctx.fillStyle = emptyNodeText;
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(content ?? '双击输入URL', x + width / 2, y + height / 2);
      ctx.textAlign = 'left'; // 恢复默认对齐
    } else if (preview) {
      if (!previewImage && !previewLoading) {
        const image = new Image();
        image.src = preview;
        nodeData.previewLoading = true
        image.onload = () => {
          nodeData.previewLoading = false
          nodeData.previewImage = image;
        }
      } else {
        try {
          ctx.drawImage(previewImage, x, y, width, height);
        } catch { }
      }
    }

    // 当输入框存在的时候, 标题栏显示
    const inputNodeId = document.getElementById("url-input")?.getAttribute("data-node-id")
    const selectNodeId = document.getElementById("session-selector")?.getAttribute("data-node-id")
    if (this.hoverNode === nodeId || inputNodeId === nodeId || selectNodeId === nodeId) {
      // 始终绘制标题栏
      // 绘制节点标题栏 - 显示在内容区上方
      ctx.fillStyle = titleBarBg;
      ctx.beginPath();
      ctx.roundRect(x - p, y - this.titleHeight - this.titleMargin, width + p * 2, this.titleHeight, 8);
      ctx.fill();

      // 绘制标题栏内容
      // 1. 绘制圆形LOGO
      ctx.fillStyle = logoColor;
      ctx.beginPath();
      ctx.arc(x + 15, y - this.titleHeight / 2 - this.titleMargin, 5, 0, 2 * Math.PI);
      ctx.fill();

      // 如果logo是当前鼠标hover位置，添加视觉提示
      const logoX = x + 15;
      const logoY = y - this.titleHeight / 2 - this.titleMargin;
      const logoRadius = 5;
      const isLogoHover = Math.sqrt(Math.pow(mouseX - logoX, 2) + Math.pow(mouseY - logoY, 2)) <= logoRadius;

      if (isLogoHover) {
        ctx.strokeStyle = buttonHoverColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(logoX, logoY, logoRadius + 1, 0, 2 * Math.PI);
        ctx.stroke();
      }

      // 如果有会话ID，在Logo后面显示一个小提示
      if (sessionId) {
        ctx.fillStyle = darkMode ? '#bbbbbb' : '#555';
        ctx.font = '800 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          sessionId.length > 5 ? sessionId.substring(0, 5) + '.' : sessionId.substring(0, 5),
          x + 24,
          y - this.titleHeight / 2 - this.titleMargin + 0.8
        );
      }

      // 2. 绘制标题文本
      ctx.fillStyle = titleTextColor;
      ctx.font = '550 8px Roboto, sans-serif';
      ctx.textBaseline = 'middle';

      // 显示URL或标题
      const displayTitle = url ? (title || url) : '双击输入URL';

      // 截断太长的标题
      let truncatedTitle = displayTitle;
      if (ctx.measureText(displayTitle).width > width - 100) {
        let i = displayTitle.length;
        while (i > 0 && ctx.measureText(displayTitle.substring(0, i) + '...').width > width - 100) {
          i--;
        }
        truncatedTitle = displayTitle.substring(0, i) + '...';
      }

      // 调整文本位置，根据是否有会话ID
      const textX = sessionId ? x + 55 : x + 30;
      ctx.fillText(truncatedTitle, textX, y - this.titleHeight / 2 - this.titleMargin + 0.9);

      // 3. 绘制控制按钮
      const btnSize = 16;
      const btnMargin = 4;
      const rightPadding = 0;

      // 刷新按钮
      const refreshBtnX = x + width - (btnSize + btnMargin) * 2 - rightPadding;
      const refreshBtnY = y - this.titleHeight - this.titleMargin + (this.titleHeight - btnSize) / 2;

      // 检查鼠标是否悬停在刷新按钮上
      const isRefreshHover =
        mouseX >= refreshBtnX &&
        mouseX <= refreshBtnX + btnSize &&
        mouseY >= refreshBtnY &&
        mouseY <= refreshBtnY + btnSize;

      if (isRefreshHover) {
        ctx.beginPath();
        ctx.fillStyle = buttonColor;
        ctx.roundRect(refreshBtnX - 2, refreshBtnY - 2, 20, 20, 2);
        ctx.fill();
      }

      // 绘制刷新按钮
      ctx.strokeStyle = isRefreshHover ? buttonHoverColor : buttonColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const refreshRadius = btnSize / 2 - 4;
      const centerX = refreshBtnX + btnSize / 2;
      const centerY = refreshBtnY + btnSize / 2;
      ctx.arc(centerX, centerY, refreshRadius, 0, 1.5 * Math.PI);
      ctx.stroke();

      // 绘制刷新箭头
      ctx.beginPath();
      ctx.fillStyle = isRefreshHover ? buttonHoverColor : buttonColor;
      // 箭头位于圆弧的左侧端点
      const arrowX = centerX + refreshRadius;
      const arrowY = centerY - refreshRadius;
      // 绘制箭头
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 3, arrowY - 3); // 箭头上部
      ctx.lineTo(arrowX - 3, arrowY + 3); // 箭头下部
      ctx.closePath();
      ctx.fill();

      // 关闭按钮
      const closeBtnX = x + width - btnSize - rightPadding;
      const closeBtnY = y - this.titleHeight - this.titleMargin + (this.titleHeight - btnSize) / 2;

      // 检查鼠标是否悬停在关闭按钮上
      const isCloseHover =
        mouseX >= closeBtnX &&
        mouseX <= closeBtnX + btnSize &&
        mouseY >= closeBtnY &&
        mouseY <= closeBtnY + btnSize;

      if (isCloseHover) {
        ctx.beginPath();
        ctx.fillStyle = buttonColor;
        ctx.roundRect(closeBtnX - 2, closeBtnY - 2, 20, 20, 2);
        ctx.fill();
      }

      // 绘制关闭按钮 (X)
      ctx.strokeStyle = isCloseHover ? buttonHoverColor : buttonColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const margin = 4;
      ctx.moveTo(closeBtnX + margin, closeBtnY + margin);
      ctx.lineTo(closeBtnX + btnSize - margin, closeBtnY + btnSize - margin);
      ctx.moveTo(closeBtnX + btnSize - margin, closeBtnY + margin);
      ctx.lineTo(closeBtnX + margin, closeBtnY + btnSize - margin);
      ctx.stroke();

      // 绘制调整大小的角落
      ctx.fillStyle = resizeHandleColor;
      ctx.beginPath();
      ctx.moveTo(x + width - 15, y + height);
      ctx.lineTo(x + width, y + height - 15);
      ctx.lineTo(x + width, y + height);
      ctx.fill();
    }

    // ctx.restore()
  }

  /**
   * 绘制节点
   */
  drawNodes() {
    // 只绘制可见区域内的节点，提高性能
    const visibleNodes = this.calculateVisibleAreaNodes();
    // 按照原节点顺序绘制可见节点，以保持正确的层叠顺序
    // 首先创建一个数组，包含所有节点的ID，按照它们在原始nodes中的顺序
    const nodeIds = Array.from(this.nodes.keys());
    // 然后按照原始顺序绘制可见的节点
    nodeIds.forEach(nodeId => {
      const nodeData = this.nodes.get(nodeId)
      const webContentsId = nodeData?.webContentsId
      if (visibleNodes.has(nodeId)) {
        if (!webContentsId) {
          // 不存在需要新建，因为开始的时候只创建了可视区域节点的WebContentsView
          this.createWebContentsView(nodeId)
        }
        this.drawNode(nodeId);
        if (nodeData.url) this.updateWebContentsView(nodeId, true)
      } else if (webContentsId) {
        // 将不可见的节点，已经创建了webContentsView的对象 修改数据
        this.updateWebContentsView(nodeId, false)
      }
    });
  }

  /** 节点加载网页截图 */
  async loadScreenshot(nodeId) {
    const node = this.nodes.get(nodeId);
    const result = await ipcRenderer.invoke("get-web-contents-view-data", { nodeId, needScreenshot: true })
    if (result && result.data && result.data.screenshot) {
      const image = new Image()
      const timestamp = new Date().getTime();
      image.src = `${result.data.screenshot}?t=${timestamp}`;
      image.onload = () => {
        node.previewImage = image
      }
      node.preview = result.data.screenshot
    }
  }

  clearPreview(nodeId) {
    if (!this.nodes.has(nodeId)) return
    const node = this.nodes.get(nodeId);
    delete node.preview
    delete node.previewImage
  }


  /**
   * 显示会话选择器
   * @param {string} nodeId - 节点ID
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   */
  async showSessionSelector(nodeId, x, y) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    await this.loadScreenshot(nodeId)
    await ipcRenderer.invoke("set-web-contents-view-visible", { status: false, nodeId })

    // 移除已存在的菜单
    const existingMenu = document.getElementById('session-selector');
    if (existingMenu) existingMenu.remove();

    // 创建会话选择器菜单
    const menuContainer = document.createElement('div');
    menuContainer.id = 'session-selector';
    menuContainer.setAttribute("data-node-id", nodeId)
    menuContainer.className = 'absolute z-[3000] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 min-w-[150px] max-h-[400px]';
    menuContainer.style.left = `${x}px`;
    menuContainer.style.top = `${y + 10}px`; // 在Logo下方显示

    const sessionIds = app.settingsManager.getSessionIds();
    // 创建菜单项
    sessionIds.forEach(sessionId => {
      const menuItem = document.createElement('div');
      menuItem.className = 'px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center';
      if (sessionId === node.sessionId) {
        menuItem.classList.add('bg-blue-50', 'dark:bg-blue-900', 'text-blue-600', 'dark:text-blue-300', 'font-medium');
      }
      menuItem.innerHTML = `
            <span class="flex-1">${sessionId}</span>
            ${sessionId === node.sessionId ? '<span class="ml-2 text-blue-600 dark:text-blue-300">✓</span>' : ''}
        `;
      menuItem.addEventListener('click', () => {
        this.clearPreview()
        this.setNodeSession(nodeId, sessionId);
        menuContainer.remove();
      });
      menuContainer.appendChild(menuItem);
    });

    // // 添加管理会话菜单项
    // const manageItem = document.createElement('div');
    // manageItem.className = 'px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-t border-gray-200 dark:border-gray-700 mt-1';
    // manageItem.textContent = '管理会话...';
    // manageItem.addEventListener('click', () => {
    //   // 直接使用自定义事件触发设置模态框显示
    //   menuContainer.remove();
    // });
    // menuContainer.appendChild(manageItem);

    // 添加到DOM
    document.body.appendChild(menuContainer);

    // 点击外部关闭菜单
    const handleClickOutside = (event) => {
      if (!menuContainer.contains(event.target)) {
        menuContainer.remove();
        this.clearPreview()
        document.removeEventListener('click', handleClickOutside);
        ipcRenderer.invoke("set-web-contents-view-visible", { status: true, nodeId })
      }
    };

    // 延迟添加事件，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
  }

  async reset() {
    await ipcRenderer.invoke('remove-web-contents-view-all')
    this.nodes.clear()
    this.clearHistory()
    this.name = ""
    // this.saveCanvasState()
    // await this.loadCanvasState();
    this.initNode()
  }
}

// 导出NodeManager类
module.exports = NodeManager; 