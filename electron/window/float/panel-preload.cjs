const { contextBridge, ipcRenderer } = require('electron');

// 面板是独立的本地页面，只暴露它真正需要的能力（不含任何 apiKey / 任意通道转发）
const listeners = {
  session: null,
  chunk: null,
  thinking: null,
  done: null,
  error: null,
  theme: null,
  aiStatus: null,
};

ipcRenderer.on('float:panel-session', (_event, payload) => {
  if (listeners.session) listeners.session(payload);
});
ipcRenderer.on('float:ai-chunk', (_event, payload) => {
  if (listeners.chunk) listeners.chunk(payload);
});
ipcRenderer.on('float:ai-thinking', (_event, payload) => {
  if (listeners.thinking) listeners.thinking(payload);
});
ipcRenderer.on('float:ai-done', (_event, payload) => {
  if (listeners.done) listeners.done(payload);
});
ipcRenderer.on('float:ai-error', (_event, payload) => {
  if (listeners.error) listeners.error(payload);
});
ipcRenderer.on('float:panel-theme', (_event, payload) => {
  if (listeners.theme) listeners.theme(payload);
});
ipcRenderer.on('float:panel-ai-status', (_event, payload) => {
  if (listeners.aiStatus) listeners.aiStatus(payload);
});

contextBridge.exposeInMainWorld('panelAPI', {
  init: () => ipcRenderer.invoke('float:panel-init'),
  getThemeSync: () => ipcRenderer.sendSync('float:panel-theme-sync'),
  close: () => ipcRenderer.invoke('float:panel-close'),
  openSettings: () => ipcRenderer.invoke('float:panel-open-settings'),
  saveNote: (payload) => ipcRenderer.invoke('float:save-note', payload),
  saveTodo: (payload) => ipcRenderer.invoke('float:save-todo', payload),
  openNote: (path) => ipcRenderer.invoke('float:open-note', path),
  openTodo: (id) => ipcRenderer.invoke('float:open-todo', id),

  aiStatus: () => ipcRenderer.invoke('float:ai-status'),
  // P1/P2 进阶功能：统一走 floatFeatureService 的注册入口
  search: (query) => ipcRenderer.invoke('float:search', query),
  searchExec: (payload) => ipcRenderer.invoke('float:search-exec', payload),
  captureClassify: (text) => ipcRenderer.invoke('float:capture-classify', text),
  captureCommit: (payload) => ipcRenderer.invoke('float:capture-commit', payload),
  shelfList: () => ipcRenderer.invoke('float:shelf-list'),
  shelfRemove: (id) => ipcRenderer.invoke('float:shelf-remove', id),
  shelfClear: () => ipcRenderer.invoke('float:shelf-clear'),
  shelfDragOut: (id) => ipcRenderer.send('float:shelf-drag-out', id),
  historyList: () => ipcRenderer.invoke('float:history-list'),
  historyGet: (id) => ipcRenderer.invoke('float:history-get', id),
  historySave: (payload) => ipcRenderer.invoke('float:history-save', payload),
  historyRemove: (id) => ipcRenderer.invoke('float:history-remove', id),
  historyClear: () => ipcRenderer.invoke('float:history-clear'),
  requestScreenshot: () => ipcRenderer.invoke('float:screenshot-request'),
  chatOnce: (payload) => ipcRenderer.invoke('float:ai-chat', payload),
  chatStream: (payload) => ipcRenderer.send('float:ai-chat-stream', payload),
  cancel: (requestId) => ipcRenderer.send('float:ai-cancel', { requestId }),

  onSession: (callback) => { listeners.session = callback; },
  onChunk: (callback) => { listeners.chunk = callback; },
  onThinking: (callback) => { listeners.thinking = callback; },
  onDone: (callback) => { listeners.done = callback; },
  onError: (callback) => { listeners.error = callback; },
  onTheme: (callback) => { listeners.theme = callback; },
  onAIStatus: (callback) => { listeners.aiStatus = callback; },
});
