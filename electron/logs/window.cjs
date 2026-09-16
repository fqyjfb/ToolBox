const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const {
  addLog,
  getLogs,
  clearLogs,
  getSettings,
  updateSettings,
  exportLogs,
  getStats,
  setLogWindow,
  importLogs
} = require('./logger.cjs');

let logWindow = null;
let logIpcHandlersRegistered = false;

function createLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.show();
    logWindow.focus();
    return;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  logWindow = new BrowserWindow({
    width: Math.min(900, width - 40),
    height: Math.min(600, height - 80),
    minWidth: 600,
    minHeight: 400,
    title: '日志监控',
    icon: path.join(__dirname, '../../public/favicon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  logWindow.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}?standalone=logs#/logs`);

  logWindow.once('ready-to-show', () => {
    logWindow.show();
  });

  logWindow.on('closed', () => {
    logWindow = null;
    setLogWindow(null);
  });

  setLogWindow(logWindow);
}

function registerLogIpcHandlers() {
  if (logIpcHandlersRegistered) return;
  logIpcHandlersRegistered = true;
  
  ipcMain.on('log:open', () => {
    createLogWindow();
  });

  ipcMain.on('log:minimize', () => {
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.minimize();
    }
  });

  ipcMain.on('log:close', () => {
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.close();
    }
  });

  ipcMain.handle('log:addLog', (event, { level, message, context, stack }) => {
    addLog(level, message, context, stack);
  });

  ipcMain.handle('log:getLogs', () => {
    return getLogs();
  });

  ipcMain.handle('log:getSettings', () => {
    return getSettings();
  });

  ipcMain.handle('log:updateSettings', (event, newSettings) => {
    return updateSettings(newSettings);
  });

  ipcMain.handle('log:clearLogs', () => {
    clearLogs();
  });

  ipcMain.handle('log:exportLogs', () => {
    return exportLogs();
  });

  ipcMain.handle('log:getStats', () => {
    return getStats();
  });

  ipcMain.handle('log:importLogs', (event, jsonString) => {
    return importLogs(jsonString);
  });
}

function openLogWindow() {
  createLogWindow();
}

module.exports = {
  registerLogIpcHandlers,
  openLogWindow
};