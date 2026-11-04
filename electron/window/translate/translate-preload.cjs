/**
 * 翻译浮层专用 preload：窄权限 API。
 * 刻意不复用主窗口 preload —— 浮层不需要文件管理 / 数据库 / 邮箱等能力。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('translateAPI', {
  close: () => ipcRenderer.invoke('translate:close'),
  resize: (height, historyOpen) => ipcRenderer.invoke('translate:resize', { height, historyOpen }),
  copy: (text) => ipcRenderer.invoke('translate:copy', { text }),
  setPinned: (pinned) => ipcRenderer.invoke('translate:setPinned', { pinned }),
  getThemeSnapshot: () => ipcRenderer.invoke('translate:theme-snapshot'),
  getAIConfig: () => ipcRenderer.invoke('translate:ai-config'),
  onThemeChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('theme-changed', listener);
    return () => ipcRenderer.removeListener('theme-changed', listener);
  },
  onAIConfigChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('ai-config-changed', listener);
    return () => ipcRenderer.removeListener('ai-config-changed', listener);
  },
  onVisible: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('translate:popup-visible', listener);
    return () => ipcRenderer.removeListener('translate:popup-visible', listener);
  },
  history: {
    list: (payload) => ipcRenderer.invoke('translate:history:list', payload),
    save: (record) => ipcRenderer.invoke('translate:history:save', record),
    remove: (id) => ipcRenderer.invoke('translate:history:delete', { id }),
    clear: () => ipcRenderer.invoke('translate:history:clear'),
  },
  openOcrSettings: () => ipcRenderer.invoke('translate:open-ocr-settings'),
});

// 暴露 ai API：aiClient.ts 在翻译浮层中通过 window.electron.ai 调用 AI 翻译
contextBridge.exposeInMainWorld('electron', {
  ai: {
    chat: (payload) => ipcRenderer.invoke('ai-chat', payload),
  },
});
