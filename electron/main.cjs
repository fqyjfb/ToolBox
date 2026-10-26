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
const path = require('node:path');
const { getMimeType } = require('./services/fileTypeUtils.cjs');
const { stopPythonService } = require('./services/pythonProcessService.cjs');
const { registerOcrIpc } = require('./ipc/ocrIpc.cjs');
const { registerFileManagerIpc } = require('./ipc/fileManagerIpc.cjs');
const { registerSqliteIpc } = require('./ipc/sqliteIpc.cjs');
const { notifyReminder } = require('./services/reminderNotifier.cjs');
const { nextOccurrence } = require('./services/reminderRecurrence.cjs');
const { createWindow, registerIpcHandlers, startMemoryOptimization, stopMemoryOptimization, getMainWindow, setIsQuitting, cleanupQuickLaunchHotkeys } = require('./window/mainWindow.cjs');
const { createFloatWindow, registerFloatIpcHandlers } = require('./window/floatWindow.cjs');
const { createTray } = require('./window/tray.cjs');
const { registerLogIpcHandlers } = require('./logs/window.cjs');
const { initLogger } = require('./logs/logger.cjs');
const { loadSettings } = require('./lib/config.cjs');
const notesService = require('./services/notesService.cjs');
const sqliteService = require('./services/sqliteService.cjs');
const { checkLockOnStartup, registerLockIpcHandlers, createLockWindow } = require('./window/lockWindow.cjs');
const { registerQuickLoginIpcHandlers } = require('./window/quickLoginWindow.cjs');
const { registerOfflineToolsIpc } = require('./ipc/offlineToolsIpc.cjs');
const { registerReminderIpc } = require('./ipc/reminderIpc.cjs');
const { registerAIIpc } = require('./ipc/aiIpc.cjs');
const reminderScheduler = require('./services/reminderScheduler.cjs');
// 邮箱模块（emailIpc → emailService → nodemailer / imapflow / mailparser）不在顶层 require：
// 这三个依赖体积大、文件多，一旦打包后有文件缺失（磁盘坏块导致 npm 包文件损坏时就会发生），
// 顶层 require 会直接中断整个 main.cjs 的加载，导致进程存活但永远创建不出窗口。
// 改为在启动流程里延迟 require + 失败可跳过，最坏情况只是邮箱功能不可用。

const DELAY_CREATE_TRAY = 500;
const DELAY_CREATE_FLOAT_WINDOW = 1000;
// 提醒对账延后执行的兜底时限：主页面加载失败时 did-finish-load 永不触发，
// 仍需保证对账最终执行一次，不能因为窗口没加载出来就永久跳过。
const DELAY_RECONCILE_FALLBACK = 30000;

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

// 暴露渲染层 window.gc：仅「内存优化」开启时的定时清理会调用它，未开启时无任何调用、无副作用。
// 该开关必须在 app ready 前设置，运行时无法按设置动态开关。
app.commandLine.appendSwitch('js-flags', '--expose-gc');

/**
 * local-media 协议：流式返回本地文件（仅供 <img> 等小体积预览使用）。
 *
 * ⚠️ **不要把视频接回本协议**（含 Range / 分片逻辑）：
 *   - 实测 protocol.handle + Node 流桥接这条管线对大文件不可靠——
 *     400MB 级偶发卡死、1.37G 必然把整个应用拖崩（封顶分片也救不回来）。
 *   - 视频一律由渲染层直接用 `file:///` 地址播放（见 NotesEditor 的 videoFileUrl），
 *     Chromium 对 file:// 走原生文件管线：自有有界缓冲 + 原生 seek，不经过本协议。
 */
// local-media 仅允许访问「图标缓存目录」与「笔记根目录」文件，杜绝路径穿越
function resolveLocalMediaRoots() {
  const roots = [path.join(app.getPath('userData'), 'icon-cache')];
  try {
    // 笔记的三个根（主根 / 视图根 / 对话根）写在 <userData>/notes_settings.json，
    // 由 notesService 持有；这里必须复用同一份 getAllowedRoots，不能各自维护白名单——
    // 之前本函数改读 settings.json 的 notes_view_path（该文件从不写这个键），
    // 结果白名单退化成只剩 icon-cache，笔记里的图片全部被判越界返回 403，右侧一片空白。
    const notesRoots = notesService.getAllowedRoots();
    if (Array.isArray(notesRoots)) {
      for (const root of notesRoots) {
        if (root && typeof root === 'string') roots.push(path.resolve(root));
      }
    }
  } catch { /* ignore */ }
  try {
    // 兼容：settings.json 里若也配了笔记视图根，同样放行（历史配置，非主路径）
    const s = loadSettings() || {};
    const vp = s.notesViewPath || s.notes_view_path;
    if (vp) roots.push(path.resolve(vp));
  } catch { /* ignore */ }
  return roots;
}
function isLocalMediaAllowed(p) {
  const resolved = path.resolve(p);
  return resolveLocalMediaRoots().some(r => resolved === r || resolved.startsWith(r + path.sep));
}

async function handleLocalMediaRequest(request) {
  const url = new URL(request.url);
  const filePath = decodeURIComponent(url.pathname.slice(1));

  if (!isLocalMediaAllowed(filePath)) {
    return new Response('Forbidden', { status: 403 });
  }

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

// Windows 通知依赖 AppUserModelID：未设置时部分场景（托盘/任务栏分组、通知归属）
// 会异常。须早于任何窗口与通知的创建，值与 package.json 的 build.appId 保持一致。
// 注意：仅靠它无法解决「重启后系统提醒不弹出」——系统通知已改由
// services/reminderNotifier.cjs 用 node-notifier 呈现，失败回退弹窗。
//
// 只在打包后设置：开发态不存在与该 AUMID 匹配的快捷方式，Shell 在任务栏解析不到图标时
// 会弃用窗口 icon 直接回退到可执行文件图标（electron.exe 的 Electron 默认图标），
// 表现为「开发态任务栏显示 Electron 默认图标，而托盘/窗口标题栏图标正常」。
// 打包安装后快捷方式即携带该 AUMID，图标恢复正常，故此处不做其它补偿。
if (process.platform === 'win32' && app.isPackaged) {
  app.setAppUserModelId('com.toolbox.app');
}

const gotTheLock = app.requestSingleInstanceLock();

// 本次会话已弹出的提醒：冷启动参数路径与启动到期补偿扫描可能命中同一条，统一判重只弹一次。
// 判重键必须带上触发时间：应用点关闭只是隐藏窗口、进程常驻不退出，「关闭重开」并不会重置本集合，
// 只按 id 判重会让重新武装（改时间/重新启用）的提醒在同一进程里永远不再弹出。
const firedReminderKeysThisSession = new Set();

// 到期补偿宽限窗口：只补弹 24h 内错过的启用提醒，避免翻出陈旧记录
const CATCHUP_GRACE_MS = 24 * 60 * 60 * 1000;

// 提醒统一弹出入口：计划任务冷/热唤醒、启动到期补偿全部经此函数。
// 记录定位顺序：当前全局连接 → 遍历全部用户库定位归属库 → 触发索引兜底（记录已不在任何库）。
async function fireReminder(reminderId) {
  if (!reminderId) return;

  // 库按用户名分库：冷启动时全局连接尚未打开；热路径下也可能正指向其他用户库
  let reminder = null;
  try {
    reminder = sqliteService.get('reminders', reminderId);
  } catch {
    // 全局数据库尚未初始化
  }
  // 在当前全局连接里命中：它本就是归属库，可直接在此读写
  const inGlobalDb = !!reminder;

  let fromIndex = false;
  if (!reminder) {
    // 归属库未知：用独立连接逐库定位，绝不切走渲染进程正在用的全局连接
    const located = await sqliteService.findReminderInOwningDb(app.getPath('userData'), reminderId);
    if (located) reminder = located.reminder;
  }
  if (!reminder) {
    // 最后回退到注册任务时另存的触发索引
    reminder = reminderScheduler.getTriggerInfo(reminderId);
    fromIndex = true;
  }
  if (!reminder) {
    logFatal('[Main] fireReminder: 未找到提醒记录，已跳过:', reminderId);
    return;
  }

  // 同一触发时间只弹一次（冷启动参数与启动补偿会同时命中同一条）；
  // 提醒改时间后键随之变化，因此可以再次弹出。
  const firedKey = `${reminderId}@${reminder.remind_time || ''}`;
  if (firedReminderKeysThisSession.has(firedKey)) return;
  firedReminderKeysThisSession.add(firedKey);

  // 系统通知与独立弹窗统一走 reminderNotifier：
  // 系统通知失败时自动回退弹窗，提醒不会静默丢失
  await notifyReminder(reminder);

  // 记录已不在任何库（被删除或库不可读）：仅清理残留任务，不回写、不复活已删记录
  if (fromIndex) {
    await reminderScheduler.removeTask(reminderId);
    return;
  }

  // 一次性提醒：禁用并删除任务；重复提醒：推算下次时间并重建任务
  const now = new Date().toISOString();
  const isOneTime = reminder.repeat_type === 'none';
  const updated = isOneTime
    ? { ...reminder, id: reminderId, is_enabled: false, last_triggered_at: now }
    : { ...reminder, id: reminderId, remind_time: nextOccurrence(reminder.remind_time, reminder.repeat_type), last_triggered_at: now };

  if (inGlobalDb) {
    sqliteService.insert('reminders', updated);
    sqliteService.flushPersist();
  } else {
    await sqliteService.findReminderInOwningDb(app.getPath('userData'), reminderId, updated);
  }

  if (isOneTime) {
    await reminderScheduler.removeTask(reminderId);
  } else {
    await reminderScheduler.scheduleTask(updated);
  }
}

// 启动阶段唯一的计划任务对账 + 到期补偿，在创建任何窗口前完成：
// 遍历全部用户库得到权威白名单（不依赖渲染进程登录、不信任当前全局连接），
// 串行对账系统计划任务，再补弹宽限窗口内错过的提醒。任何一步失败只记日志，不阻断启动。
async function reconcileReminderTasks() {
  let byId;
  try {
    byId = await sqliteService.readAllReminders(app.getPath('userData'));
  } catch (err) {
    logFatal('[Main] 提醒全库汇总失败，已跳过本次对账:', err);
    return;
  }

  try {
    await reminderScheduler.reconcileTasks([...byId.values()]);
  } catch (err) {
    logFatal('[Main] 计划任务对账失败:', err);
  }

  const nowMs = Date.now();
  for (const reminder of byId.values()) {
    if (!reminder.is_enabled) continue;
    const remindMs = new Date(reminder.remind_time).getTime();
    if (Number.isNaN(remindMs) || remindMs > nowMs || nowMs - remindMs > CATCHUP_GRACE_MS) continue;
    // 本周期已触发过（last_triggered_at 不早于当前 remind_time）的不重复弹
    if (reminder.last_triggered_at
      && new Date(reminder.last_triggered_at).getTime() >= remindMs) continue;
    try {
      await fireReminder(reminder.id);
    } catch (err) {
      logFatal('[Main] 到期补偿触发失败:', err);
    }
  }
}

// 提取计划任务唤醒时携带的 --reminder=<id>
function getScheduledReminderId(argv) {
  if (!Array.isArray(argv)) return null;
  const arg = argv.find((a) => typeof a === 'string' && a.startsWith('--reminder='));
  return arg ? arg.slice('--reminder='.length) : null;
}

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const reminderId = getScheduledReminderId(argv);
    if (reminderId) {
      // 只发提醒本身：此处若 show()+focus() 主窗口会抢走焦点并盖住提醒。
      // fireReminder 内部会先定位提醒归属库再回写状态，避免写错当前连接的库。
      fireReminder(reminderId).catch((err) => logFatal('[Main] 热路径提醒触发失败:', err));
      return;
    }

    // 普通启动第二实例：唤醒主窗口（锁定态除外）
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

// 提醒对账（全库扫描 + 到期补偿 + 重新武装计划任务）的执行状态。
// 普通冷启动不阻塞建窗：等主窗口页面加载完成后再跑；但必须保证「最终一定跑一次」。
let reminderReconcileDone = false;
let reminderReconcileFallbackTimer = null;

function runReminderReconcile() {
  if (reminderReconcileDone) return Promise.resolve();
  reminderReconcileDone = true;
  if (reminderReconcileFallbackTimer) {
    clearTimeout(reminderReconcileFallbackTimer);
    reminderReconcileFallbackTimer = null;
  }
  return reconcileReminderTasks().catch((err) => logFatal('[Main] 提醒对账异常:', err));
}

function scheduleReminderReconcile() {
  if (reminderReconcileDone) return;
  if (!reminderReconcileFallbackTimer) {
    reminderReconcileFallbackTimer = setTimeout(() => { runReminderReconcile(); }, DELAY_RECONCILE_FALLBACK);
  }
}

function onWindowReady() {
  // 页面已加载完成，此时执行对账不再与首屏争抢（计划任务唤醒路径在启动时已同步跑过）
  runReminderReconcile();

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
  safeRegister('registerReminderIpc', registerReminderIpc);
  safeRegister('registerEmailIpc', () => require('./ipc/emailIpc.cjs').registerEmailIpc());
  safeRegister('registerAIIpc', registerAIIpc);
  safeRegister('registerIpcHandlers', registerIpcHandlers);

  // 计划任务唤醒的若是本实例（应用原先未运行），second-instance 事件不会触发，
  // 必须在此主动消费一次启动参数，否则提醒到时间毫无反应。
  const startupReminderId = getScheduledReminderId(process.argv);

  // 异步预热 sql.js WASM（不 await）：提醒对账要用到它，提前加载可省去延后执行时的等待。
  sqliteService.warmup().catch(() => { /* 预热失败不影响后续按需初始化 */ });

  if (startupReminderId) {
    // 由计划任务唤醒：保持「创建任何窗口前完成全库对账 + 到期补偿」的原语义，
    // 确保到期补偿先于下面的 fireReminder 兜底执行。失败只记日志，不阻断窗口创建。
    await runReminderReconcile();
  } else {
    // 普通冷启动：对账不再阻塞建窗（WASM 加载 + 全库扫描 + 每任务一次 schtasks），
    // 改为页面加载完成后由 onWindowReady 触发，并带兜底定时器防止页面加载失败时永久跳过。
    scheduleReminderReconcile();
  }

  let isLocked = false;
  try {
    isLocked = checkLockOnStartup();
  } catch (err) {
    logFatal('[Main] 锁定窗口创建失败，改为直接打开主窗口:', err);
  }

  if (!isLocked) {
    try {
      // 由计划任务唤醒的冷启动只呈现提醒本身，主窗口隐藏创建：
      // createWindow 的第二参数仅控制是否 show()，窗口本身照常创建，
      // 托盘、快捷键、自动锁定等初始化不受影响，用户可随时从托盘唤出主窗口。
      createWindow(onWindowReady, !startupReminderId);
    } catch (err) {
      logFatal('[Main] 主窗口创建失败:', err);
      showFatalDialog(`主窗口创建失败，应用即将退出：\n${err && err.message ? err.message : err}`);
      app.quit();
    }
  }

  if (startupReminderId) {
    // 不能等渲染进程的 sqlite:init：主窗口隐藏创建时页面被节流，初始化可能迟迟不发生。
    // 常规情况下该提醒已被上面的到期补偿扫描弹出，fireReminder 内部按「id + 触发时间」判重，
    // 不会重复弹；此处只兜底补偿未覆盖的场景（如记录不在任何库、仅存于触发索引）。
    fireReminder(startupReminderId)
      .catch((err) => logFatal('[Main] 冷启动提醒触发失败:', err));
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
    // 退出前补写落盘：写入走 2s 去抖，close() 只关闭连接不会触发去抖，
    // 不补这一步会丢掉最后 2s 内的写入。
    sqliteService.flushPersist();
  } catch (e) {
    console.error('[Main] SQLite 落盘失败:', e.message);
  }
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
