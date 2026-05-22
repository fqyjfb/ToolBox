const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lockElectron', {
  verifyPassword: (password) => ipcRenderer.invoke('lock:verifyPassword', password),
  getLockStatus: () => ipcRenderer.invoke('lock:getStatus'),
  unlock: () => ipcRenderer.invoke('lock:unlock'),
  closeWindow: () => ipcRenderer.invoke('lock:closeWindow'),
  exitApp: () => ipcRenderer.invoke('lock:exitApp'),
  // 拖拽相关
  dragStart: () => ipcRenderer.send('lock-drag-start'),
  dragMove: () => ipcRenderer.send('lock-drag-move'),
  dragEnd: () => ipcRenderer.send('lock-drag-end'),
});