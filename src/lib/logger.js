const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const os = require('os');

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
 * 日志级别名称
 */
const LogLevelName = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.FATAL]: 'FATAL'
};

/**
 * 日志管理类
 */
class Logger {
  constructor(options = {}) {
    // 应用位置
    this.isDev = process.env.ELECTRON_IS_DEV ? Number.parseInt(process.env.ELECTRON_IS_DEV, 10) === 1 : !app.isPackaged;
    this.appPath = this.isDev ? path.dirname(path.dirname(__dirname)) : path.dirname(app.getPath('exe'));

    // 配置
    this.options = {
      logDir: path.join(this.appPath, 'logs'),
      logLevel: LogLevel.DEBUG,
      maxLogFileSizeBytes: 10 * 1024 * 1024, // 10MB
      maxLogFiles: 5,
      enableConsole: true,
      ...options
    };

    // 创建日志目录
    this.ensureLogDir();

    // 日志文件路径
    this.logFile = path.join(this.options.logDir, `app-${this.getDateString()}.log`);

    // 日志缓冲区
    this.logBuffer = [];
    this.lastFlushTime = Date.now();
    this.flushInterval = 1000; // 1秒刷新一次

    // 定期刷新日志
    this.flushIntervalId = setInterval(() => this.flush(), this.flushInterval);

    // 应用退出时刷新日志
    process.on('exit', () => {
      this.flush(true);
      clearInterval(this.flushIntervalId);
    });

    // 记录启动日志
    this.info('====== 应用启动 ======');
    this.info(`操作系统: ${os.platform()} ${os.release()}`);
    this.info(`Node版本: ${process.version}`);
    this.info(`Electron版本: ${process.versions.electron}`);
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    if (!fs.existsSync(this.options.logDir)) {
      fs.mkdirSync(this.options.logDir, { recursive: true });
    }

    // 清理旧日志
    this.cleanOldLogs();
  }

  /**
   * 清理旧日志文件
   */
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.options.logDir);
      const logFiles = files
        .filter(file => file.startsWith('app-') && file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.options.logDir, file),
          time: fs.statSync(path.join(this.options.logDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // 按修改时间倒序排序

      // 删除超出数量限制的旧日志
      if (logFiles.length > this.options.maxLogFiles) {
        logFiles.slice(this.options.maxLogFiles).forEach(file => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.error(`清理旧日志文件失败: ${file.path}`, e);
          }
        });
      }
    } catch (e) {
      console.error('清理旧日志文件失败', e);
    }
  }

  /**
   * 获取日期字符串 YYYY-MM-DD
   */
  getDateString() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取时间字符串 HH:mm:ss.SSS
   */
  getTimeString() {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
  }

  /**
   * 格式化日志消息
   */
  formatLogMessage(level, message, data = null) {
    const time = this.getTimeString();
    const levelName = LogLevelName[level];
    let formattedMessage = `[${time}] [${levelName}] ${message}`;

    if (data) {
      if (typeof data === 'object') {
        try {
          formattedMessage += ` ${JSON.stringify(data)}`;
        } catch (e) {
          formattedMessage += ` [无法序列化的对象: ${e.message}]`;
        }
      } else {
        formattedMessage += ` ${data}`;
      }
    }

    return formattedMessage;
  }

  /**
   * 记录日志
   */
  log(level, message, data = null) {
    if (level < this.options.logLevel) {
      return;
    }

    const formattedMessage = this.formatLogMessage(level, message, data);

    // 控制台输出
    if (this.options.enableConsole) {
      const consoleMethod = level <= LogLevel.INFO
        ? console.log
        : level === LogLevel.WARN
          ? console.warn
          : console.error;
      consoleMethod(formattedMessage);
    }

    // 添加到缓冲区
    this.logBuffer.push(formattedMessage);

    // 缓冲区满或间隔时间到，刷新到文件
    if (this.logBuffer.length >= 100 || Date.now() - this.lastFlushTime > this.flushInterval) {
      this.flush();
    }
  }

  /**
   * 刷新日志到文件
   */
  flush(force = false) {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      // 检查日志文件大小
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size >= this.options.maxLogFileSizeBytes) {
          // 创建新的日志文件
          const timestamp = new Date().getTime();
          const newLogFile = path.join(
            this.options.logDir,
            `app-${this.getDateString()}-${timestamp}.log`
          );
          this.logFile = newLogFile;

          // 清理旧日志
          this.cleanOldLogs();
        }
      }

      // 写入日志
      const logContent = this.logBuffer.join('\n') + '\n';
      fs.appendFileSync(this.logFile, logContent, 'utf8');

      // 清空缓冲区
      this.logBuffer = [];
      this.lastFlushTime = Date.now();
    } catch (e) {
      console.error('写入日志文件失败', e);

      // 如果是强制刷新但失败，尝试输出到控制台
      if (force && this.options.enableConsole) {
        console.error('最终日志刷新失败，输出剩余日志到控制台:');
        console.error(this.logBuffer.join('\n'));
      }
    }
  }

  /**
   * 获取最新的日志文件路径
   */
  getLatestLogFile() {
    return this.logFile;
  }

  /**
   * 打开日志文件
   */
  openLogFile() {
    try {
      const { shell } = require('electron');
      shell.openPath(this.logFile);
    } catch (e) {
      console.error('打开日志文件失败', e);
    }
  }

  // 便捷日志记录方法
  debug(message, data = null) {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message, data = null) {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message, data = null) {
    this.log(LogLevel.WARN, message, data);
  }

  error(message, data = null) {
    this.log(LogLevel.ERROR, message, data);
  }

  fatal(message, data = null) {
    this.log(LogLevel.FATAL, message, data);
  }
}

// 创建单例
let loggerInstance = null;

/**
 * 获取日志实例
 */
function getLogger(options = {}) {
  if (!loggerInstance) {
    loggerInstance = new Logger(options);
  }
  return loggerInstance;
}

module.exports = {
  LogLevel,
  getLogger
}; 