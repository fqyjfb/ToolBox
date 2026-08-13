const log = require('electron-log');
const path = require('path');
const fs = require('fs');

let logWindow = null;

const DEFAULT_SETTINGS = {
  enabled: true,
  maxEntries: 500,
  levels: {
    error: true,
    warn: true,
    info: false,
    debug: false
  },
  showTimestamp: true,
  autoClean: true
};

let settings = { ...DEFAULT_SETTINGS };
let logs = [];

function initLogger() {
  const userDataPath = require('electron').app.getPath('userData');
  const logDir = path.join(userDataPath, 'logs');
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  log.transports.file.resolvePath = () => path.join(logDir, 'app.log');
  log.transports.file.maxSize = 10 * 1024 * 1024;
  log.transports.file.maxFiles = 7;
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

  log.transports.console.format = '[{h}:{i}:{s}.{ms}] [{level}] {text}';

  log.info('[Logger] Logger initialized');

  try {
    const settingsPath = path.join(logDir, 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      settings = { ...settings, ...saved };
    }
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  const userDataPath = require('electron').app.getPath('userData');
  const logDir = path.join(userDataPath, 'logs');
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const settingsPath = path.join(logDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function addLog(level, message, context, stack) {
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    level: level || 'info',
    message: message || '',
    context: context || '',
    stack: stack || ''
  };

  logs.push(entry);

  if (settings.autoClean && logs.length > settings.maxEntries) {
    logs = logs.slice(-settings.maxEntries);
  }

  const levelMethods = {
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug'
  };
  const method = levelMethods[level] || 'info';
  const logMessage = context ? `[${context}] ${message}` : message;
  
  if (stack) {
    log[method](`${logMessage}\n${stack}`);
  } else {
    log[method](logMessage);
  }

  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('log:newEntry', entry);
  }
}

function getLogs() {
  return [...logs];
}

function clearLogs() {
  logs = [];
  
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('log:cleared');
  }
}

function getSettings() {
  return { ...settings };
}

function updateSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  saveSettings();
  
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.webContents.send('log:settingsUpdated', settings);
  }
  
  return { ...settings };
}

function exportLogs() {
  return JSON.stringify(logs, null, 2);
}

function getStats() {
  const stats = {
    total: logs.length,
    error: logs.filter(l => l.level === 'error').length,
    warn: logs.filter(l => l.level === 'warn').length,
    info: logs.filter(l => l.level === 'info').length,
    debug: logs.filter(l => l.level === 'debug').length
  };
  return stats;
}

function importLogs(jsonString) {
  try {
    const importedLogs = JSON.parse(jsonString);
    
    if (!Array.isArray(importedLogs)) {
      return false;
    }
    
    importedLogs.forEach(entry => {
      const normalizedEntry = {
        id: `imported_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: entry.timestamp || Date.now(),
        level: entry.level || 'info',
        message: entry.message || '',
        context: entry.context || '',
        stack: entry.stack || ''
      };
      logs.push(normalizedEntry);
    });
    
    if (settings.autoClean && logs.length > settings.maxEntries) {
      logs = logs.slice(-settings.maxEntries);
    }
    
    if (logWindow && !logWindow.isDestroyed()) {
      logWindow.webContents.send('log:cleared');
      logWindow.webContents.send('log:newEntry', ...logs.slice(-10));
    }
    
    return true;
  } catch {
    return false;
  }
}

function setLogWindow(window) {
  logWindow = window;
}

module.exports = {
  initLogger,
  addLog,
  getLogs,
  clearLogs,
  getSettings,
  updateSettings,
  exportLogs,
  getStats,
  setLogWindow,
  importLogs,
  log
};