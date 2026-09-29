const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lockElectron', {
  verifyPassword: (password) => ipcRenderer.invoke('lock:verifyPassword', password),
  unlock: () => ipcRenderer.invoke('lock:unlock'),
  // 首帧前就要拿到主题，因此走同步通道
  getTheme: () => ipcRenderer.sendSync('lock:get-theme-sync'),
  closeWindow: () => ipcRenderer.invoke('lock:closeWindow'),
  exitApp: () => ipcRenderer.invoke('lock:exitApp'),
  // 拖拽相关
  dragStart: () => ipcRenderer.send('lock-drag-start'),
  dragMove: () => ipcRenderer.send('lock-drag-move'),
  dragEnd: () => ipcRenderer.send('lock-drag-end'),
});