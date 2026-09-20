const { contextBridge, ipcRenderer } = require('electron');

let configChangedCallback = null;
let appearanceChangedCallback = null;
let themeChangedCallback = null;

ipcRenderer.on('float-config-changed', (event, config) => {
  if (configChangedCallback) {
    configChangedCallback(config);
  }
});

ipcRenderer.on('appearance-changed', (event, data) => {
  if (appearanceChangedCallback) {
    appearanceChangedCallback(data);
  }
});

ipcRenderer.on('theme-changed', (event, data) => {
  if (themeChangedCallback) {
    themeChangedCallback(data);
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  dragStart: () => ipcRenderer.send('float-drag-start'),
  dragMove: () => ipcRenderer.send('float-drag-move'),
  dragEnd: () => ipcRenderer.send('float-drag-end'),
  showContextMenu: () => ipcRenderer.send('float-show-context-menu'),
  floatAction: (action) => ipcRenderer.send('float-window-action', action),
  getFloatConfig: () => ipcRenderer.invoke('get-float-config'),
  getFloatConfigWithIcons: () => ipcRenderer.invoke('get-float-config-with-icons'),
  setExpanded: (expanded) => ipcRenderer.send('float-expanded', expanded),
  onConfigChanged: (callback) => {
    configChangedCallback = callback;
  },
  getAppearance: () => ipcRenderer.invoke('float-get-appearance'),
  onAppearanceChanged: (callback) => {
    appearanceChangedCallback = callback;
  },
  getTheme: () => ipcRenderer.invoke('float-get-theme'),
  onThemeChanged: (callback) => {
    themeChangedCallback = callback;
  },
});
