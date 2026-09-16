// 根目录文件监听（fs.watch 单实例）：事件白名单 + 忽略目录 + 100ms 防抖 + 1s 回声抑制

const fs = require('fs');
const path = require('path');

const DEBOUNCE_MS = 100;
const IGNORE_DIRS = ['.attachments', '.drafts', 'node_modules', '.git', '.idea', '.vscode'];
// fs.watch 只产出 change / rename（libuv 语义）
const EVENT_TYPES = ['change', 'rename'];
const SELF_WRITE_SUPPRESS_MS = 1000;
const FS_CHANGED_CHANNEL = 'notes-fs-changed';
const SENT_CACHE_MAX = 1000;

let watcher = null;
let watchedRoot = null;
let debounceTimer = null;
let targetWindow = null;
// 待推送：`${type}:${abs}` → { type, path }（100ms 内合并去重）
const pending = new Map();
// 已推送时刻：`${type}:${abs}` → timestamp（重复 / 回声抑制）
const recentlySent = new Map();

// 统一取错误文本（只用于日志）
function msgOf(err) {
  return err && err.message ? err.message : String(err || '');
}

// 只看上级目录段是否命中隐藏 / IGNORE_DIRS（rename 可能是文件或目录）
function shouldIgnore(absolutePath) {
  if (!absolutePath || !watchedRoot) return true;
  const rel = path.relative(watchedRoot, absolutePath);
  if (!rel || rel.startsWith('..')) return true;
  const segments = rel.split(/[\\/]+/).filter(Boolean);
  return segments.slice(0, -1).some((seg) => seg.startsWith('.') || IGNORE_DIRS.indexOf(seg) !== -1);
}

// 取可用目标 webContents；已销毁返回 null（不 send 就不会抛错）
function getTargetWebContents() {
  if (!targetWindow || targetWindow.isDestroyed()) return null;
  const contents = targetWindow.webContents;
  if (!contents || contents.isDestroyed()) return null;
  return contents;
}

// 防抖到期：pending 过滤后一次性推送
function flush() {
  debounceTimer = null;
  if (pending.size === 0) return;
  const events = Array.from(pending.values());
  pending.clear();
  const now = Date.now();
  const toSend = [];
  events.forEach((evt) => {
    const key = `${evt.type}:${evt.path}`;
    if (now - (recentlySent.get(key) || 0) < SELF_WRITE_SUPPRESS_MS) return;
    recentlySent.set(key, now);
    toSend.push(evt);
  });
  if (recentlySent.size > SENT_CACHE_MAX) {
    recentlySent.forEach((sentAt, key) => {
      if (now - sentAt >= SELF_WRITE_SUPPRESS_MS) recentlySent.delete(key);
    });
    if (recentlySent.size > SENT_CACHE_MAX) recentlySent.clear();
  }
  const contents = getTargetWebContents();
  if (!contents || toSend.length === 0) return;
  toSend.forEach((evt) => {
    contents.send(FS_CHANGED_CHANNEL, {
      type: evt.type,
      path: evt.path,
      rootPath: watchedRoot,
      timestamp: now,
    });
  });
}

// fs.watch 回调：白名单 → 忽略目录 → 入 pending → 重置防抖
function handleEvent(eventType, filename) {
  try {
    if (EVENT_TYPES.indexOf(eventType) === -1) return;
    const abs = filename ? path.resolve(watchedRoot, filename) : watchedRoot;
    if (shouldIgnore(abs)) return;
    pending.set(`${eventType}:${abs}`, { type: eventType, path: abs });
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, DEBOUNCE_MS);
  } catch (err) {
    console.error('[NotesWatcherService] handleEvent failed:', msgOf(err));
  }
}

// 优先 recursive；平台不支持时退化为只监听根目录一层
function createWatcher(rootPath) {
  try {
    return fs.watch(rootPath, { recursive: true }, handleEvent);
  } catch (err) {
    console.error('[NotesWatcherService] recursive watch unavailable, fallback:', msgOf(err));
    return fs.watch(rootPath, handleEvent);
  }
}

// 开始监听根目录（单实例；已在监听同根则幂等返回）
function startWatching(rootPath) {
  if (!rootPath || typeof rootPath !== 'string') return { success: false, error: '无效根目录' };
  try {
    if (isWatching() && getWatchedRoot() === rootPath) return { success: true };
    // 先校验再 stop：否则切到一个不存在的根会把当前正常工作的 watcher 一起停掉
    if (!fs.existsSync(rootPath)) return { success: false, error: '根目录不存在' };
    stopWatching();
    watchedRoot = rootPath;
    watcher = createWatcher(rootPath);
    watcher.on('error', (err) => {
      console.error('[NotesWatcherService] watcher error:', msgOf(err));
      stopWatching();
    });
    return { success: true };
  } catch (err) {
    console.error('[NotesWatcherService] startWatching failed:', msgOf(err));
    watcher = null;
    watchedRoot = null;
    return { success: false, error: msgOf(err) || '启动监听失败' };
  }
}

// 停止监听并清空缓存状态（幂等）
function stopWatching() {
  try {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    pending.clear();
    recentlySent.clear();
    if (watcher) watcher.close();
  } catch (err) {
    console.error('[NotesWatcherService] stopWatching failed:', msgOf(err));
  } finally {
    watcher = null;
    watchedRoot = null;
  }
  return { success: true };
}

function isWatching() {
  return !!watcher;
}

function getWatchedRoot() {
  return watchedRoot;
}

// 注入事件推送目标窗口；窗口 closed 时自停
function setTargetWindow(win) {
  targetWindow = win || null;
  if (!targetWindow) return;
  targetWindow.once('closed', () => {
    stopWatching();
    targetWindow = null;
  });
}

// 进程退出兜底清理（非主进程上下文静默跳过）
try {
  const electronApp = require('electron').app;
  if (electronApp && typeof electronApp.once === 'function') {
    electronApp.once('before-quit', () => stopWatching());
  }
} catch {
  /* ignore: 非主进程上下文 */
}

module.exports = {
  startWatching,
  stopWatching,
  isWatching,
  getWatchedRoot,
  setTargetWindow,
};
