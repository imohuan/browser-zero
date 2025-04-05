const NewProjectButton = {
  template: `
    <div @click="toggleDropdown" class="w-[120px] h-10 flex items-center gap-2 z-1000 relative">
      <button 
        class="w-full pl-4 pr-2 py-1 flex justify-between items-center gap-2 bg-primary text-white rounded-lg shadow-lg hover:bg-primary-dark transition-colors flex items-center"
      >
        <svg t="1743865497742" class="w-5 h-5" fill="currentColor" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="8202"><path d="M790.05636267 523.09223879L447.47185721 523.09223879c-27.99663901 0-50.60259157-22.60711651-50.60259158-50.60375552 0-27.9884891 22.60595257-50.59793465 50.60259158-50.59793465l342.58450432 0c27.99430997 0 50.60026254 22.6082816 50.60026254 50.59793465C840.65662521 500.48628622 817.83411371 523.09223879 790.05636267 523.09223879L790.05636267 523.09223879 790.05636267 523.09223879zM790.05636267 723.35797362L447.47185721 723.35797362c-27.99663901 0-50.60259157-22.60944555-50.60259158-50.60259157 0-27.98965305 22.60595257-50.60259157 50.60259158-50.60259158l342.58450432 0c27.99430997 0 50.60026254 22.61293853 50.60026254 50.60259158C840.65662521 700.74852807 817.83411371 723.35797362 790.05636267 723.35797362L790.05636267 723.35797362 790.05636267 723.35797362zM1022.60916338 888.73211449L1022.60916338 248.76453205c0-77.73532387-70.84386077-70.40957895-70.84386077-70.40957895s-422.90107051 0.42613191-400.2927889 0c-24.11720818 0.42613191-36.39353458-12.71060935-36.39353458-12.71060935s-16.79379229-29.06429781-47.15394958-74.71747072c-31.65369003-48.01436331-68.47335651-40.2648155-68.47335652-40.2648155L88.08773973 50.66205753c-86.34761443 0-87.20919211 83.11785927-87.2091921 83.11785927l0 750.85737187c0 92.58939961 69.97879011 81.18163683 69.97879011 81.18163684l887.36980309 0C1033.16349725 965.81892551 1022.60916338 888.73211449 1022.60916338 888.73211449L1022.60916338 888.73211449 1022.60916338 888.73211449 1022.60916338 888.73211449zM959.09221035 850.83314631c0 28.63932985-23.04023438 51.68072931-51.68189326 51.68072932L116.07972067 902.51387449c-28.64165774 0-51.67723634-23.04139947-51.67723633-51.68072932L64.40248547 315.08859904c0-28.64282283 23.03557746-51.67840029 51.67723634-51.67840029l791.3317615 0c28.64165774 0 51.68189326 23.03557746 51.68189326 51.67840029L959.09337543 850.83314631 959.09221035 850.83314631zM205.44402318 472.48964722c0 29.85019619 24.19521536 54.05472654 54.04308367 54.05472654 29.84903225 0 54.04890453-24.20453035 54.04890453-54.05472654 0-29.84204629-24.19987229-54.04308366-54.04890453-54.04308367C229.63807459 418.44656355 205.44402318 442.64061497 205.44402318 472.48964722L205.44402318 472.48964722 205.44402318 472.48964722zM205.44402318 672.75538205c0 29.85019619 24.19521536 54.04890453 54.04308367 54.04890453 29.84903225 0 54.04890453-24.19870834 54.04890453-54.04890453 0-29.85252523-24.19987229-54.04308366-54.04890453-54.04308367C229.63807459 618.71229838 205.44402318 642.90402077 205.44402318 672.75538205L205.44402318 672.75538205 205.44402318 672.75538205zM205.44402318 672.75538205" p-id="8203"></path></svg>
        项目
        <div class="h-full ">
          <svg  :class="['h-4 w-4 transition-transform', showDropdown ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
          <div ref="selector" v-show="showDropdown" class="absolute bottom-full left-0 mb-2 w-48 rounded-lg bg-white shadow-xl dark:bg-gray-800">
            <div class="p-2 text-gray-700 dark:text-gray-200">
              <div class="px-3 py-2 text-sm">最近项目</div>
              <div class="border-t border-gray-200 dark:border-gray-700"></div>
              <button @click="handleNewProject" class="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700">创建新项目</button>
              <div class="max-h-[200px] overflow-y-auto">
                <button v-for="item in canvasList" :key="item.value" :class="[
                  'flex items-center justify-between gap-2 w-full px-3 py-2 text-left ',
                  currentName === item.name ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                ]" >
                  <span @click="handleClickItem(item)" class="flex-1 w-full">{{item.name}}</span>
                  <svg @click="handleRemoveItem(item)" t="1743870086164" class="icon w-4 h-4 hover:text-red-700" fill="currentColor" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4416" width="200" height="200"><path d="M309.824 370.816l31.552 447.104h308.864l31.552-447.104h72.832l-31.808 452.224a72.704 72.704 0 0 1-72.576 67.584H341.376A72.704 72.704 0 0 1 268.8 823.04l-31.872-452.16H309.76z m158.336 22.528v339.392H395.392V393.344h72.768z m132.928 0v339.392H528.384V393.344h72.704zM128.384 249.6H855.68v72.704H128.384V249.6z m515.328-121.216v72.704H352.768V128.384h290.944z" p-id="4417"></path></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </button>
    </div>
  `,
  setup() {
    const showDropdown = Vue.ref(false)
    const selector = Vue.useTemplateRef("selector")
    const currentName = Vue.ref("default")
    const canvasList = Vue.ref([])
    const toggleDropdown = (event) => {
      if (selector.value && selector.value.contains(event.target)) {
        return
      }
      showDropdown.value = !showDropdown.value
      // console.table(123, selector.value, event.target);
    }

    const handleNewProject = () => {
      showDropdown.value = false
      app.nodeManager.reset()
      // app.canvasManager.redraw()
    }

    const clickOutside = (event) => {
      if (!selector.value.contains(event.target)) {
        showDropdown.value = false
      }
    }

    Vue.watch(showDropdown, async (newVal) => {
      if (newVal) {
        const names = await ipcRenderer.invoke("get-canvas-state-list").then(res => res?.data ?? [])
        console.log("项目列表", names);
        canvasList.value = names.map(name => {
          const basename = name.split(".")[0]
          if (name === "default.json") return { name: "默认", value: basename }
          return { name: basename, value: basename }
        })
        currentName.value = app.nodeManager.name
        setTimeout(() => {
          document.addEventListener('click', clickOutside)
        }, 100);
      } else {
        document.removeEventListener('click', clickOutside)
      }
    })

    const handleClickItem = async (item) => {
      showDropdown.value = false
      await Vue.nextTick()
      // await ipcRenderer.invoke('remove-web-contents-view-all')
      app.nodeManager.loadCanvasState(item.value);
    }

    const handleRemoveItem = async (item) => {
      await ipcRenderer.invoke("remove-canvas-state", { name: item.value })
      showDropdown.value = false
    }

    return { currentName, canvasList, showDropdown, toggleDropdown, handleNewProject, clickOutside, handleClickItem, handleRemoveItem }
  }
}

