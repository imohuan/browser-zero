const { app, session, BrowserWindow, WebContentsView, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater');
const isDev = require('electron-is-dev');

const nodeViews = new Map()

// 根据环境设置缓存目录

const appPath = isDev ? __dirname : path.dirname(app.getPath('exe'))
const cacheDir = path.join(appPath, '../cache')
const stateDir = path.join(cacheDir, 'state')
const screenshotDir = path.join(cacheDir, 'screenshot')

ensureDir(cacheDir)
ensureDir(stateDir)
ensureDir(screenshotDir)
// 设置应用缓存目录
app.setPath('userData', cacheDir)

/** 确保地址存在 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

if (isDev) autoUpdater.updateConfigPath = path.join(appPath, 'dev-app-update.yml');

autoUpdater.on('update-available', () => {
  console.log("有更新可用");
});

autoUpdater.on('update-downloaded', () => {
  // 给用户一个提示，然后重启应用；或者直接重启也可以，只是这样会显得很突兀
  console.log("更新已下载，准备安装");
  dialog.showMessageBox({
    title: '安装更新',
    message: '更新下载完毕，应用将重启并进行安装'
  }).then(() => {
    // 退出并安装应用
    setImmediate(() => autoUpdater.quitAndInstall());
  });
});

async function createMainWindow() {
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
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools()
  }

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

async function createWebContentsView(mainWindow, option) {
  const { nodeId, sessionId, url, bounds, nodeBounds, replaceView = false } = option
  // 检查节点是否已经存在
  if (nodeViews.has(nodeId)) {
    const nodeViewData = nodeViews.get(nodeId)
    if (replaceView) {
      mainWindow.contentView.removeChildView(nodeViewData.view)
      delete nodeViewData.view
      nodeViews.delete(nodeId)
    } else {
      // 检查视图是否可见
      await nodeViewData.view.webContents.loadURL(url)
      return nodeViewData.view.webContents.id
    }
  }

  const customSession = session.fromPartition(`persist:${sessionId}`)
  console.log("使用Session:", sessionId);
  const nodeViewData = { disableVisible: true }
  const nodeView = new WebContentsView({
    webPreferences: {
      session: customSession,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "view_preload.js"),
      // 启用背景节流以减少不可见时的CPU占用
      backgroundThrottling: true,
      webSecurity: false
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
    if (nodeViewData.view.webContents.isDestroyed()) return { success: false, error: 'Node view is destroyed' }
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
      nodeViewData.view.webContents.setZoomFactor(1 / newScaleFactor)
      nodeViewData.view.webContents.executeJavaScript(`document.body.style.width = '${nodeBounds.width * 2}px'`)
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
    const nodeViewData = nodeViews.get(nodeId)
    nodeViewData.view.webContents.destroy()
    mainWindow.contentView.removeChildView(nodeViewData.view)
    nodeViews.delete(nodeId)
    delete nodeViewData.view
    return { success: true }
  })

  // 删除所有节点
  ipcMain.handle('remove-web-contents-view-all', (event) => {
    let count = 0
    for (const [key, nodeViewData] of nodeViews) {
      if (nodeViewData) {
        nodeViewData.view.webContents.destroy()
        mainWindow.contentView.removeChildView(nodeViewData.view)
        nodeViews.delete(key)
        delete nodeViewData.view
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
        }
        setVisible(nodeViewData)
      }
    }
    return { success: true }
  })

  // 保存画布状态
  ipcMain.handle('save-canvas-state', (event, { state }) => {
    try {
      const stateFilePath = path.join(stateDir, 'canvas-state.json')
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
  ipcMain.handle('load-canvas-state', (event) => {
    try {
      const stateFilePath = path.join(stateDir, 'canvas-state.json');

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
    app.isQuitting = true
  })
})

// 在macOS上，当所有窗口关闭时退出应用程序
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 在macOS上，当应用程序图标被点击时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
})
