const { app, session, BrowserWindow, WebContentsView, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater');
const { getLogger, LogLevel } = require('./lib/logger');

// 初始化日志系统
const logger = getLogger();

const isDev = 'ELECTRON_IS_DEV' in process.env ? Number.parseInt(process.env.ELECTRON_IS_DEV, 10) === 1 : !app.isPackaged;
const nodeViews = new Map()

// 根据环境设置缓存目录
const appPath = isDev ? __dirname : path.dirname(app.getPath('exe'))
const cacheDir = isDev ? path.join(appPath, '../.cache') : path.join(appPath, "cache")
const stateDir = path.join(cacheDir, 'state')
const projectDir = path.join(cacheDir, 'workspace')
const screenshotDir = path.join(cacheDir, 'screenshot')

ensureDir(cacheDir)
ensureDir(stateDir)
ensureDir(projectDir)
ensureDir(screenshotDir)
// 设置应用缓存目录
app.setPath('userData', cacheDir)

// if (isDev) {
//   Object.defineProperty(app, 'isPackaged', { get: () => true });
//   autoUpdater.updateConfigPath = path.join(appPath, 'update.yml');
// }

/** 确保地址存在 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

autoUpdater.on('update-available', () => {
  logger.info("有更新可用");
});

autoUpdater.on('update-downloaded', () => {
  // 给用户一个提示，然后重启应用；或者直接重启也可以，只是这样会显得很突兀
  logger.info("更新已下载，准备安装");
  dialog.showMessageBox({
    title: '安装更新',
    message: '更新下载完毕，应用将重启并进行安装'
  }).then(() => {
    // 退出并安装应用
    setImmediate(() => autoUpdater.quitAndInstall());
  });
});

// 添加用于记录从渲染进程发送的日志
ipcMain.on('log-message', (event, logData) => {
  const { level, message, data, source } = logData;
  const formattedMessage = source ? `[${source}] ${message}` : message;

  switch (level) {
    case LogLevel.DEBUG:
      logger.debug(formattedMessage, data);
      break;
    case LogLevel.INFO:
      logger.info(formattedMessage, data);
      break;
    case LogLevel.WARN:
      logger.warn(formattedMessage, data);
      break;
    case LogLevel.ERROR:
      logger.error(formattedMessage, data);
      break;
    case LogLevel.FATAL:
      logger.fatal(formattedMessage, data);
      break;
    default:
      logger.info(formattedMessage, data);
  }
});

// 获取最新日志
ipcMain.handle('get-latest-logs', async () => {
  try {
    const logFile = logger.getLatestLogFile();
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf8');
      const logs = content.split('\n').filter(line => line.trim() !== '');
      return { success: true, logs };
    } else {
      return { success: false, error: '日志文件不存在' };
    }
  } catch (error) {
    logger.error('读取日志文件失败', error);
    return { success: false, error: error.message };
  }
});

// 打开日志文件
ipcMain.handle('open-log-file', () => {
  try {
    logger.openLogFile();
    return { success: true };
  } catch (error) {
    logger.error('打开日志文件失败', error);
    return { success: false, error: error.message };
  }
});

// 创建崩溃日志窗口
function createCrashLogWindow(errorInfo) {
  logger.info('创建崩溃日志窗口', errorInfo);

  // 确保错误信息是有效的对象
  if (!errorInfo) {
    errorInfo = {
      type: 'unknown',
      message: '未知错误'
    };
  }

  // 如果错误是Error对象，提取其信息
  if (errorInfo instanceof Error) {
    errorInfo = {
      type: errorInfo.name || 'Error',
      message: errorInfo.message,
      stack: errorInfo.stack
    };
  }

  // 刷新日志，确保所有内容都被写入
  logger.flush(true);

  const crashWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载特殊的崩溃页面
  crashWindow.loadFile(path.join(__dirname, 'crash.html'));

  // 禁用崩溃页面的菜单
  crashWindow.setMenu(null);

  // 传递崩溃信息
  crashWindow.webContents.on('did-finish-load', () => {
    crashWindow.webContents.send('crash-info', {
      error: errorInfo,
      logFilePath: logger.getLatestLogFile()
    });
  });

  // 防止崩溃窗口关闭导致应用退出
  crashWindow.on('close', (e) => {
    // 如果是明确要求退出，则允许关闭
    if (app.isQuitting) {
      return;
    }

    // 否则只隐藏窗口
    e.preventDefault();
    crashWindow.hide();
  });

  return crashWindow;
}

async function createMainWindow() {
  logger.info('创建主窗口');
  autoUpdater.checkForUpdatesAndNotify();

  // 创建主窗口，无边框风格
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // 无边框
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true,
      // webSecurity: true  // 确保开启网页安全选项
    }
  })

  // 配置安全策略
  // mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
  //   callback({
  //     responseHeaders: {
  //       ...details.responseHeaders,
  //       'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'"]
  //     }
  //   })
  // });

  // 加载主页面
  mainWindow.loadFile(path.join(__dirname, 'index.html'))

  // 开发环境打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  // 监听渲染进程崩溃事件
  mainWindow.webContents.on('crashed', (event) => {
    const errorInfo = {
      type: 'renderer-crashed',
      message: '渲染进程崩溃'
    };

    logger.fatal('渲染进程崩溃', errorInfo);
    createCrashLogWindow(errorInfo);
  });

  // 监听渲染进程挂起事件
  mainWindow.webContents.on('unresponsive', () => {
    const errorInfo = {
      type: 'renderer-unresponsive',
      message: '渲染进程无响应'
    };

    logger.error('渲染进程无响应', errorInfo);
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '应用无响应',
      message: '应用似乎已经停止响应。',
      buttons: ['等待', '查看日志', '强制关闭'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 1) {
        // 查看日志
        logger.openLogFile();
      } else if (response === 2) {
        // 强制关闭
        app.exit(1);
      }
    });
  });

  // 监听渲染进程恢复响应
  mainWindow.webContents.on('responsive', () => {
    logger.info('渲染进程恢复响应');
  });

  // 添加窗口控制处理
  ipcMain.handle('minimize-window', () => {
    mainWindow.minimize()
    return { success: true }
  })

  ipcMain.handle('toggle-maximize-window', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
    return { success: true, isMaximized: mainWindow.isMaximized() }
  })

  // 添加最大化窗口的处理程序
  ipcMain.handle('maximize-window', () => {
    mainWindow.maximize()
    return { success: true }
  })

  // 添加关闭窗口的处理程序
  ipcMain.handle('close-window', () => {
    mainWindow.close()
    return { success: true }
  })

  // 监听窗口最大化/还原事件
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', false)
  })

  return mainWindow
}

function removeNodeView(win, nodeId) {
  if (!nodeViews.has(nodeId)) return
  const nodeViewData = nodeViews.get(nodeId)
  if (!nodeViewData.view) return
  if (nodeViewData.view?.webContents) nodeViewData.view.webContents.destroy()
  win.contentView.removeChildView(nodeViewData.view)
  delete nodeViewData.view
  nodeViews.delete(nodeId)
}


async function createWebContentsView(mainWindow, option) {
  const { nodeId, sessionId, url, bounds, nodeBounds, replaceView = false } = option
  // 检查节点是否已经存在
  if (nodeViews.has(nodeId)) {
    const nodeViewData = nodeViews.get(nodeId)
    if (replaceView) {
      removeNodeView(mainWindow, nodeId)
    } else {
      // 检查视图是否可见
      // TODO：这里会出现不到view
      try {
        await nodeViewData.view.webContents.loadURL(url)
        return nodeViewData.view.webContents.id
      } catch { }
    }
  }

  const customSession = session.fromPartition(`persist:${sessionId}`)
  // customSession.webRequest.onBeforeSendHeaders({ "urls": ["<all_urls>"] }, (details, callback) => {
  //   callback({ requestHeaders: details.requestHeaders })
  // })
  // console.log("使用Session:", sessionId);
  // 如果每个用户使用独立的 partition，缓存也会独立，可能导致重复下载资源。
  // 使用相同的 partition 字符串（如 persist:shared_cache）来共享缓存。 通过 session.setCacheDirectory 设置全局缓存路径，所有会话共享缓存。
  // const customSession = session.fromPartition(sessionId);
  // customSession.setCacheDirectory(sharedCacheSession.getCacheDirectory());
  const nodeViewData = { disableVisible: true }
  const nodeView = new WebContentsView({
    webPreferences: {
      session: customSession,
      nodeIntegration: false,
      contextIsolation: true,
      // 启用背景节流以减少不可见时的CPU占用
      backgroundThrottling: true,
      webSecurity: false,
      webgl: true,
      plugins: true,
    }
  })

  nodeView.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.82 Safari/537.36');
  nodeView.setVisible(false)
  nodeView.webContents.on("did-finish-load", () => {
    nodeViewData.disableVisible = false
    nodeView.setVisible(true)
    mainWindow.webContents.send("set-node-title", { title: nodeView.webContents.getTitle(), nodeId })
  })

  nodeView.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  nodeView.webContents.setWindowOpenHandler(({ url }) => {
    // console.log('尝试打开新窗口:', url);
    mainWindow.webContents.send("open-url", { nodeId, url })
    return { action: 'deny' };
  })
  // 将视图添加到主窗口
  mainWindow.contentView.addChildView(nodeView)
  // 设置视图的位置和大小
  nodeView.setBounds(bounds)
  // 修改滚动条样式，确保宽度为2px
  nodeView.webContents.insertCSS(`
    ::-webkit-scrollbar {
      width: 2px !important;
      height: 2px !important;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
      border-radius: 1px;
    }
    ::-webkit-scrollbar-thumb {
      background: #888;
      border-radius: 1px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #666;
    }
  `)
  // 设置页面的预期显示宽度为1000像素，无论实际宽度多少
  const targetWidth = nodeBounds.width * 2
  // 计算缩放因子 = 目标宽度 / 实际宽度
  const scaleFactor = targetWidth / bounds.width
  // 设置内容缩放以达到期望的显示效果
  nodeView.webContents.setZoomFactor(scaleFactor)
  nodeView.webContents.executeJavaScript(`document.body.style.width = '${targetWidth}px'`)
  // 设置缩放偏好
  nodeView.webContents.setVisualZoomLevelLimits(1, 1) // 禁用用户手动缩放
  try {
    // 初始化时立即检查可见性并处理
    await nodeView.webContents.loadURL(url)
  } catch (error) {
    console.error('Failed to load URL:', error);
    // 可以在这里添加重试逻辑或通知用户
  }
  // 存储视图和其缩放比例
  nodeViewData.view = nodeView
  nodeViewData.targetWidth = targetWidth
  nodeViews.set(nodeId, nodeViewData)
  return nodeView.webContents.id
}

app.whenReady().then(async () => {
  logger.info('应用准备就绪');

  // 设置全局异常处理
  setupGlobalErrorHandlers();

  const mainWindow = await createMainWindow()
  mainWindow.contentView.setBorderRadius(100)
  mainWindow.on('focus', () => {
    mainWindow.webContents.send("window-focus")
  })

  // 创建 WebContentsView
  ipcMain.handle('create-web-contents-view', async (event, { nodeId, url, bounds, nodeBounds, sessionId }) => {
    const option = { nodeId, sessionId, url, bounds, nodeBounds, replaceView: false }
    const webContentsId = await createWebContentsView(mainWindow, option)
    return { success: true, nodeId, webContentsId }
  })

  // 刷新 WebContentsView 状态
  ipcMain.handle('refresh-web-contents-view', async (event, { nodeId, bounds, nodeBounds, visible }) => {
    if (!nodeViews.has(nodeId)) return { success: false, error: 'Node view not found' }
    const nodeViewData = nodeViews.get(nodeId)
    if (nodeViewData.view?.webContents && nodeViewData.view.webContents.isDestroyed()) {
      return { success: false, error: 'Node view is destroyed' }
    }

    // // 限制渲染 正常为false 受限制为true
    // nodeViewData.view.webContents.setBackgroundThrottling(!visible)
    // if (nodeViewData.view.webContents.isLoading()) return { success: true, content: "页面加载中" }

    if (!nodeViewData.disableVisible)
      nodeViewData.view.setVisible(visible)

    if (visible) {
      // 刷新 位置  
      const nodeViewData = nodeViews.get(nodeId)
      nodeViewData.view.setBounds(bounds)

      // 刷新缩放
      const targetWidth = nodeBounds.width * 2
      const newScaleFactor = targetWidth / bounds.width
      if (nodeViewData.view?.webContents) {
        nodeViewData.view.webContents.setZoomFactor(1 / newScaleFactor)
        nodeViewData.view.webContents.executeJavaScript(`document.body.style.width = '${nodeBounds.width * 2}px'`)
      }
    }

    return { success: true }
  })

  // 顶置 WebContentsView
  ipcMain.handle('top-web-contents-view', async (event, { nodeId }) => {
    if (!nodeViews.has(nodeId)) return { success: false, error: 'Node view not found' }
    const nodeViewData = nodeViews.get(nodeId)
    mainWindow.contentView.removeChildView(nodeViewData.view)
    mainWindow.contentView.addChildView(nodeViewData.view)
    return { success: true }
  })

  // 刷新 WebContentsView
  ipcMain.handle('reload-web-contents-view', (event, { nodeId }) => {
    if (!nodeViews.has(nodeId)) return { success: false, error: 'Node view not found' }
    const nodeViewData = nodeViews.get(nodeId)
    nodeViewData.view.webContents.reload()
    return { success: true }
  })

  // 删除 WebContentsView
  ipcMain.handle('remove-web-contents-view', (event, { nodeId }) => {
    if (!nodeViews.has(nodeId)) return { success: false, error: 'Node view not found' }
    removeNodeView(mainWindow, nodeId)
    return { success: true }
  })

  // 删除所有节点
  ipcMain.handle('remove-web-contents-view-all', (event) => {
    let count = 0
    for (const [key, nodeViewData] of nodeViews) {
      if (nodeViewData) {
        removeNodeView(mainWindow, key)
        count++
      }
    }

    mainWindow.contentView.children.forEach(view => {
      view.webContents.destroy()
      mainWindow.contentView.removeChildView(view)
    })

    nodeViews.clear()
    return { success: true, data: count }
  })

  // 更新节点会话
  ipcMain.handle('update-web-contents-view-session', async (event, { nodeId, nodeBounds, sessionId }) => {
    if (!nodeViews.has(nodeId)) return { success: false, error: 'Node view not found' }
    const nodeViewData = nodeViews.get(nodeId)
    try {
      // 保存当前URL和视图位置
      const currentURL = nodeViewData.view.webContents.getURL();
      const bounds = nodeViewData.view.getBounds();
      const option = { nodeId, sessionId, url: currentURL, bounds, nodeBounds, replaceView: true }
      const webContentsId = await createWebContentsView(mainWindow, option)
      return { success: true, webContentsId };
    } catch (error) {
      console.error('更新会话失败:', error);
      return { success: false, error: error.message };
    }
  })

  // 获取数据
  ipcMain.handle('get-web-contents-view-data', async (event, { nodeId, needScreenshot }) => {
    if (!nodeViews.has(nodeId)) return { success: false, error: 'Node view not found' }
    const nodeViewData = nodeViews.get(nodeId)
    const webContents = nodeViewData.view.webContents
    const title = webContents.getTitle()
    const url = webContents.getURL();
    const data = { title, url }

    if (needScreenshot) {
      const image = await webContents.capturePage();
      const imagePath = path.join(screenshotDir, nodeId + ".jpg")
      fs.writeFileSync(imagePath, image.toPNG());
      data.screenshot = imagePath
    }

    return { success: true, data }
  })

  // 设置 WebContentsView 是否显示
  ipcMain.handle('set-web-contents-view-visible', (event, { status, nodeId }) => {
    const setVisible = (nodeViewData) => {
      if (!status) {
        // 不显示
        nodeViewData.disableVisible = true
      } else {
        delete nodeViewData.disableVisible
      }
      nodeViewData.view.setVisible(status)
    }
    for (const [key, nodeViewData] of nodeViews) {
      if (nodeViewData) {
        if (nodeId && nodeId === key) {
          setVisible(nodeViewData)
          break
        } else if (!nodeId) setVisible(nodeViewData)
      }
    }
    return { success: true }
  })

  // 获取画布状态列表
  ipcMain.handle('get-canvas-state-list', (event) => {
    const files = fs.readdirSync(projectDir)
    const data = files.filter(file => file.endsWith('.json'))
    return { success: true, data }
  })

  // 删除画布状态
  ipcMain.handle('remove-canvas-state', (event, { name }) => {
    const stateFilePath = path.join(projectDir, `${name}.json`)
    if (fs.existsSync(stateFilePath)) {
      fs.unlinkSync(stateFilePath)
    }
    return { success: true }
  })

  // 保存画布状态
  ipcMain.handle('save-canvas-state', (event, { name, state }) => {
    try {
      const stateFilePath = path.join(projectDir, `${name}.json`)
      // 序列化状态数据
      // 注意：Map不能直接序列化，需要转换为普通对象
      const serializableState = {
        ...state,
        nodes: Array.from(state.nodes).reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {})
      };
      fs.writeFileSync(stateFilePath, JSON.stringify(serializableState, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('保存画布状态失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 加载画布状态
  ipcMain.handle('load-canvas-state', (event, { name }) => {
    try {
      if (!name) name = "default"
      const stateFilePath = path.join(projectDir, `${name}.json`);

      if (fs.existsSync(stateFilePath)) {
        const stateData = fs.readFileSync(stateFilePath, 'utf8');
        const parsedState = JSON.parse(stateData);

        // 转换回Map
        if (parsedState.nodes) {
          parsedState.nodes = new Map(Object.entries(parsedState.nodes));
        }

        return { success: true, state: parsedState };
      } else {
        return { success: false, error: '没有保存的状态' };
      }
    } catch (error) {
      console.error('加载画布状态失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 保存设置
  ipcMain.handle('save-settings', (event, { settings }) => {
    try {
      const settingsFilePath = path.join(stateDir, 'app-settings.json')
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
      return { success: true };
    } catch (error) {
      console.error('保存设置失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 加载设置
  ipcMain.handle('load-settings', (event) => {
    try {
      const settingsFilePath = path.join(stateDir, 'app-settings.json');
      if (fs.existsSync(settingsFilePath)) {
        const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
        const parsedSettings = JSON.parse(settingsData);
        return { success: true, settings: parsedSettings };
      } else {
        // 返回默认设置
        return { success: true, settings: { sessionIds: [] } };
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 应用退出时清理资源
  app.on('will-quit', () => {
    logger.info('应用即将退出');
    app.isQuitting = true
  })
})

// 在macOS上，当所有窗口关闭时退出应用程序
app.on('window-all-closed', () => {
  logger.info('所有窗口已关闭');
  if (process.platform !== 'darwin') app.quit()
})

// 在macOS上，当应用程序图标被点击时重新创建窗口
app.on('activate', () => {
  logger.info('应用被激活');
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})

// 添加崩溃页面相关的IPC处理程序
ipcMain.on('restart-app', () => {
  logger.info('用户请求重启应用');
  // 先关闭所有窗口
  BrowserWindow.getAllWindows().forEach(window => {
    if (!window.isDestroyed()) {
      window.close();
    }
  });

  // 重启应用
  app.relaunch();
  app.exit(0);
});

ipcMain.on('exit-app', () => {
  logger.info('用户请求退出应用');
  app.exit(0);
});

// 设置全局错误处理程序
function setupGlobalErrorHandlers() {
  // 主进程未捕获异常处理
  process.on('uncaughtException', (error) => {
    logger.fatal('主进程未捕获的异常', {
      message: error.message,
      stack: error.stack
    });

    // 如果应用已经准备就绪，显示崩溃窗口
    if (app.isReady()) {
      createCrashLogWindow({
        type: 'uncaught-exception',
        message: error.message,
        stack: error.stack
      });
    } else {
      // 否则只显示错误对话框
      dialog.showErrorBox(
        '应用启动失败',
        `启动过程中发生错误: ${error.message}\n\n请检查日志文件获取更多信息。`
      );
      app.exit(1);
    }
  });

  // 未处理的Promise拒绝
  process.on('unhandledRejection', (reason, promise) => {
    const reasonMessage = reason instanceof Error ? reason.message : String(reason);
    const reasonStack = reason instanceof Error ? reason.stack : null;

    logger.error('主进程未处理的Promise拒绝', {
      reason: reasonMessage,
      stack: reasonStack
    });

    // 通常，未处理的Promise拒绝不会导致应用崩溃，所以这里只记录日志
  });

  // 如果是开发环境，还可以监控内存使用
  if (isDev) {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        external: Math.round(memoryUsage.external / 1024 / 1024)
      };

      // 如果内存使用超过一定阈值，记录警告日志
      if (memoryUsageMB.rss > 500) { // 500MB
        logger.warn('内存使用量较高', memoryUsageMB);
      }
    }, 60000); // 每分钟检查一次
  }
}
