const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quickLogin', {
  close: () => ipcRenderer.send('quick-login:close'),
  onData: (callback) => {
    ipcRenderer.on('quick-login:data', (event, data) => callback(data));
  },
  dragStart: () => ipcRenderer.send('quick-login-drag-start'),
  dragMove: () => ipcRenderer.send('quick-login-drag-move'),
});
