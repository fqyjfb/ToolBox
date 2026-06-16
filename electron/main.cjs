const { app } = require('electron');
const { stopPythonService } = require('./services/pythonProcessService.cjs');
const { registerOcrIpc } = require('./ipc/ocrIpc.cjs');
const { registerFileManagerIpc } = require('./ipc/fileManagerIpc.cjs');
const { createWindow, registerIpcHandlers, startMemoryOptimization, stopMemoryOptimization, getMainWindow } = require('./window/mainWindow.cjs');
const { createFloatWindow, registerFloatIpcHandlers } = require('./window/floatWindow.cjs');
const { createTray } = require('./window/tray.cjs');
const { registerLogIpcHandlers } = require('./logs/window.cjs');
const { initLogger } = require('./logs/logger.cjs');
const { loadSettings } = require('./lib/config.cjs');
const { checkLockOnStartup, registerLockIpcHandlers, createLockWindow } = require('./window/lockWindow.cjs');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const settings = loadSettings();
    if (settings.isLockEnabled === 1) {
      require('./window/lockWindow.cjs').toggleLock();
      return;
    }
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function stopBackendServices() {
  try {
    await stopPythonService();
    console.log('[Main] Python 服务已停止');
  } catch (error) {
    console.warn('[Main] Python 服务停止异常:', error);
  }
}

function onWindowReady() {
  registerIpcHandlers();
  registerOcrIpc();
  registerFileManagerIpc();
  registerFloatIpcHandlers();
  registerLogIpcHandlers();
  registerLockIpcHandlers();

  setTimeout(() => createTray(), 500);

  setTimeout(() => {
    const settings = loadSettings();
    if (settings.isFloatWindowEnabled === 1) {
      createFloatWindow();
    }
  }, 1000);
}

app.whenReady().then(async () => {
  initLogger();
  registerLockIpcHandlers();

  const isLocked = checkLockOnStartup();
  if (!isLocked) {
    createWindow(onWindowReady, true);
  }
});

app.on('activate', () => {
  const settings = loadSettings();
  if (settings.isLockEnabled === 1) {
    require('./window/lockWindow.cjs').toggleLock();
    return;
  }
  if (getMainWindow()) {
    getMainWindow().show();
  } else {
    createWindow(onWindowReady, true);
  }
});

app.on('before-quit', () => {
  stopBackendServices();
  stopMemoryOptimization();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

module.exports = {
  startMemoryOptimization,
  createWindowOnUnlock: () => {
    if (!getMainWindow()) {
      createWindow(onWindowReady, true);
    } else {
      getMainWindow().show();
      getMainWindow().focus();
    }
  },
};
