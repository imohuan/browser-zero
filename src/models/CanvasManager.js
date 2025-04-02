/**
 * 画布管理器类
 */
class CanvasManager {
  /**
   * 构造函数
   * @param {HTMLCanvasElement} canvas - 画布元素
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // 画布变换状态
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    // 拖拽状态
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;

    // 视图变换状态
    this.isViewTransforming = false;

    // 鼠标位置跟踪
    this.mousePos = { x: 0, y: 0 };

    // 检测系统颜色方案
    this.darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 监听系统颜色方案变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        this.darkMode = e.matches;
        this.redraw();
      });
    }

    // 监听主题变化事件
    window.addEventListener('theme-changed', (e) => {
      this.darkMode = e.detail.isDarkMode;
      this.redraw();
    });

    // 初始化画布大小
    this.resizeToFit();
    // 监听窗口大小变化
    window.addEventListener('resize', this.resizeToFit.bind(this));
    // 跟踪鼠标移动
    this.canvas.addEventListener('mousemove', this.updateMousePosition.bind(this));
  }

  /**
   * 更新鼠标位置
   * @param {MouseEvent} e - 鼠标事件
   */
  updateMousePosition(e) {
    // 从屏幕坐标转换为画布坐标
    this.mousePos = this.screenToCanvas(e.offsetX, e.offsetY);
  }

  /**
   * 调整画布大小适应容器
   */
  resizeToFit() {
    const container = this.canvas.parentElement;
    if (!container) return;

    // 设置画布大小
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;

    // 重绘画布
    this.redraw();
  }

  /**
   * 开始拖动画布
   * @param {number} x - 开始拖动的X坐标
   * @param {number} y - 开始拖动的Y坐标
   */
  startDrag(x, y) {
    this.isDragging = true;
    this.lastX = x;
    this.lastY = y;
    // 更新光标样式
    this.canvas.classList.add('dragging');
  }

  /**
   * 拖动画布
   * @param {number} x - 当前X坐标
   * @param {number} y - 当前Y坐标
   */
  drag(x, y) {
    if (!this.isDragging) return;

    // 计算移动距离
    const deltaX = x - this.lastX;
    const deltaY = y - this.lastY;

    // 更新偏移量
    this.offsetX += deltaX;
    this.offsetY += deltaY;

    // 保存当前位置
    this.lastX = x;
    this.lastY = y;

    // 标记视图变换开始
    this.isViewTransforming = true;

    // 重绘画布
    this.redraw();
  }

  /**
   * 结束拖动画布
   */
  endDrag() {
    this.isDragging = false;

    // 恢复光标样式
    this.canvas.classList.remove('dragging');

    // 标记视图变换结束
    if (this.isViewTransforming) {
      this.isViewTransforming = false;
      this.onViewTransformEnd();
    }
  }

  /**
   * 缩放画布
   * @param {number} x - 鼠标X坐标
   * @param {number} y - 鼠标Y坐标
   * @param {number} factor - 缩放系数
   */
  zoom(x, y, factor) {
    // 计算鼠标在画布中的位置
    const canvasX = (x - this.offsetX) / this.scale;
    const canvasY = (y - this.offsetY) / this.scale;

    // 更新缩放比例
    const oldScale = this.scale;
    this.scale *= factor;

    // 限制缩放范围
    const minScale = 0.5;
    const maxScale = 5;
    this.scale = Math.max(minScale, Math.min(maxScale, this.scale));

    // 如果实际没有缩放，直接返回
    if (this.scale === oldScale) return;

    // 调整偏移量，使缩放以鼠标位置为中心
    this.offsetX = x - canvasX * this.scale;
    this.offsetY = y - canvasY * this.scale;

    // 标记视图变换开始
    this.isViewTransforming = true;

    // 重绘画布
    this.redraw();
  }

  /**
   * 重置视图
   */
  resetView() {
    // 重置变换参数
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    // 标记视图变换开始
    this.isViewTransforming = true;
    // 重绘画布
    this.redraw();
    // 标记视图变换结束
    this.isViewTransforming = false;
    this.onViewTransformEnd();
  }

  /**
   * 屏幕坐标转换为画布坐标
   * @param {number} x - 屏幕X坐标
   * @param {number} y - 屏幕Y坐标
   * @returns {Object} 画布坐标
   */
  screenToCanvas(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale
    };
  }

  /**
   * 画布坐标转换为屏幕坐标
   * @param {number} x - 画布X坐标
   * @param {number} y - 画布Y坐标
   * @returns {Object} 屏幕坐标
   */
  canvasToScreen(x, y) {
    return {
      x: x * this.scale + this.offsetX,
      y: y * this.scale + this.offsetY
    };
  }

  /**
   * 清空画布
   */
  clearCanvas() {
    // 首先清除整个画布
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // 填充背景色（根据深色模式调整）
    // this.ctx.fillStyle = this.darkMode ? '#2a2b3c' : '#f8f9fa';
    // this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * 绘制网格
   */
  drawGrid() {
    const { width, height } = this.canvas
    const ctx = this.ctx

    // 设置网格点的样式和大小
    const gridSize = 20; // 网格间距
    const gridColor = this.darkMode
      ? 'rgba(255, 255, 255, 0.05)' // 深色模式下的淡色点
      : 'rgba(0, 0, 0, 0.1)';        // 浅色模式下的深色点

    ctx.fillStyle = gridColor;

    // 计算可见区域的网格起止点
    const startX = Math.floor(-this.offsetX / this.scale / gridSize) * gridSize;
    const startY = Math.floor(-this.offsetY / this.scale / gridSize) * gridSize;
    const endX = Math.ceil((width - this.offsetX) / this.scale / gridSize) * gridSize;
    const endY = Math.ceil((height - this.offsetY) / this.scale / gridSize) * gridSize;

    // 绘制网格点
    for (let x = startX; x <= endX; x += gridSize) {
      for (let y = startY; y <= endY; y += gridSize) {
        // 将画布坐标转换为屏幕坐标
        const screenPos = this.canvasToScreen(x, y);

        // 绘制小圆点
        ctx.beginPath();
        ctx.arc(screenPos.x, screenPos.y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /**
   * 重绘画布
   */
  redraw() {
    // 清空画布
    this.clearCanvas();

    // 保存当前状态
    this.ctx.save();

    // 应用变换
    this.ctx.translate(this.offsetX, this.offsetY);
    this.ctx.scale(this.scale, this.scale);

    // 绘制网格
    this.drawGrid();
    // 委托外部进行节点绘制
    if (this.onRedraw) this.onRedraw();

    this.ctx.restore();
  }

  /**
   * 视图变换结束回调
   */
  onViewTransformEnd() {
    // 空实现，由外部覆盖
  }

  /**
   * 重绘回调
   */
  onRedraw() {
    // 空实现，由外部覆盖
  }
}

// 导出CanvasManager类
module.exports = CanvasManager; 