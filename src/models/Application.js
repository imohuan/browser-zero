const CanvasManager = require('./CanvasManager');
const NodeManager = require('./NodeManager');
const SettingsManager = require('./SettingsManager');

/**
 * 应用主类
 */
class Application {
  /**
   * 构造函数
   * @param {HTMLCanvasElement} canvas - 画布元素
   */
  constructor(canvas) {
    this.canvasManager = new CanvasManager(canvas);
    this.nodeManager = new NodeManager(this.canvasManager);
    this.settingsManager = new SettingsManager();
    // 工具栏状态
    this.toolbarState = { currentTool: 'hand', isCollapsed: false };
    // 会话选择器状态
    this.sessionSelector = { isOpen: false, nodeId: null, x: 0, y: 0 };
    // URL输入框状态
    this.urlInput = { isOpen: false, nodeId: null, url: '' };
    // 通知回调
    this.notifyCallback = null;
    // 复制的数据
    this.corpyData = null
    // 设置键盘事件
    this.setupKeyboardEvents();
  }

  /**
   * 初始化应用
   */
  async initialize() {
    try {
      // 加载设置
      await this.settingsManager.loadSettings();
      // 加载画布状态
      await this.nodeManager.loadCanvasState();
      // 设置默认工具
      this.switchTool('operation');
    } catch (error) {
      console.error('初始化失败:', error);
      this.showNotification('初始化应用失败，请重试', 'error');
    }
  }

  /**
   * 设置键盘事件
   */
  setupKeyboardEvents() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Z: 撤销
      if (e.ctrlKey && e.key === 'z') {
        this.nodeManager.undo();
      }

      // Ctrl+Y: 重做
      if (e.ctrlKey && e.key === 'y') {
        this.nodeManager.redo();
      }

      // Ctrl+S: 保存
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.nodeManager.saveCanvasState();
        // this.showNotification('已保存画布状态', 'success');
      }

      if (e.ctrlKey && e.key === "c" && document.activeElement.tagName !== "INPUT" && this.nodeManager.selectedNode) {
        e.preventDefault()
        this.copyData = JSON.parse(JSON.stringify(this.nodeManager.nodes.get(this.nodeManager.selectedNode)))
        delete this.copyData.x
        delete this.copyData.y
        this.showNotification("复制成功")
      }


      if (e.ctrlKey && e.key === "v" && document.activeElement.tagName !== "INPUT" && this.copyData) {
        e.preventDefault()
        const mousePos = this.canvasManager.mousePos
        const id = this.nodeManager.addNode(mousePos.x, mousePos.y, this.copyData)
        this.nodeManager.createWebContentsView(id)
        this.nodeManager.saveToHistory()
      }


      // Delete: 删除选中的节点
      if (e.key === 'Delete') {
        const selectedNode = this.nodeManager.selectedNode;
        if (selectedNode) {
          this.nodeManager.closeNode(selectedNode);
        }
      }

      // Escape: 关闭URL输入框和会话选择器
      if (e.key === 'Escape') {
        this.closeAllPopups();
      }
    });
  }

  /**
   * 关闭所有弹出窗口
   */
  closeAllPopups() {
    if (this.urlInput.isOpen) {
      this.urlInput.isOpen = false;
      this.urlInput.nodeId = null;
      this.urlInput.url = '';
    }

    if (this.sessionSelector.isOpen) {
      this.sessionSelector.isOpen = false;
      this.sessionSelector.nodeId = null;
    }
  }

  /**
   * 切换工具
   * @param {string} toolName - 工具名称
   */
  switchTool(toolName) {
    if (toolName !== 'hand' && toolName !== 'operation') {
      return;
    }
    this.toolbarState.currentTool = toolName;
    // 更新鼠标样式
    if (toolName === 'hand') {
      this.canvasManager.canvas.style.cursor = 'grab';
    } else {
      this.canvasManager.canvas.style.cursor = 'default';
    }
    // 关闭所有弹出窗口
    this.closeAllPopups();
  }

  /**
   * 切换侧边栏
   */
  toggleSidebar() {
    this.toolbarState.isCollapsed = !this.toolbarState.isCollapsed;
  }

  /**
   * 添加节点
   * @param {number} x - 屏幕坐标X
   * @param {number} y - 屏幕坐标Y
   */
  addNode(x, y, option = {}) {
    // 从屏幕坐标转换为画布坐标
    const canvasPos = this.canvasManager.screenToCanvas(x, y);
    // 创建节点并显示URL输入框
    const nodeId = this.nodeManager.addNode(canvasPos.x, canvasPos.y, option);
    return nodeId;
  }

  /**
   * 创建会话选择器
   * @param {string} nodeId - 节点ID
   * @param {number} x - 屏幕坐标X
   * @param {number} y - 屏幕坐标Y
   */
  createSessionSelector(nodeId, x, y) {
    // 关闭其他弹出窗口
    this.closeAllPopups();

    if (!this.nodeManager.nodes.has(nodeId)) {
      return;
    }

    // 设置会话选择器状态
    this.sessionSelector = {
      isOpen: true,
      nodeId: nodeId,
      x: x,
      y: y
    };

    // 创建会话选择器元素
    const selectorContainer = document.createElement('div');
    selectorContainer.className = 'session-selector-container';
    selectorContainer.style.position = 'absolute';
    selectorContainer.style.zIndex = '1000';
    selectorContainer.style.left = `${x}px`;
    selectorContainer.style.top = `${y}px`;

    // 获取所有会话ID
    const sessionIds = this.settingsManager.getSessionIds();
    const node = this.nodeManager.nodes.get(nodeId);

    // 创建会话列表
    const sessionList = document.createElement('ul');
    sessionList.className = 'session-list';

    // 添加会话项
    sessionIds.forEach(sessionId => {
      const item = document.createElement('li');
      item.className = 'session-item';
      if (sessionId === node.sessionId) {
        item.classList.add('active');
      }

      item.textContent = sessionId;

      // 添加会话项点击事件
      item.addEventListener('click', () => {
        this.selectSession(nodeId, sessionId);
        selectorContainer.remove();
        this.sessionSelector.isOpen = false;
      });

      sessionList.appendChild(item);
    });

    // // 添加管理会话按钮
    // const manageButton = document.createElement('li');
    // manageButton.className = 'session-item manage-button';
    // manageButton.textContent = '管理会话...';

    // // 添加管理会话按钮点击事件
    // manageButton.addEventListener('click', () => {
    //   this.saveSettings();
    //   selectorContainer.remove();
    //   this.sessionSelector.isOpen = false;
    // });

    // sessionList.appendChild(manageButton);
    selectorContainer.appendChild(sessionList);

    // 添加会话选择器到DOM
    document.body.appendChild(selectorContainer);

    // 添加点击外部区域关闭会话选择器事件
    const handleClickOutside = (e) => {
      if (!selectorContainer.contains(e.target)) {
        selectorContainer.remove();
        this.sessionSelector.isOpen = false;
        document.removeEventListener('click', handleClickOutside);
      }
    };

    // 延迟添加事件，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  }

  /**
   * 选择会话
   * @param {string} nodeId - 节点ID
   * @param {string} sessionId - 会话ID
   */
  selectSession(nodeId, sessionId) {
    if (!this.nodeManager.nodes.has(nodeId)) return;
    const node = this.nodeManager.nodes.get(nodeId);
    // 更新节点会话ID
    this.nodeManager.setNodeSession(nodeId, sessionId);
    // 如果节点有URL，则创建webContents
    if (node.url) this.nodeManager.createWebContentsView(nodeId);
  }

  /**
   * 保存设置
   * @param {Object} newSettings - 新设置
   */
  async saveSettings(newSettings) {
    try {
      await this.settingsManager.saveSettings(newSettings);
      this.showNotification('设置已保存', 'success');
    } catch (error) {
      console.error('保存设置失败:', error);
      this.showNotification('保存设置失败', 'error');
    }
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {string} type - 通知类型
   */
  showNotification(message, type = 'info') {
    if (this.notifyCallback) {
      this.notifyCallback(message, type);
    }
  }

  /**
   * 设置通知回调
   * @param {Function} callback - 通知回调函数
   */
  setNotifyCallback(callback) {
    this.notifyCallback = callback;
  }

  showConfirm(title, formCreator, buttonTexts) {
    return new Promise((resolve, reject) => {
      // 创建遮罩层
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

      // 创建对话框容器
      const dialog = document.createElement('div');
      dialog.className = 'bg-white rounded-lg shadow-xl p-6 w-full max-w-md';

      // 创建消息元素
      const messageEl = document.createElement('div');
      messageEl.className = 'text-gray-800 mb-4';
      messageEl.textContent = title;

      // 创建输入区域
      const inputContainer = document.createElement('div');
      inputContainer.className = 'mb-6';


      const items = formCreator()
      items.forEach(item => inputContainer.appendChild(item))

      // 创建按钮容器
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'flex justify-end space-x-3';

      // 创建按钮
      buttonTexts.forEach((text, index) => {
        const button = document.createElement('button');
        button.className = `px-4 py-2 rounded-md ${index === buttonTexts.length - 1
          ? 'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          } transition-colors`;
        button.textContent = text;

        button.addEventListener('click', () => {
          if (index === buttonTexts.length - 1) {
            resolve(items);
          } else {
            reject(false);
          }
          document.body.removeChild(overlay);
        });

        buttonContainer.appendChild(button);
      });

      // 组装对话框
      dialog.appendChild(messageEl);
      dialog.appendChild(inputContainer);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);

      // 添加到DOM
      document.body.appendChild(overlay);

      // 自动聚焦输入框
      for (const item of items) {
        if (item.tagName === "INPUT") {
          item.focus()
          break
        }
      }
      // 按ESC键取消
      overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          reject(false);
          // reject(new Error('用户取消'));
          document.body.removeChild(overlay);
        }
      });
    });
  }
}

// 导出Application类
module.exports = Application; 