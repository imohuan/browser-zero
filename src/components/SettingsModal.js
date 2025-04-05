// 设置模态框组件
const SettingsModal = {
  template: `
<div class="bg-opacity-50 fixed inset-0 z-[3000] flex items-center justify-center bg-black" v-if="show">
  <div class="m-4 max-h-[500px] w-full max-w-[600px] rounded-lg bg-white shadow-xl dark:bg-gray-800 flex flex-col" @click.stop>
    <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">应用设置</h3>
      <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="closeModal">
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor" />
        </svg>
      </button>
    </div>
    <div class="px-6 py-4 flex-1 w-full h-full overflow-y-auto">
      <div class="mb-4">
        <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">节点外边距</label>
        <input type="number" v-model="localSettings.nodePadding" placeholder="外边距" min="0" max="10" class="focus:ring-primary focus:border-primary w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
      </div>


      <div class="mb-4">
        <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">默认会话</label>
        <input type="text" v-model="localSettings.defaultSessionId" placeholder="默认会话ID" class="focus:ring-primary focus:border-primary w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
      </div>

      <div class="mb-4">
        <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">所有会话</label>
        <div class="space-y-2">
          <div class="flex items-center space-x-2" v-for="(session, index) in localSettings.sessionIds" :key="index">
            <input type="text" v-model="localSettings.sessionIds[index]" class="focus:ring-primary focus:border-primary flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:ring-2 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
            <button class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="removeSession(index)" v-if="localSettings.sessionIds.length > 1">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor" />
              </svg>
            </button>
          </div>
          <button class="flex gap-4 justify-center items-center mt-2 w-full rounded-md bg-gray-100 border border-dashed border-gray-400 px-4 py-2 shadow-md text-gray-800 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600" @click="addSession">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            添加会话
          </button>
        </div>
      </div>
    </div>
    <div class="flex justify-end space-x-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
      <button class="rounded-md bg-gray-200 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600" @click="closeModal">取消</button>
      <button class="hover:bg-opacity-90 rounded-md bg-primary px-4 py-2 text-white transition-colors" @click="saveSettings">保存</button>
    </div>
  </div>
</div>

  `,
  props: {
    show: {
      type: Boolean,
      default: false
    },
    settings: {
      type: Object,
      default: () => ({
        defaultSessionId: 'default',
        sessionIds: ['default']
      })
    }
  },
  emits: ['close', 'save'],
  setup(props, { emit }) {
    const { reactive, watch } = Vue;

    // 本地设置对象（用于编辑）
    const localSettings = reactive({
      defaultSessionId: '',
      sessionIds: [],
      nodePadding: 5
    });

    const setDefaultSessionId = (newSettings = {}) => {
      localSettings.defaultSessionId = newSettings?.defaultSessionId || 'default';
      if (!localSettings.sessionIds.includes(localSettings.defaultSessionId)) {
        localSettings.defaultSessionId = localSettings.sessionIds[0];
      }
    }

    // 当props.settings变化时，更新本地设置对象
    watch(() => props.settings, (newSettings) => {
      if (newSettings && props.show) {
        localSettings.nodePadding = newSettings.nodePadding
        localSettings.sessionIds = [...(newSettings.sessionIds || ['default'])];
        setDefaultSessionId(newSettings)
      }
    }, { immediate: true });

    // 添加会话
    const addSession = () => {
      const lastSessionId = localSettings.sessionIds[localSettings.sessionIds.length - 1]
      let [_, name, index] = lastSessionId.match(/([a-zA-Z_]+)(\d+)/)
      if ((name + index).length !== lastSessionId.length) {
        name = "D"
        index = localSettings.sessionIds.length + 1
      } else {
        index = parseInt(index) + 1
      }

      let newId = name + index
      // 确保ID唯一
      while (localSettings.sessionIds.includes(newId)) {
        newId += '_1';
      }

      localSettings.sessionIds.push(newId);
    };

    // 删除会话
    const removeSession = (index) => {
      if (localSettings.sessionIds.length > 1) {
        const removedId = localSettings.sessionIds[index];
        localSettings.sessionIds.splice(index, 1);
        // 如果删除的是默认会话，更新默认会话ID
        if (removedId === localSettings.defaultSessionId) setDefaultSessionId()
      }
    };

    // 关闭模态框
    const closeModal = () => {
      emit('close');
    };

    // 保存设置
    const saveSettings = () => {
      // 确保默认会话ID存在于会话列表中
      if (!localSettings.sessionIds.includes(localSettings.defaultSessionId)) {
        localSettings.defaultSessionId = localSettings.sessionIds[0];
      }
      emit('save', JSON.parse(JSON.stringify(localSettings)));
    };

    return {
      localSettings,
      addSession,
      removeSession,
      closeModal,
      saveSettings
    };
  }
}; 