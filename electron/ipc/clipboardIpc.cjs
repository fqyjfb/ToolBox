// clipboardIpc —— 系统剪贴板监听/写入 IPC（从 pluginIpc.cjs 拆出，通道与行为完全一致）
// 自包含：watchers 表 + 3 个 clipboard:* 通道

const { ipcMain, clipboard, nativeImage } = require('electron');

// 系统级剪贴板监听：key = webContents.id，value = { timer, lastText }
// 让插件窗口在失焦/最小化时也能捕获系统剪贴板变化
const clipboardWatchers = new Map();
// 主进程内部订阅者（悬浮球提示等）：复用同一个剪贴板检测，不新增常驻轮询
const textListeners = new Set();
let globalWatcher = null;

function notifyText(text) {
  textListeners.forEach((cb) => {
    try { cb(text); } catch (error) { console.error('[Clipboard] 订阅者处理失败:', error); }
  });
}

function stopClipboardWatcher(wcId) {
  const watcher = clipboardWatchers.get(wcId);
  if (!watcher) return;
  clearInterval(watcher.timer);
  clipboardWatchers.delete(wcId);
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
    // 指纹失败按「内容已变化」处理，保守降级，不影响正确性
    return `t${Date.now()}`;
  }
}

function registerClipboardIpc() {
  // 系统级剪贴板监听：主进程通过 Electron clipboard 模块轮询，失焦/最小化亦可捕获
  // 与 renderer 内 navigator.clipboard.readText() 不同，主进程不受窗口聚焦限制
  ipcMain.handle('clipboard:watch:start', (event, opts = {}) => {
    const wc = event.sender;
    const wcId = wc.id;
    if (clipboardWatchers.has(wcId)) return { success: true, active: true };
    const interval = Math.max(300, Number(opts?.interval) || 800);
    let lastText = '';
    let lastImgFp = '';
    try { lastText = clipboard.readText() || ''; } catch { /* ignore */ }
    const timer = setInterval(() => {
      if (wc.isDestroyed()) { stopClipboardWatcher(wcId); return; }
      // 文本检测
      let text = '';
      try { text = clipboard.readText() || ''; } catch { return; }
      if (text && text !== lastText) {
        lastText = text;
        wc.send('clipboard:changed', text);
        notifyText(text);
      }
      // 图片检测：截图等图片剪贴板内容，与文本检测不互斥（同一剪贴板可能文本+图片并存）
      // 先比廉价指纹，仅变化时才生成 dataURL（此前每 tick 无条件编码大 base64 字符串）
      try {
        const img = clipboard.readImage();
        if (!img.isEmpty()) {
          const fp = imageFingerprint(img);
          if (fp !== lastImgFp) {
            lastImgFp = fp;
            wc.send('clipboard:image-changed', img.toDataURL());
          }
        }
      } catch { /* ignore */ }
    }, interval);
    clipboardWatchers.set(wcId, { timer, lastText });
    wc.once('destroyed', () => stopClipboardWatcher(wcId));
    return { success: true };
  });

  ipcMain.handle('clipboard:watch:stop', (event) => {
    stopClipboardWatcher(event.sender.id);
    return { success: true };
  });

  // 主进程写入图片到剪贴板（绕过 navigator.clipboard.write 浏览器权限限制）
  // 注意：必须用 clipboard.write({ image }) 一次性原子写入；
  // 若先 writeImage 再 writeText，后一次调用会整体替换剪贴板内容，把图片清掉，导致外部粘贴为空
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
 * 只有订阅者存在时才启动一个共享 watcher；没有任何订阅时定时器立即释放。
 */
function subscribeClipboardText(callback) {
  if (typeof callback !== 'function') return () => {};
  textListeners.add(callback);
  if (!globalWatcher) {
    let lastText = '';
    try { lastText = clipboard.readText() || ''; } catch { /* ignore */ }
    const timer = setInterval(() => {
      let text = '';
      try { text = clipboard.readText() || ''; } catch { return; }
      if (text && text !== lastText) {
        lastText = text;
        notifyText(text);
      }
    }, 800);
    globalWatcher = { timer, lastText };
  }
  return () => {
    textListeners.delete(callback);
    if (textListeners.size === 0 && globalWatcher) {
      clearInterval(globalWatcher.timer);
      globalWatcher = null;
    }
  };
}

module.exports = { registerClipboardIpc, subscribeClipboardText };
