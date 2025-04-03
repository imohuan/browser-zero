const { app, BrowserWindow, desktopCapturer } = require('electron');
const path = require('path');
const { SpoutOutput } = require('./electron-spout.node');

// TODO： 目前没有相应API，需要手动创建C++进扩展
var spout = new SpoutOutput('SpoutElectron')

let offscreenWindow;
let targetWindow;
// 禁用当前应用程序的硬件加速 此方法只能在应用程序准备好之前调用。
// app.disableHardwareAcceleration()
app.whenReady().then(() => {
  // 创建离屏窗口 - 使用软件输出设备模式
  offscreenWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // offscreen: true,
      offscreen: { useSharedTexture: true },  // 启用离屏渲染
      // 不设置useSharedTexture，使用默认的软件输出设备
      nodeIntegration: true,
      contextIsolation: false,
    },
    // 指定假以创建无框架窗口。默认为true。
    // frame: false,
    // show: false  // 不显示窗口可以节省资源
  });

  // import { app, BrowserWindow, screen } from 'electron';
  // let factor = screen.getPrimaryDisplay().scaleFactor;
  // const osr = new BrowserWindow({
  //   width: 1920 / factor,
  //   height: 1080 / factor,
  //   webPreferences: {
  //     offscreen: true,
  //     // @ts-ignore
  //     offscreenUseSharedTexture: true,
  //     zoomFactor: 1.0 / factor,
  //   },
  //   transparent: true,
  //   show: false,
  //   frame: false
  // })
  // 加载离屏窗口的页面
  offscreenWindow.loadURL('https://github.com');
  // 设置帧率限制以减少资源消耗
  // 可根据需要调整，值越小性能越好但流畅度降低
  offscreenWindow.webContents.setFrameRate(60);

  // 创建目标窗口
  targetWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  targetWindow.webContents.openDevTools("bottom")

  // 加载目标窗口的页面
  targetWindow.loadFile(path.join(__dirname, 'renderer.html'));

  // 使用beginFrameSubscription获取帧数据

  offscreenWindow.webContents.on("paint", async (event, frameBuffer, dirtyRect) => {
    if (targetWindow && !targetWindow.isDestroyed()) {
      // 将NativeImage对象转换为PNG格式的Buffer
      // const pngBuffer = dirtyRect.toPNG();
      // const sources = await desktopCapturer.getSources({
      //   types: ['window'],
      //   thumbnailSize: { width: 0, height: 0 }
      // });
      // const sourceId = offscreenWindow.webContents.getOSProcessId();
      // const source = sources.find(s => s.id.includes(sourceId.toString()));
      // targetWindow.webContents.send('offscreen-ready', source.id);
      try {
        spout.updateTexture({ ...dirtyRect, ...event.texture });
        // targetWindow.webContents.send('texture', event.texture);
      } catch (error) {
        console.log(error);
      }
      event.texture?.release()
    }
  })

  // 这在软件输出设备模式下效率更高
  // offscreenWindow.webContents.beginFrameSubscription(true, (frameBuffer, dirtyRect) => {
  //   console.log(1);
  //   if (targetWindow && !targetWindow.isDestroyed()) {
  //     // 发送帧数据和脏矩形信息
  //     targetWindow.webContents.send('frame-data', {
  //       buffer: frameBuffer.buffer,  // 使用ArrayBuffer传输更高效
  //       width: dirtyRect.width || 800,
  //       height: dirtyRect.height || 600,
  //       x: dirtyRect.x || 0,
  //       y: dirtyRect.y || 0
  //     }, [frameBuffer.buffer]);  // 使用transferable objects提高性能
  //   }
  // });

});

// 清理资源
app.on('window-all-closed', () => {
  if (offscreenWindow) {
    offscreenWindow.webContents.endFrameSubscription();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
