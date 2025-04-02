// LogViewer.js
// 日志查看组件

const LogViewer = {
  template: `
    <div class="bg-opacity-50 fixed inset-0 z-[3000] flex items-center justify-center bg-black" v-if="visible">
      <div class="log-viewer">
        <div class="log-viewer-header">
          <div class="log-viewer-title">日志查看器</div>
          <div class="log-viewer-controls">
            <button class="btn-refresh" @click="refreshLogs">刷新</button>
            <button class="btn-open-file" @click="openLogFile">打开日志文件</button>
            <button class="btn-copy" @click="copyLogs">复制</button>
            <button class="btn-close" @click="close">关闭</button>
          </div>
        </div>
        <div class="log-viewer-content">
          <div class="log-filter">
            <div class="filter-item">
              <label for="log-level">日志级别:</label>
              <select id="log-level" v-model="filter.level">
                <option value="all">全部</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
                <option value="fatal">Fatal</option>
              </select>
            </div>
            <div class="filter-item">
              <label for="log-search">搜索:</label>
              <input id="log-search" type="text" v-model="filter.search" placeholder="搜索日志内容..." />
            </div>
          </div>
          <div class="log-content" ref="logContent">
            <pre v-if="logs.length">{{ filteredLogs }}</pre>
            <div class="no-logs" v-else>暂无日志数据</div>
          </div>
        </div>
      </div>
    </div>
  `,
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    crashMode: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      logs: [],
      filter: {
        level: 'all',
        search: ''
      },
      levelHighlights: {
        'DEBUG': 'log-debug',
        'INFO': 'log-info',
        'WARN': 'log-warn',
        'ERROR': 'log-error',
        'FATAL': 'log-fatal'
      }
    };
  },
  computed: {
    filteredLogs() {
      let filtered = this.logs;

      // 按级别过滤
      if (this.filter.level !== 'all') {
        const level = this.filter.level.toUpperCase();
        filtered = filtered.filter(line => line.includes(`[${level}]`));
      }

      // 按搜索词过滤
      if (this.filter.search.trim()) {
        const searchTerm = this.filter.search.trim().toLowerCase();
        filtered = filtered.filter(line => line.toLowerCase().includes(searchTerm));
      }

      return filtered.join('\n');
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        this.loadLogs();
      }
    }
  },
  mounted() {
    if (this.visible) {
      this.loadLogs();
    }

    // 如果是崩溃模式，设置特殊样式
    if (this.crashMode) {
      this.$nextTick(() => {
        const el = this.$el;
        if (el) {
          el.classList.add('crash-mode');
        }
      });
    }
  },
  methods: {
    async loadLogs() {
      try {
        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('get-latest-logs');
        if (result.success) {
          this.logs = result.logs;
          this.$nextTick(() => {
            this.scrollToBottom();
          });
        } else {
          console.error('加载日志失败:', result.error);
        }
      } catch (error) {
        console.error('加载日志时出错:', error);
      }
    },

    refreshLogs() {
      this.loadLogs();
    },

    async openLogFile() {
      try {
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('open-log-file');
      } catch (error) {
        console.error('打开日志文件失败:', error);
      }
    },

    copyLogs() {
      try {
        navigator.clipboard.writeText(this.filteredLogs).then(() => {
          this.$emit('notification', '日志已复制到剪贴板', 'success');
        }).catch(err => {
          console.error('复制到剪贴板失败:', err);
          this.$emit('notification', '复制到剪贴板失败', 'error');
        });
      } catch (error) {
        console.error('复制日志时出错:', error);
        this.$emit('notification', '复制到剪贴板失败', 'error');
      }
    },

    scrollToBottom() {
      const container = this.$refs.logContent;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    close() {
      this.$emit('update:visible', false);
    }
  }
};

module.exports = LogViewer; 