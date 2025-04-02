// 应用标题栏组件
const AppTitleBar = {
  // <div class="absolute top-0 left-0 right-0 h-10 z-[998] flex items-center px-3"></div>
  template: `
    <window-controls @minimize="minimize" @maximize="maximize" @toggle-maximize="toggleMaximize" @close="close" />
  `,
  emits: ['window-drag'],
  setup(props, { emit }) {
    const { ipcRenderer } = require('electron');
    const minimize = () => ipcRenderer.invoke('minimize-window');
    const maximize = () => ipcRenderer.invoke('maximize-window');
    const toggleMaximize = () => ipcRenderer.invoke('toggle-maximize-window');
    const close = () => ipcRenderer.invoke('close-window');
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "f") {
        toggleMaximize()
      }
    })
    return { minimize, maximize, close, toggleMaximize };
  }
};
