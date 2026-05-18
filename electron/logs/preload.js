const { contextBridge, ipcRenderer } = require('electron');

let logsCallback = null;
let settingsCallback = null;

ipcRenderer.on('logs-updated', (event, logs) => {
  if (logsCallback) {
    logsCallback(logs);
  }
});

ipcRenderer.on('settings-updated', (event, settings) => {
  if (settingsCallback) {
    settingsCallback(settings);
  }
});

contextBridge.exposeInMainWorld('logAPI', {
  getLogs: () => ipcRenderer.invoke('log:getLogs'),
  getSettings: () => ipcRenderer.invoke('log:getSettings'),
  clearLogs: () => ipcRenderer.invoke('log:clearLogs'),
  exportLogs: () => ipcRenderer.invoke('log:exportLogs'),
  getStats: () => ipcRenderer.invoke('log:getStats'),
  refreshLogs: () => ipcRenderer.invoke('log:refreshLogs'),
  closeWindow: () => ipcRenderer.send('log:close'),
  onLogsUpdated: (callback) => {
    logsCallback = callback;
  },
  onSettingsUpdated: (callback) => {
    settingsCallback = callback;
  }
});
