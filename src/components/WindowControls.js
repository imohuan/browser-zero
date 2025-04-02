// 窗口控制按钮组件
const WindowControls = {
  template: `
    <div ref="el" class="window-controls flex justify-end absolute top-0 right-0 z-[1000] transition-transform"
         :class="{ 'opacity-0 -translate-y-full': !isHover }">

        <button class="flex items-center justify-center w-10 h-10 hover:bg-gray-500 hover:bg-opacity-10 transition-colors text-gray-500" @click="$emit('minimize')">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
            <path d="M0,5 L10,5" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
        <button class="flex items-center justify-center w-10 h-10 hover:bg-gray-500 hover:bg-opacity-10 transition-colors text-gray-500" @click="$emit('toggle-maximize')">
          <svg v-if="isFull" width="12" height="12" viewBox="0 0 12 12">
            <path d="M3.5,3.5 v5 h5 v-5 h-5 M2.5,2.5 v1 h7 v7 h-7 v-8" fill="none" stroke="currentColor" stroke-width="1"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect x="2.5" y="2.5" width="7" height="7" stroke="currentColor" fill="none" stroke-width="1"/>
          </svg>
        </button>
        <button class="flex items-center justify-center w-10 h-10 hover:bg-red-500 hover:text-white text-gray-500 transition-colors" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">
            <path d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" stroke-width="1" />
          </svg>
        </button>
    </div>
  `,
  emits: ['minimize', 'maximize', 'toggle-maximize', 'close'],
  setup() {
    const { ref, useTemplateRef } = Vue
    const isFull = ref(false)
    const el = useTemplateRef("el")
    const { inside: isHover } = hooks.useMouseInside(() => [document.body.offsetWidth - el.value.offsetWidth, 0, el.value.offsetWidth, 40])
    ipcRenderer.on('window-state-changed', (event, isMaximized) => {
      isFull.value = isMaximized
    });
    return { isFull, isHover }
  }
}; 