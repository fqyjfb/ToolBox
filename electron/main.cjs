const { app, protocol, net } = require('electron');
const { pathToFileURL } = require('node:url');
const { stopPythonService } = require('./services/pythonProcessService.cjs');
const { registerOcrIpc } = require('./ipc/ocrIpc.cjs');
const { registerFileManagerIpc } = require('./ipc/fileManagerIpc.cjs');
const { registerSqliteIpc } = require('./ipc/sqliteIpc.cjs');
const { registerPluginIpc } = require('./ipc/pluginIpc.cjs');
const { createWindow, registerIpcHandlers, startMemoryOptimization, stopMemoryOptimization, getMainWindow, setIsQuitting } = require('./window/mainWindow.cjs');
const { createFloatWindow, registerFloatIpcHandlers } = require('./window/floatWindow.cjs');
const { createTray } = require('./window/tray.cjs');
const { registerLogIpcHandlers } = require('./logs/window.cjs');
const { initLogger } = require('./logs/logger.cjs');
const { loadSettings } = require('./lib/config.cjs');
const { sqliteService } = require('./services/sqliteService.cjs');
const { checkLockOnStartup, registerLockIpcHandlers, createLockWindow } = require('./window/lockWindow.cjs');

const DELAY_CREATE_TRAY = 500;
const DELAY_CREATE_FLOAT_WINDOW = 1000;

let cachedSettings = null;

function getCachedSettings() {
  if (!cachedSettings) {
    try {
      cachedSettings = loadSettings();
    } catch (error) {
      console.error('[Main] Failed to load settings:', error);
      cachedSettings = {};
    }
  }
  return cachedSettings;
}

function invalidateSettingsCache() {
  cachedSettings = null;
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const settings = getCachedSettings();
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

  setTimeout(() => createTray(), DELAY_CREATE_TRAY);

  setTimeout(() => {
    const settings = getCachedSettings();
    if (settings.isFloatWindowEnabled === 1) {
      createFloatWindow();
    }
  }, DELAY_CREATE_FLOAT_WINDOW);
}

app.whenReady().then(async () => {
  protocol.handle('local-media', (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname.slice(1));
    return net.fetch(pathToFileURL(filePath).toString());
  });

  initLogger();
  registerLockIpcHandlers();
  registerSqliteIpc();
  registerOcrIpc();
  registerFileManagerIpc();
  registerPluginIpc();
  registerFloatIpcHandlers();
  registerLogIpcHandlers();

  const isLocked = checkLockOnStartup();
  if (!isLocked) {
    createWindow(onWindowReady, true);
  }
});

app.on('activate', () => {
  const settings = getCachedSettings();
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
  setIsQuitting(true);
  stopBackendServices();
  stopMemoryOptimization();
  try {
    sqliteService.close();
  } catch (e) {
    console.error('[Main] SQLite 关闭失败:', e.message);
  }
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
