// clipboardIpc —— 系统剪贴板监听/写入 IPC（从 pluginIpc.cjs 拆出，通道与行为完全一致）
// 自包含：watchers 表 + 3 个 clipboard:* 通道
// 采样策略：所有消费者共享一个定时器，按活跃 watcher 的最短间隔调度

const { ipcMain, clipboard } = require('electron');

// 活跃消费者：key = webContents.id，value = { interval, webContents }
const clipboardWatchers = new Map();
// 主进程内部订阅者（悬浮球提示等）
const textListeners = new Set();

// 共享采样状态
let sharedTimer = null;
let sharedLastText = '';
let sharedLastImgFp = '';

// ── 内部事件分发 ──

function notifyText(text) {
  textListeners.forEach((cb) => {
    try { cb(text); } catch (error) { console.error('[Clipboard] 订阅者处理失败:', error); }
  });
}

// 计算当前消费者中最短间隔（内部订阅固定 800ms）
function getMinInterval() {
  let min = Infinity;
  for (const w of clipboardWatchers.values()) {
    if (w.interval < min) min = w.interval;
  }
  if (textListeners.size > 0) min = Math.min(min, 800);
  return Number.isFinite(min) ? min : 0;
}

function stopSharedTimer() {
  if (sharedTimer) {
    clearInterval(sharedTimer);
    sharedTimer = null;
  }
}

// 图片廉价指纹：尺寸 + 位图长度 + 步进采样哈希。
// 轮询每 300–800ms 一次，此前每 tick 都无条件 toDataURL()（大 base64 字符串），
// 截图驻留剪贴板时 GC 压力大；先比指纹，仅变化时才编码 dataURL。
function imageFingerprint(img) {
  try {
    const { width, height } = img.getSize();
    if (!width || !height) return 'empty';
    const bitmap = img.toBitmap();
    let h = 2166136261;
    const step = Math.max(1, Math.floor(bitmap.length / 16384));
    for (let i = 0; i < bitmap.length; i += step * 4) {
      h ^= bitmap[i];
      h = Math.imul(h, 16777619);
    }
    return `${width}x${height}:${bitmap.length}:${h >>> 0}`;
  } catch {
    return `t${Date.now()}`;
  }
}

// 启动 / 重排共享定时器：由消费者增删触发；只有存在消费者时才运行
function rescheduleSharedTimer() {
  const interval = getMinInterval();
  if (interval === 0) { stopSharedTimer(); return; }
  if (sharedTimer) {
    clearInterval(sharedTimer);
    sharedTimer = null;
  }
  try { sharedLastText = clipboard.readText() || ''; } catch { /* ignore */ }
  sharedTimer = setInterval(() => {
    // 文本采样：读一次，分发给所有 watcher + 内部订阅
    let text = '';
    try { text = clipboard.readText() || ''; } catch { return; }
    if (text && text !== sharedLastText) {
      sharedLastText = text;
      for (const [wcId, w] of clipboardWatchers) {
        const wc = w.webContents;
        if (!wc || wc.isDestroyed()) {
          clipboardWatchers.delete(wcId);
          continue;
        }
        wc.send('clipboard:changed', text);
      }
      notifyText(text);
    }
    // 图片采样：仅在存在 watcher 时才执行，内部纯文本订阅不承担图片成本
    if (clipboardWatchers.size > 0) {
      try {
        const img = clipboard.readImage();
        if (!img.isEmpty()) {
          const fp = imageFingerprint(img);
          if (fp !== sharedLastImgFp) {
            sharedLastImgFp = fp;
            const dataUrl = img.toDataURL();
            for (const [wcId, w] of clipboardWatchers) {
              const wc = w.webContents;
              if (!wc || wc.isDestroyed()) {
                clipboardWatchers.delete(wcId);
                continue;
              }
              wc.send('clipboard:image-changed', dataUrl);
            }
          }
        }
      } catch { /* ignore */ }
    }
  }, interval);
  if (sharedTimer.unref) sharedTimer.unref();
}

// 移除一个窗口 watcher（只清 entry，reschedule 处理停表）
function stopClipboardWatcher(wcId) {
  if (!clipboardWatchers.has(wcId)) return;
  clipboardWatchers.delete(wcId);
  rescheduleSharedTimer();
}

// ── 公开 IPC 注册 ──

function registerClipboardIpc() {
  ipcMain.handle('clipboard:watch:start', (event, opts = {}) => {
    const wc = event.sender;
    const wcId = wc.id;
    if (clipboardWatchers.has(wcId)) return { success: true, active: true };
    const interval = Math.max(300, Number(opts?.interval) || 800);
    clipboardWatchers.set(wcId, { interval, webContents: wc });
    wc.once('destroyed', () => stopClipboardWatcher(wcId));
    rescheduleSharedTimer();
    return { success: true };
  });

  ipcMain.handle('clipboard:watch:stop', (event) => {
    stopClipboardWatcher(event.sender.id);
    return { success: true };
  });

  // 主进程写入图片到剪贴板（绕过 navigator.clipboard.write 浏览器权限限制）
  // 注意：必须用 clipboard.write({ image }) 一次性原子写入；
  // 若先 writeImage 再 writeText，后一次调用会整体替换剪贴板内容，把图片清掉，导致外部粘贴为空
  const { nativeImage } = require('electron');
  ipcMain.handle('clipboard:writeImage', (_event, dataUrl) => {
    try {
      const img = nativeImage.createFromDataURL(dataUrl);
      if (img.isEmpty()) return { success: false, reason: 'invalid image dataUrl' };
      clipboard.write({ image: img });
      return { success: true };
    } catch (e) {
      return { success: false, reason: String(e) };
    }
  });
}

/**
 * 供主进程内部功能订阅文本变化。返回退订函数。
 * 与窗口 watcher 共用同一个共享采样器，不新增常驻轮询。
 */
function subscribeClipboardText(callback) {
  if (typeof callback !== 'function') return () => {};
  textListeners.add(callback);
  rescheduleSharedTimer();
  return () => {
    textListeners.delete(callback);
    rescheduleSharedTimer();
  };
}

module.exports = { registerClipboardIpc, subscribeClipboardText };
