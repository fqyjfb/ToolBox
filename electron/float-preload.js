const { contextBridge, ipcRenderer } = require('electron');

let configChangedCallback = null;

ipcRenderer.on('float-config-changed', (event, config) => {
  if (configChangedCallback) {
    configChangedCallback(config);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  dragStart: () => ipcRenderer.send('float-drag-start'),
  dragMove: () => ipcRenderer.send('float-drag-move'),
  dragEnd: () => ipcRenderer.send('float-drag-end'),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('float-set-ignore-events', ignore),
  showContextMenu: () => ipcRenderer.send('float-show-context-menu'),
  floatAction: (action) => ipcRenderer.send('float-window-action', action),
  getPathForFile: (file) => file.path,
  resolveDroppedFiles: (paths) => ipcRenderer.invoke('float-drop-files', paths),
  openWithFiles: (files) => ipcRenderer.send('float-open-with-files', files),
  getFloatConfig: () => ipcRenderer.invoke('get-float-config'),
  onConfigChanged: (callback) => {
    configChangedCallback = callback;
  }
});