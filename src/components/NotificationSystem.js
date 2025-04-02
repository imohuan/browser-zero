// 通知系统组件
const NotificationSystem = {
  template: `
    <div class="fixed bottom-5 right-5 flex flex-col items-end gap-2.5 z-[3000]">
      <transition-group name="notification">
        <div v-for="notification in notifications" :key="notification.id" 
            class="px-4 py-2 rounded-lg shadow-md text-sm max-w-xs animate-[slideIn_0.3s_ease_forwards]"
            :class="{
              'bg-white dark:bg-gray-800 border-l-4 border-primary dark:border-primary': notification.type === 'info',
              'bg-white dark:bg-gray-800 border-l-4 border-green-500 dark:border-green-500': notification.type === 'success',
              'bg-white dark:bg-gray-800 border-l-4 border-red-500 dark:border-red-500': notification.type === 'error'
            }">
          <div class="flex items-center justify-between">
            <div class="text-gray-800 dark:text-gray-200">{{ notification.message }}</div>
            <button class="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click="removeNotification(notification.id)">
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </transition-group>
    </div>
  `,
  setup() {
    const { ref } = Vue;
    const notifications = ref([]);
    const showNotification = (message, type = 'info', timeout = 3000) => {
      const id = Date.now(); // 使用时间戳作为通知ID
      notifications.value.unshift({ id, message, type });
      setTimeout(() => removeNotification(id), timeout);
    };
    const removeNotification = (id) => {
      const index = notifications.value.findIndex(notification => notification.id === id);
      if (index !== -1) notifications.value.splice(index, 1);
    };
    return { notifications, showNotification, removeNotification };
  }
}; 