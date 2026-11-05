// clipboardIpc —— 系统剪贴板监听/写入 IPC（从 pluginIpc.cjs 拆出，通道与行为完全一致）
// 自包含：watchers 表 + 3 个 clipboard:* 通道

const { ipcMain, clipboard, nativeImage } = require('electron');

// 系统级剪贴板监听：key = webContents.id，value = { timer, lastText }
// 让插件窗口在失焦/最小化时也能捕获系统剪贴板变化
const clipboardWatchers = new Map();

function stopClipboardWatcher(wcId) {
  const watcher = clipboardWatchers.get(wcId);
  if (!watcher) return;
  clearInterval(watcher.timer);
  clipboardWatchers.delete(wcId);
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
    let lastImgData = '';
    try { lastText = clipboard.readText() || ''; } catch { /* ignore */ }
    const timer = setInterval(() => {
      if (wc.isDestroyed()) { stopClipboardWatcher(wcId); return; }
      // 文本检测
      let text = '';
      try { text = clipboard.readText() || ''; } catch { return; }
      if (text && text !== lastText) {
        lastText = text;
        wc.send('clipboard:changed', text);
      }
      // 图片检测：截图等图片剪贴板内容，与文本检测不互斥（同一剪贴板可能文本+图片并存）
      try {
        const img = clipboard.readImage();
        if (!img.isEmpty()) {
          const dataUrl = img.toDataURL();
          if (dataUrl && dataUrl !== lastImgData) {
            lastImgData = dataUrl;
            wc.send('clipboard:image-changed', dataUrl);
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

module.exports = { registerClipboardIpc };
