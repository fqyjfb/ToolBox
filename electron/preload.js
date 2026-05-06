const { contextBridge, ipcRenderer } = require('electron');

let navigateCallback = null;
let downloadProgressCallback = null;
let settingChangedCallback = null;

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

ipcRenderer.on('setting-changed', (event, setting) => {
  if (settingChangedCallback) {
    settingChangedCallback(setting);
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
  getDroppedFiles: (fileDataList) => ipcRenderer.invoke('get-dropped-files', fileDataList),
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
  toggleFloatWindow: () => ipcRenderer.invoke('toggle-float-window'),
  getFloatConfig: () => ipcRenderer.invoke('get-float-config'),
  updateFloatConfig: (config) => ipcRenderer.invoke('update-float-config', config),
  resetFloatConfig: () => ipcRenderer.invoke('reset-float-config'),
  onDownloadProgress: (callback) => {
    downloadProgressCallback = callback;
  },
  onNavigate: (callback) => {
    navigateCallback = callback;
  },
  onSettingChanged: (callback) => {
    settingChangedCallback = callback;
  }
});