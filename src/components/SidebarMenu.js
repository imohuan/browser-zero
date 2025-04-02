// 侧边栏菜单组件
const SidebarMenu = {
  template: `
<div class="absolute bottom-5 overflow-hidden left-1/2 z-[900] flex h-11 -translate-x-1/2 items-center rounded-xl bg-white px-2 shadow-md transition-all duration-300 dark:bg-gray-800" :class="{ 'opacity-0 translate-y-full': isCollapsed ? !isHover : isCollapsed  }">
  <div class="flex w-full flex-col border-r-2 border-gray-200 py-1 dark:border-gray-700">
    <button class="mx-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title="添加节点" @click="$emit('add-node')">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="currentColor" />
      </svg>
    </button>
  </div>

  <div class="flex w-full border-r-2 border-gray-200 px-1 dark:border-gray-700">
    <button class="mx-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all dark:text-gray-400" :class="[currentTool === 'hand' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700']" title="拖拽画布" @click="$emit('switch-tool', 'hand')">
      <svg t="1743417296709" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2438" width="20" height="20">
        <path d="M533.333333 85.333333a106.666667 106.666667 0 0 1 90.197334 49.706667c11.904-4.650667 24.746667-7.04 37.802666-7.04a106.666667 106.666667 0 0 1 106.325334 98.218667L768 234.666667v23.466666a106.666667 106.666667 0 0 1 127.658667 96.085334L896 362.666667v213.333333a362.666667 362.666667 0 0 1-725.077333 13.098667L170.666667 576v-85.333333a106.666667 106.666667 0 0 1 128.042666-104.533334L298.666667 234.666667a106.666667 106.666667 0 0 1 144.554666-99.712A106.666667 106.666667 0 0 1 533.333333 85.333333z m21.333334 106.666667a21.333333 21.333333 0 0 0-42.410667-3.370667L512 192V469.333333a42.666667 42.666667 0 0 1-85.034667 4.992L426.666667 469.333333V234.666667a21.333333 21.333333 0 0 0-42.410667-3.370667L384 234.666667V597.333333a42.666667 42.666667 0 0 1-85.034667 4.992L298.666667 597.333333v-106.666666a21.333333 21.333333 0 0 0-42.410667-3.370667L256 490.666667v85.333333a277.333333 277.333333 0 0 0 554.368 12.928L810.666667 576v-213.333333a21.333333 21.333333 0 0 0-42.410667-3.370667L768 362.666667V469.333333a42.666667 42.666667 0 0 1-85.034667 4.992L682.666667 469.333333V234.666667a21.333333 21.333333 0 0 0-42.410667-3.370667L640 234.666667V469.333333a42.666667 42.666667 0 0 1-85.034667 4.992L554.666667 469.333333V192z" fill="currentColor" p-id="2439"></path>
      </svg>
    </button>
    <button class="mx-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all dark:text-gray-400" :class="[currentTool === 'operation' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700']" title="操作模式" @click="$emit('switch-tool', 'operation')">
      <svg t="1743417266668" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1463" width="20" height="20">
        <path d="M667.704889 667.704889L564.906667 856.177778q-16.782222 30.776889-47.445334 46.648889-28.444444 14.677333-60.643555 12.344889-32.256-2.332444-58.254222-20.992-28.046222-20.081778-40.220445-53.020445l-197.973333-534.641778q-12.174222-32.768-4.096-66.161777 7.509333-31.004444 30.264889-53.816889 22.755556-22.755556 53.816889-30.264889 33.393778-8.078222 66.161777 4.039111L841.159111 358.4q32.995556 12.174222 53.020445 40.220444 18.659556 25.998222 20.992 58.254223 2.275556 32.256-12.344889 60.643555-15.872 30.663111-46.648889 47.445334l-188.472889 102.798222z m-202.695111 133.973333l102.798222-188.472889q16.042667-29.354667 45.397333-45.397333l188.472889-102.798222-534.641778-197.973334 197.973334 534.641778z" fill="currentColor" p-id="1464"></path>
      </svg>
    </button>
  </div>

  <div class="flex w-full px-1">
    <button class="mx-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title="重置视图" @click="$emit('reset-view')">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17Z" fill="currentColor" />
      </svg>
    </button>
    <button class="mx-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title="查看日志" @click="$emit('open-logs')">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path d="M20,3H4A1,1 0 0,0 3,4V10A1,1 0 0,0 4,11H20A1,1 0 0,0 21,10V4A1,1 0 0,0 20,3M20,13H4A1,1 0 0,0 3,14V20A1,1 0 0,0 4,21H20A1,1 0 0,0 21,20V14A1,1 0 0,0 20,13M5,15H19V19H5V15M5,5H19V9H5V5Z" fill="currentColor" />
      </svg>
    </button>
    <button class="mx-0.5 flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-all hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title="设置" @click="$emit('open-settings')">
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" fill="currentColor" />
      </svg>
    </button>
  </div>

  <button class="mr-2 flex h-6 w-6 -rotate-90 cursor-pointer items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-all hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600" title="收起工具栏" @click="$emit('toggle-sidebar')">
    <svg :class="{ 'transform rotate-180': isCollapsed }" width="16" height="16" viewBox="0 0 24 24">
      <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" fill="currentColor" />
    </svg>
  </button>
</div>

  `,
  props: {
    currentTool: { type: String, default: 'hand' },
    isCollapsed: { type: Boolean, default: true }
  },
  emits: ['toggle-sidebar', 'switch-tool', 'add-node', 'reset-view', 'open-settings', 'open-logs'],
  setup(props, { emit }) {
    const { inside: isHover } = hooks.useMouseInside(() => [document.body.offsetWidth / 2 - 150, document.body.offsetHeight - 70, 300, 70])
    return { isHover };
  }
}; 