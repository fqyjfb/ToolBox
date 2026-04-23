const { contextBridge, ipcRenderer } = require('electron');

let navigateCallback = null;
let downloadProgressCallback = null;

ipcRenderer.on('navigate-to', (event, path) => {
  if (navigateCallback) {
    navigateCallback(path);
  }
});

ipcRenderer.on('update-download-progress', (event, progress) => {
  if (downloadProgressCallback) {
    downloadProgressCallback(progress);
  }
});

contextBridge.exposeInMainWorld('electron', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  openInternal: (url) => ipcRenderer.send('open-internal', url),
  openFile: (path) => ipcRenderer.send('open-file', path),
  selectFile: () => ipcRenderer.invoke('select-file'),
  getFileIcon: (path) => ipcRenderer.invoke('get-file-icon', path),
  scanDesktopApps: () => ipcRenderer.invoke('scan-desktop-apps'),
  getAutostartStatus: () => ipcRenderer.invoke('get-autostart-status'),
  setAutostartStatus: (enable) => ipcRenderer.invoke('set-autostart-status', enable),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSetting: (setting) => ipcRenderer.invoke('update-setting', setting),
  clearCache: () => ipcRenderer.invoke('clear-cache'),
  getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
  updateShortcut: (shortcut) => ipcRenderer.invoke('update-shortcut', shortcut),
  getVersion: () => ipcRenderer.invoke('get-version'),
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  installUpdate: (filePath) => ipcRenderer.invoke('install-update', filePath),
  onDownloadProgress: (callback) => {
    downloadProgressCallback = callback;
  },
  onNavigate: (callback) => {
    navigateCallback = callback;
  }
});