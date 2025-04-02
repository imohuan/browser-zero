// 应用设置管理器类
const { ipcRenderer } = require('electron');

class SettingsManager {
  /**
   * 创建设置管理器实例
   */
  constructor() {
    // 设置默认值
    this.defaultSettings = {
      defaultSessionId: 'default',
      sessionIds: ['default']
    };
    // 当前应用设置
    this.settings = { ...this.defaultSettings };
  }

  ensureSettings() {
    if (this.settings.sessionIds.length === 0) {
      this.settings.sessionIds = this.defaultSettings.sessionIds
      this.settings.defaultSessionId = this.defaultSettings.sessionIds[0]
    }
  }

  /**
   * 加载设置
   * @returns {Promise<Object>} 加载的设置
   */
  async loadSettings() {
    try {
      const result = await ipcRenderer.invoke('load-settings');
      if (result.success) {
        this.settings = {
          ...this.defaultSettings,
          ...result.settings
        };
        this.ensureSettings()
      } else {
        // 如果加载失败，使用默认设置
        this.settings = { ...this.defaultSettings };
      }

      return this.settings;
    } catch (error) {
      console.error('加载设置失败:', error);
      this.settings = { ...this.defaultSettings };
      return this.settings;
    }
  }

  /**
   * 保存设置
   * @param {Object} newSettings - 新的设置
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveSettings(newSettings) {
    try {
      // 合并默认设置和新设置
      this.settings = {
        ...this.defaultSettings,
        ...newSettings
      };

      // 清除空的Session ID
      if (Array.isArray(this.settings.sessionIds)) {
        this.settings.sessionIds = this.settings.sessionIds.filter(id => id && id.trim() !== '');

        // 确保至少有一个Session ID
        if (this.settings.sessionIds.length === 0) {
          this.settings.sessionIds = ['default'];
        }
      }

      // 保存到主进程
      const result = await ipcRenderer.invoke('save-settings', { settings: this.settings });
      return result.success;
    } catch (error) {
      console.error('保存设置失败:', error);
      return false;
    }
  }

  /**
   * 获取当前设置
   * @returns {Object} 当前设置
   */
  getSettings() {
    this.ensureSettings()
    return { ...this.settings };
  }

  /**
   * 获取会话ID列表
   * @returns {Array<string>} 会话ID列表
   */
  getSessionIds() {
    return [...this.getSettings().sessionIds];
  }

  /**
   * 获取默认会话ID
   * @returns {string} 默认会话ID
   */
  getDefaultSessionId() {
    return this.getSettings().sessionIds[0] || 'default';
  }

  /**
   * 重置设置为默认值
   * @returns {Promise<boolean>} 重置是否成功
   */
  async resetSettings() {
    this.settings = { ...this.defaultSettings };
    return await this.saveSettings(this.settings);
  }
}

// 导出SettingsManager类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsManager;
} 