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

// app 尚未 ready 就抛出的异常，说明是 main.cjs 模块加载阶段就炸了：
// 此时 app.whenReady() 里的所有逻辑都不会执行，主进程会静默空转（任务管理器有进程、桌面无窗口）。
// 这里给出可见提示并退出，避免留下「幽灵进程」。
function isDuringModuleLoad() {
  try {
    return !require('electron').app.isReady();
  } catch {
    return false;
  }
}

function showFatalDialog(detail) {
  try {
    require('electron').dialog.showErrorBox('ToolBox 启动失败', detail);
  } catch {
    /* 对话框都弹不出来时只保留日志，绝不能二次抛出 */
  }
}

process.on('uncaughtException', (err) => {
  logFatal('[Main] Uncaught Exception:', err);
  if (isDuringModuleLoad()) {
    showFatalDialog(`主进程加载失败，应用即将退出：\n${err && err.message ? err.message : err}`);
    try {
      require('electron').app.exit(1);
    } catch {
      process.exit(1);
    }
  }
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
// 邮箱模块（emailIpc → emailService → nodemailer / imapflow / mailparser）不在顶层 require：
// 这三个依赖体积大、文件多，一旦打包后有文件缺失（磁盘坏块导致 npm 包文件损坏时就会发生），
// 顶层 require 会直接中断整个 main.cjs 的加载，导致进程存活但永远创建不出窗口。
// 改为在启动流程里延迟 require + 失败可跳过，最坏情况只是邮箱功能不可用。

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

// 逐步注册：任何一步出错都只记日志并跳过，绝不能连带中断后面的主窗口创建。
function safeRegister(label, fn) {
  try {
    fn();
  } catch (err) {
    logFatal(`[Main] ${label} 失败，已跳过:`, err);
  }
}

app.whenReady().then(async () => {
  safeRegister('local-media 协议注册', () => protocol.handle('local-media', handleLocalMediaRequest));

  safeRegister('日志初始化', initLogger);
  safeRegister('registerLockIpcHandlers', registerLockIpcHandlers);
  safeRegister('registerSqliteIpc', registerSqliteIpc);
  safeRegister('registerOcrIpc', registerOcrIpc);
  safeRegister('registerFileManagerIpc', registerFileManagerIpc);
  safeRegister('registerFloatIpcHandlers', registerFloatIpcHandlers);
  safeRegister('registerLogIpcHandlers', registerLogIpcHandlers);
  safeRegister('registerQuickLoginIpcHandlers', registerQuickLoginIpcHandlers);
  safeRegister('registerOfflineToolsIpc', registerOfflineToolsIpc);
  safeRegister('registerEmailIpc', () => require('./ipc/emailIpc.cjs').registerEmailIpc());
  safeRegister('registerIpcHandlers', registerIpcHandlers);

  let isLocked = false;
  try {
    isLocked = checkLockOnStartup();
  } catch (err) {
    logFatal('[Main] 锁定窗口创建失败，改为直接打开主窗口:', err);
  }

  if (!isLocked) {
    try {
      createWindow(onWindowReady, true);
    } catch (err) {
      logFatal('[Main] 主窗口创建失败:', err);
      showFatalDialog(`主窗口创建失败，应用即将退出：\n${err && err.message ? err.message : err}`);
      app.quit();
    }
  }
}).catch((err) => {
  logFatal('[Main] 初始化失败，窗口未创建:', err);
  showFatalDialog(`初始化失败，应用即将退出：\n${err && err.message ? err.message : err}`);
  app.quit();
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
