// 主进程全局异常兜底：记录日志后不退出，防止任意一处未捕获错误炸掉 Electron 主进程。
// 必须同时写 electron-log：打包后 console 输出不可见，只 console.error 会让
// 「进程还在、窗口没出来」这类启动期异常完全不留痕迹（app.log 里查不到）。
const log = require('electron-log');

function logFatal(tag, err) {
  console.error(tag, err);
  try {
    log.error(tag, err && err.stack ? err.stack : err);
  } catch {
    /* 日志系统自身不可用时绝不能二次抛出 */
  }
}

process.on('uncaughtException', (err) => {
  logFatal('[Main] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  logFatal('[Main] Unhandled Rejection:', reason);
});

const { app, protocol } = require('electron');
const fs = require('node:fs');
const { Readable } = require('node:stream');
const { getMimeType } = require('./services/fileTypeUtils.cjs');
const { stopPythonService } = require('./services/pythonProcessService.cjs');
const { registerOcrIpc } = require('./ipc/ocrIpc.cjs');
const { registerFileManagerIpc } = require('./ipc/fileManagerIpc.cjs');
const { registerSqliteIpc } = require('./ipc/sqliteIpc.cjs');
const { createWindow, registerIpcHandlers, startMemoryOptimization, stopMemoryOptimization, getMainWindow, setIsQuitting, cleanupQuickLaunchHotkeys } = require('./window/mainWindow.cjs');
const { createFloatWindow, registerFloatIpcHandlers } = require('./window/floatWindow.cjs');
const { createTray } = require('./window/tray.cjs');
const { registerLogIpcHandlers } = require('./logs/window.cjs');
const { initLogger } = require('./logs/logger.cjs');
const { loadSettings } = require('./lib/config.cjs');
const { sqliteService } = require('./services/sqliteService.cjs');
const { checkLockOnStartup, registerLockIpcHandlers, createLockWindow } = require('./window/lockWindow.cjs');
const { registerQuickLoginIpcHandlers } = require('./window/quickLoginWindow.cjs');
const { registerOfflineToolsIpc } = require('./ipc/offlineToolsIpc.cjs');
const { registerEmailIpc } = require('./ipc/emailIpc.cjs');

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

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

/**
 * local-media 协议：流式返回本地文件（仅供 <img> 等小体积预览使用）。
 *
 * ⚠️ **不要把视频接回本协议**（含 Range / 分片逻辑）：
 *   - 实测 protocol.handle + Node 流桥接这条管线对大文件不可靠——
 *     400MB 级偶发卡死、1.37G 必然把整个应用拖崩（封顶分片也救不回来）。
 *   - 视频一律由渲染层直接用 `file:///` 地址播放（见 NotesEditor 的 videoFileUrl），
 *     Chromium 对 file:// 走原生文件管线：自有有界缓冲 + 原生 seek，不经过本协议。
 */
async function handleLocalMediaRequest(request) {
  const url = new URL(request.url);
  const filePath = decodeURIComponent(url.pathname.slice(1));

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return new Response('Not a file', { status: 404 });

    const stream = Readable.toWeb(fs.createReadStream(filePath));
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(filePath),
        'Content-Length': String(stat.size),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    log.warn('[local-media] 读取失败:', filePath, error && error.message);
    return new Response('Not Found', { status: 404 });
  }
}

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
  setTimeout(() => createTray(), DELAY_CREATE_TRAY);

  setTimeout(() => {
    const settings = getCachedSettings();
    if (settings.isFloatWindowEnabled === 1) {
      createFloatWindow();
    }
  }, DELAY_CREATE_FLOAT_WINDOW);
}

app.whenReady().then(async () => {
  protocol.handle('local-media', handleLocalMediaRequest);

  initLogger();
  registerLockIpcHandlers();
  registerSqliteIpc();
  registerOcrIpc();
  registerFileManagerIpc();
  registerFloatIpcHandlers();
  registerLogIpcHandlers();
  registerQuickLoginIpcHandlers();
  registerOfflineToolsIpc();
  registerEmailIpc();
  registerIpcHandlers();

  const isLocked = checkLockOnStartup();
  if (!isLocked) {
    createWindow(onWindowReady, true);
  }
}).catch((err) => {
  logFatal('[Main] 初始化失败，窗口未创建:', err);
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
  cleanupQuickLaunchHotkeys();
  try {
    sqliteService.close();
  } catch (e) {
    console.error('[Main] SQLite 关闭失败:', e.message);
  }
  try {
    const emailIdle = require('./services/emailIdleService.cjs');
    const emailSvc = require('./services/emailService.cjs');
    if (typeof emailIdle.stopAll === 'function') emailIdle.stopAll();
    if (typeof emailSvc.disposePool === 'function') emailSvc.disposePool();
  } catch (e) {
    console.error('[Main] Email services shutdown failed:', e.message);
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
