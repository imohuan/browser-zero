const { ipcRenderer } = require('electron');

/**
 * 日志级别
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

/**
 * 渲染进程的日志管理类
 */
class RendererLogger {
  constructor(options = {}) {
    this.options = {
      appName: '渲染进程',
      enableConsoleOverride: true,
      ...options
    };

    // 保存原始的console方法
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // 如果启用了console重写，替换console方法
    if (this.options.enableConsoleOverride) {
      this.overrideConsole();
    }

    // 记录初始化日志
    this.info('渲染进程日志系统初始化');
  }

  /**
   * 重写console对象的方法
   */
  overrideConsole() {
    console.log = (...args) => this.handleConsoleLog(LogLevel.INFO, 'log', ...args);
    console.info = (...args) => this.handleConsoleLog(LogLevel.INFO, 'info', ...args);
    console.warn = (...args) => this.handleConsoleLog(LogLevel.WARN, 'warn', ...args);
    console.error = (...args) => this.handleConsoleLog(LogLevel.ERROR, 'error', ...args);
    console.debug = (...args) => this.handleConsoleLog(LogLevel.DEBUG, 'debug', ...args);

    // 添加捕获全局错误的处理器
    window.addEventListener('error', (event) => {
      this.error('未捕获的错误', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : null
      });

      // 不阻止默认行为，允许错误继续传播
      return false;
    });

    // 添加捕获Promise错误的处理器
    window.addEventListener('unhandledrejection', (event) => {
      let detail = '未知Promise错误';
      if (event.reason) {
        if (typeof event.reason === 'string') {
          detail = event.reason;
        } else if (event.reason.message) {
          detail = event.reason.message;
        }
      }

      this.error('未处理的Promise拒绝', {
        reason: detail,
        stack: event.reason && event.reason.stack ? event.reason.stack : null
      });

      // 不阻止默认行为
      return false;
    });
  }

  /**
   * 处理console输出并发送到主进程
   */
  handleConsoleLog(level, methodName, ...args) {
    // 调用原始console方法
    this.originalConsole[methodName](...args);

    // 准备日志内容
    let message = '';
    let data = null;

    // 处理输入参数
    if (args.length === 0) {
      message = '';
    } else if (args.length === 1) {
      const arg = args[0];
      if (typeof arg === 'string') {
        message = arg;
      } else {
        message = 'Object:';
        data = this.safeStringify(arg);
      }
    } else {
      // 如果有多个参数，第一个作为消息，其余作为数据
      message = String(args[0]);

      // 处理格式化字符串，如console.log('Value: %s', 'test')
      if (typeof message === 'string' && message.includes('%')) {
        try {
          message = this.formatString(message, args.slice(1));
        } catch (e) {
          // 如果格式化失败，使用原始参数
          data = this.safeStringify(args.slice(1));
        }
      } else {
        data = this.safeStringify(args.slice(1));
      }
    }

    // 发送到主进程
    this.sendToMain(level, message, data);
  }

  /**
   * 格式化包含占位符的字符串
   */
  formatString(format, args) {
    return format.replace(/%([sdifjoO%])/g, (match, type, index) => {
      // 如果是%%，则返回%
      if (type === '%') {
        return '%';
      }

      // 获取对应的参数
      const arg = args[index];
      if (arg === undefined) {
        return match;
      }

      // 根据类型格式化
      switch (type) {
        case 's': // 字符串
          return String(arg);
        case 'd': // 整数
        case 'i': // 整数
          return parseInt(arg);
        case 'f': // 浮点数
          return parseFloat(arg);
        case 'j': // JSON
        case 'o': // 对象
        case 'O': // 对象
          return JSON.stringify(arg);
        default:
          return match;
      }
    });
  }

  /**
   * 安全地转换对象为字符串
   */
  safeStringify(obj) {
    try {
      return JSON.stringify(obj);
    } catch (e) {
      return '[无法序列化的对象]';
    }
  }

  /**
   * 发送日志到主进程
   */
  sendToMain(level, message, data = null) {
    try {
      ipcRenderer.send('log-message', {
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
        source: this.options.appName
      });
    } catch (e) {
      // 如果发送失败，使用原始console报错
      this.originalConsole.error('发送日志到主进程失败:', e);
    }
  }

  // 便捷日志方法
  debug(message, data = null) {
    this.sendToMain(LogLevel.DEBUG, message, data);
    this.originalConsole.debug(message, data);
  }

  info(message, data = null) {
    this.sendToMain(LogLevel.INFO, message, data);
    this.originalConsole.info(message, data);
  }

  warn(message, data = null) {
    this.sendToMain(LogLevel.WARN, message, data);
    this.originalConsole.warn(message, data);
  }

  error(message, data = null) {
    this.sendToMain(LogLevel.ERROR, message, data);
    this.originalConsole.error(message, data);
  }

  fatal(message, data = null) {
    this.sendToMain(LogLevel.FATAL, message, data);
    this.originalConsole.error('[FATAL]', message, data);
  }
}

// 创建单例
let rendererLoggerInstance = null;

/**
 * 获取渲染进程日志实例
 */
function getRendererLogger(options = {}) {
  if (!rendererLoggerInstance) {
    rendererLoggerInstance = new RendererLogger(options);
  }
  return rendererLoggerInstance;
}

module.exports = {
  LogLevel,
  getRendererLogger
}; 