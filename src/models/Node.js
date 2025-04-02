// 节点数据模型类
class Node {
  /**
   * 创建一个新节点实例
   * @param {string} id - 节点唯一ID
   * @param {number} x - 节点X坐标
   * @param {number} y - 节点Y坐标
   * @param {number} width - 节点宽度
   * @param {number} height - 节点高度
   * @param {string} url - 节点URL
   * @param {string} title - 节点标题
   * @param {string} sessionId - 节点使用的会话ID
   */
  constructor(id, x, y, width = 320, height = 240, url = '', title = '新节点', sessionId = 'default') {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.url = url;
    this.title = title;
    this.sessionId = sessionId;
    this.isVisible = true;
    this.isSelected = false;
    this.screenshot = null;
  }

  /**
   * 从普通对象创建节点实例
   * @param {Object} obj - 包含节点数据的对象
   * @returns {Node} 新的节点实例
   */
  static fromObject(obj) {
    const node = new Node(
      obj.id,
      obj.x,
      obj.y,
      obj.width,
      obj.height,
      obj.url,
      obj.title,
      obj.sessionId
    );

    if (obj.isVisible !== undefined) node.isVisible = obj.isVisible;
    if (obj.isSelected !== undefined) node.isSelected = obj.isSelected;
    if (obj.screenshot !== undefined) node.screenshot = obj.screenshot;

    return node;
  }

  /**
   * 更新节点坐标
   * @param {number} x - 新的X坐标
   * @param {number} y - 新的Y坐标
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * 调整节点大小
   * @param {number} width - 新的宽度
   * @param {number} height - 新的高度
   */
  resize(width, height) {
    this.width = Math.max(width, 220); // 最小宽度
    this.height = Math.max(height, 160); // 最小高度
  }

  /**
   * 检查点是否在节点内部
   * @param {number} x - 点的X坐标
   * @param {number} y - 点的Y坐标
   * @param {number} titleHeight - 标题栏高度
   * @returns {boolean} 点是否在节点内部
   */
  containsPoint(x, y, titleHeight = 30) {
    // 包括标题栏的检查
    return (
      x >= this.x &&
      x <= this.x + this.width &&
      y >= this.y - titleHeight &&
      y <= this.y + this.height
    );
  }

  /**
   * 获取节点的边界框
   * @param {number} titleHeight - 标题栏高度
   * @returns {Object} 边界框对象
   */
  getBounds(titleHeight = 30) {
    return {
      x: this.x,
      y: this.y - titleHeight,
      width: this.width,
      height: this.height + titleHeight
    };
  }

  /**
   * 转换为可序列化的对象
   * @returns {Object} 可序列化的对象
   */
  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      url: this.url,
      title: this.title,
      sessionId: this.sessionId,
      isVisible: this.isVisible,
      isSelected: this.isSelected
    };
  }
}

// 导出Node类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Node;
} 