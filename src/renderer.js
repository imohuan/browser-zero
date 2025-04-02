const { ipcRenderer } = require('electron');
const Application = require('./models/Application');
// 应用实例
let app = null;

ipcRenderer.on("window-focus", () => {
  document.body.classList.remove("electron-drag")
})

ipcRenderer.on("open-url", (event, { nodeId, url }) => {
  if (!app) return
  const node = app.nodeManager.nodes.get(nodeId)
  const x = node.x + node.width + 1000
  const y = node.y
  const id = app.nodeManager.addNode(x, y, { url });
  const boxBounds = { x: node.x - 9999, y: 0, width: node.x + 9999 * 2, height: node.height }

  const selectedNodes = Array.from(app.nodeManager.nodes.entries()).map(([nodeId, node]) => ({ nodeId, ...node })).filter(f => {
    if (f.id === id) return true
    if (f.id === nodeId) return true
    const nodeBounds = { x: node.x, y: node.y, width: node.width, height: node.height }
    const isOverlapping = app.nodeManager.isOverlapping(boxBounds, nodeBounds)
    return isOverlapping
  });

  app.nodeManager.arrange('left', 20, selectedNodes)
  app.nodeManager.arrange('top', 20, selectedNodes)
  app.nodeManager.createWebContentsView(id)
  app.nodeManager.saveToHistory()
})

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', () => {
  // 创建Vue应用
  const { createApp, ref, reactive, onMounted, nextTick } = Vue;
  // 创建根组件
  const App = {
    template: '#app-template',
    setup() {
      // 引用canvas元素
      const canvas = ref(null);
      // 应用状态
      const toolbarState = reactive({ currentTool: 'operation', isCollapsed: false });
      // 设置状态
      const appSettings = reactive({ sessionIds: ['default'] });
      // 显示设置模态框
      const showSettings = ref(false);
      // 通知系统引用
      const notificationSystem = ref(null);

      // 初始化应用
      onMounted(async () => {
        await nextTick();
        // 初始化应用
        app = new Application(canvas.value);
        // 设置通知回调 - 执行通知组件上的方法
        app.setNotifyCallback((message, type) => {
          if (notificationSystem.value) notificationSystem.value.showNotification(message, type);
        });
        // 初始化应用
        await app.initialize();
        // 同步状态
        Object.assign(toolbarState, app.toolbarState);
        Object.assign(appSettings, app.settingsManager.getSettings());
        setupCanvasEvents();
        setupWindowDragEvents();
        setupWindowEvents()

        resetView()
      });

      // 设置窗口事件
      const setupWindowEvents = () => {
        window.addEventListener("keydown", async (e) => {
          if (e.key === "Tab") {
            e.preventDefault()
            switchTool(toolbarState.currentTool === "hand" ? "operation" : "hand")
          }

          if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault()
            e.stopPropagation()
            await app.nodeManager.saveCanvasState();
            await ipcRenderer.invoke('remove-web-contents-view-all')
            setTimeout(() => location.reload(), 200);
          }

          if (e.ctrlKey && e.key === 'n') {
            await ipcRenderer.invoke('remove-web-contents-view-all')
            app.nodeManager.nodes.clear()
            app.nodeManager.clearHistory()
            app.nodeManager.saveCanvasState()
            await app.nodeManager.loadCanvasState();
            resetView()
            // app.canvasManager.redraw()
          }

          if (e.key === " ") {
            resetView()
          }

          if (e.ctrlKey) {
            switch (e.key) {
              case "ArrowUp":
                app.nodeManager.arrange('top')
                break
              case "ArrowLeft":
                app.nodeManager.arrange('left')
                break
              case "ArrowRight":
                app.nodeManager.arrange('right')
                break
              case "ArrowDown":
                app.nodeManager.arrange('down')
                break
            }
          }
        })
      }

      // 设置窗口拖拽事件
      const setupWindowDragEvents = () => {
        document.addEventListener("keydown", (e) => {
          if (e.altKey && e.code === "AltLeft") document.body.classList.add("electron-drag")
        })
        document.addEventListener("keyup", (e) => {
          if (e.code === "AltLeft") document.body.classList.remove("electron-drag")
        })
      };

      // 设置画布事件
      const setupCanvasEvents = () => {
        const canvasEl = canvas.value;

        // 鼠标状态变化
        canvasEl.addEventListener('mousemove', (e) => {
          if (toolbarState.currentTool === 'operation' && !app.nodeManager.resizing) {
            const canvasPos = app.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
            const nodeId = app.nodeManager.getNodeAtPosition(canvasPos.x, canvasPos.y, 5);
            if (nodeId) updateCursorForResize(e, nodeId)
            else canvas.value.style.cursor = 'default';
          }
        })

        // 鼠标按下事件
        canvasEl.addEventListener('mousedown', (e) => {
          if (e.button === 0) { // 左键
            if (toolbarState.currentTool === 'operation') {
              // 获取鼠标下的节点
              const canvasPos = app.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
              const nodeId = app.nodeManager.getNodeAtPosition(canvasPos.x, canvasPos.y, 5);
              if (nodeId) {
                // 选择节点
                app.nodeManager.selectNode(nodeId);
                checkResizeHandles(e, nodeId);
                app.nodeManager.checkClickNode(e, nodeId);
                // 检查是否点击在调整大小控件上
              } else {
                // 清除选择
                app.nodeManager.selectNode(null);
              }
            }

            if (!app.nodeManager.resizing) {
              if (toolbarState.currentTool === 'hand' || toolbarState.currentTool === 'operation') {
                // 拖动画布
                app.canvasManager.startDrag(e.offsetX, e.offsetY);
              }
            }
          } else if (e.button === 2) { // 右键
            // 处理右键菜单
            handleContextMenu(e);
          }
        });

        // 鼠标移动事件
        let overNodeId = null
        canvasEl.addEventListener('mousemove', (e) => {
          if (!(app.canvasManager.isDragging || app.nodeManager.isDragging || app.nodeManager.resizing)) {
            const canvasPos = app.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
            const nodeId = app.nodeManager.getNodeAtPosition(canvasPos.x, canvasPos.y, 10);
            app.nodeManager.hoverNode = nodeId
            // if (nodeId) {
            //   overNodeId = nodeId
            //   app.nodeManager.drawNode(nodeId)
            // }
            // // 渲染离开状态
            // if (!nodeId && overNodeId) {
            //   app.nodeManager.drawNode(overNodeId)
            //   overNodeId = null
            // }
            app.canvasManager.redraw()
          }

          if (app.canvasManager.isDragging && !app.nodeManager.isDragging) {
            // 拖动画布
            app.canvasManager.drag(e.offsetX, e.offsetY);
          } else if (app.nodeManager.resizing && app.nodeManager.selectedNode) {
            // 调整节点大小
            updateCursorForResize(e);
            const canvasPos = app.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
            app.nodeManager.resizeNode(canvasPos.x, canvasPos.y);
          } else if (toolbarState.currentTool === 'operation' && app.nodeManager.isDragging) {
            // 节点移动
            app.nodeManager.drag(e.offsetX, e.offsetY)
          }
        });

        // 鼠标松开事件
        canvasEl.addEventListener('mouseup', (e) => {
          if (app.canvasManager.isDragging) app.canvasManager.endDrag();
          if (app.nodeManager.resizing) app.nodeManager.endResize();
          if (app.nodeManager.isDragging) app.nodeManager.endDrag()
          app.nodeManager.saveToHistory()
        });

        // 鼠标离开事件
        canvasEl.addEventListener('mouseleave', (e) => {
          if (app.canvasManager.isDragging) app.canvasManager.endDrag();
          if (app.nodeManager.resizing) app.nodeManager.endResize();
          if (app.nodeManager.isDragging) app.nodeManager.endDrag()
        });

        // 鼠标滚轮事件
        canvasEl.addEventListener('wheel', (e) => {
          e.preventDefault();
          // 计算缩放系数
          const delta = e.deltaY < 0 ? 1.1 : 0.9;
          // 缩放画布
          app.canvasManager.zoom(e.offsetX, e.offsetY, delta);
          removeUrlInput()
        });

        // 双击事件
        canvasEl.addEventListener('dblclick', (e) => {
          // 获取鼠标下的节点
          const canvasPos = app.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
          let nodeId = app.nodeManager.getNodeAtPosition(canvasPos.x, canvasPos.y);
          if (!nodeId) {
            // 在空白区域双击添加节点
            nodeId = app.addNode(e.offsetX, e.offsetY);
          }

          if (nodeId) {
            // 显示URL输入框
            let { x, y, width, height } = app.nodeManager.nodes.get(nodeId)
            y = y - app.nodeManager.titleHeight - app.nodeManager.titleMargin
            showUrlInput(nodeId, x, y, width, app.nodeManager.titleHeight);
          }
        });

        // 上下文菜单事件
        canvasEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          // if (!windowDrag.isDragging) {
          //   handleContextMenu(e);
          // }
        });
      };

      const getCursorForDirection = (pos, nodeId) => {
        if (!app.nodeManager.nodes.has(nodeId)) return
        const node = app.nodeManager.nodes.get(nodeId);
        const { scale, offsetX, offsetY } = app.canvasManager;
        let titleHeight = app.nodeManager.titleHeight;
        titleHeight = 0

        // 计算节点在画布上的位置
        const x = node.x * scale + offsetX;
        const y = node.y * scale + offsetY;
        const width = node.width * scale;
        const height = node.height * scale;
        const handleSize = 10
        const [mouseX, mouseY] = pos

        // 检查各个调整控件
        // console.log("x", mouseX, x, Math.abs(mouseX - x));

        // // 左上
        // if (Math.abs(mouseX - x) <= handleSize * 2 && Math.abs(mouseY - (y - titleHeight)) <= handleSize * 2) {
        //   return ["nwse", 'nw']
        // }
        // // 右上
        // if (Math.abs(mouseX - (x + width)) <= handleSize * 2 && Math.abs(mouseY - (y - titleHeight)) <= handleSize * 2) {
        //   return ['nesw', 'ne']
        // }
        // // 左下
        // if (Math.abs(mouseX - x) <= handleSize * 2 && Math.abs(mouseY - (y + height)) <= handleSize * 2) {
        //   return ['nesw', 'sw']
        // }
        // 右下
        if (Math.abs(mouseX - (x + width)) <= handleSize * 2 && Math.abs(mouseY - (y + height)) <= handleSize * 2) {
          return ['nwse', 'se']
        }
        return ['default', '']
      }

      // 检查是否点击在调整大小控件上
      const checkResizeHandles = (e, nodeId) => {
        const [direction, handle] = getCursorForDirection([e.offsetX, e.offsetY], nodeId)
        const canvasPos = app.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
        if (direction !== "default") app.nodeManager.startResize(nodeId, handle, canvasPos.x, canvasPos.y);
      };

      // 根据鼠标位置更新光标样式
      const updateCursorForResize = (e, customSelectNode = null) => {
        const selectNode = app.nodeManager.selectedNode ?? customSelectNode
        if (!selectNode) return;
        const [direction, handle] = getCursorForDirection([e.offsetX, e.offsetY], selectNode)
        canvas.value.style.cursor = direction === 'default' ? 'default' : `${direction}-resize`;
      };

      // 处理右键菜单
      const handleContextMenu = (e) => {
        // // 获取鼠标下的节点
        // const canvasPos = app.canvasManager.screenToCanvas(e.offsetX, e.offsetY);
        // const nodeId = app.nodeManager.getNodeAtPosition(canvasPos.x, canvasPos.y);

        // if (!nodeId) {
        //   // 在空白区域右键添加节点
        //   app.addNode(e.offsetX, e.offsetY);
        // }
      };

      // 切换工具
      const switchTool = (toolName) => {
        if (!app) return;
        app.switchTool(toolName);
        toolbarState.currentTool = toolName;
      };

      // 折叠/展开工具栏
      const toggleSidebar = () => {
        if (!app) return;

        app.toggleSidebar();
        toolbarState.isCollapsed = app.toolbarState.isCollapsed;
      };

      // 处理添加节点
      const handleAddNode = () => {
        if (!app) return;

        // 在画布中心添加节点
        const { width, height } = app.canvasManager.canvas;
        app.addNode(width / 2, height / 2);
      };

      // 重置视图
      const resetView = () => {
        if (!app) return;
        const { offsetX, offsetY, scale } = app.nodeManager.calculateOptimalViewport(100)
        app.canvasManager.scale = scale;
        app.canvasManager.offsetX = offsetX;
        app.canvasManager.offsetY = offsetY;
        app.canvasManager.redraw()
      };

      // 打开设置模态框
      const openSettingsModal = () => {
        if (!app) return;
        // 更新设置
        ipcRenderer.invoke("set-web-contents-view-visible", { status: false })
        Object.assign(appSettings, app.settingsManager.getSettings());
        showSettings.value = true;
      };

      // 关闭设置模态框
      const closeSettingsModal = () => {
        showSettings.value = false;
        ipcRenderer.invoke("set-web-contents-view-visible", { status: true })
      };

      // 保存设置
      const saveSettings = async (newSettings) => {
        if (!app) return;
        await app.saveSettings(newSettings);
        showSettings.value = false;
      };

      // 显示URL输入框
      async function showUrlInput(nodeId, x, y, width, height) {
        const nodeData = app.nodeManager.nodes.get(nodeId)
        const url = await ipcRenderer.invoke("get-web-contents-view-data", { nodeId }).then(res => res?.data?.url);

        // 创建输入框
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'url-input';
        input.setAttribute("data-node-id", nodeId)
        input.placeholder = 'https://example.com';
        if (url) input.value = url;
        // 设置样式 - 只设置位置和尺寸（其他样式通过CSS定义）
        const inputCanvasX = nodeData?.sessionId?.trim() ? x + 55 : x + 28;
        const inputX = inputCanvasX * app.canvasManager.scale + app.canvasManager.offsetX
        const inputY = (y + 4) * app.canvasManager.scale + app.canvasManager.offsetY
        let inputWidth = (width - 45 - (inputCanvasX - x)) * app.canvasManager.scale;


        inputWidth = Math.min(document.body.offsetWidth - inputX - 100, inputWidth)
        input.style.left = `${inputX}px`;
        input.style.top = `${inputY}px`;
        input.style.width = `${inputWidth}px`;
        input.style.height = `${(height - 8) * app.canvasManager.scale}px`;
        input.style.borderRadius = `${3 * app.canvasManager.scale}px`;
        input.style.fontSize = `${7 * app.canvasManager.scale}px`;
        input.style.padding = `${0.2 * app.canvasManager.scale}px ${5 * app.canvasManager.scale}px`;
        // 添加到文档
        document.body.appendChild(input);
        // 自动聚焦
        input.focus();

        // 记录当前编辑的节点
        app.editingTitle = nodeId;

        // 处理按键事件
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            const url = input.value.trim();
            input.blur();
            if (url && nodeId) {
              const nodeData = app.nodeManager.nodes.get(nodeId);
              if (nodeData) {
                // 创建WebContentsView
                nodeData.url = url
                await app.nodeManager.createWebContentsView(nodeId);
                app.canvasManager.redraw()
              }
            }
            removeUrlInput();
          } else if (e.key === 'Escape') {
            removeUrlInput();
          }
        });

        // 处理失焦事件
        input.addEventListener('blur', () => {
          removeUrlInput();
        });
      }

      // 移除URL输入框
      function removeUrlInput() {
        try {
          const input = document.getElementById('url-input');
          if (input) {
            document.body.removeChild(input);
            app.editingTitle = null;
          }
        } catch { }
      }

      return {
        canvas,
        toolbarState,
        appSettings,
        showSettings,
        notificationSystem,
        switchTool,
        toggleSidebar,
        handleAddNode,
        resetView,
        openSettingsModal,
        closeSettingsModal,
        saveSettings
      };
    }
  };

  const vueApp = createApp(App);

  vueApp.component('app-title-bar', AppTitleBar);
  vueApp.component('window-controls', WindowControls);
  vueApp.component('sidebar-menu', SidebarMenu);
  vueApp.component('settings-modal', SettingsModal);
  vueApp.component('notification-system', NotificationSystem);
  // 挂载应用
  vueApp.mount('#app');
});
