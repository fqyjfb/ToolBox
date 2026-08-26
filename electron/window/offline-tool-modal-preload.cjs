const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('otModal', {
  done: (result) => ipcRenderer.send('offline-tool-modal-result', result),
});
