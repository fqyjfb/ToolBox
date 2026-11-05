// screenshotIpc —— 截图/截图翻译 IPC（从 pluginIpc.cjs 拆出，通道与行为完全一致）
// pluginWindows 由 pluginIpc 注入（同一 Map 实例）：截图启动时隐藏插件窗口、结束时按可见性还原

const { ipcMain, dialog, screen, clipboard, nativeImage, BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { loadSettings } = require('../lib/config.cjs');

let preScreenshotBounds = null;
let preScreenshotAlwaysOnTop = false;
let preScreenshotMainVisible = false;
// 截图启动时主窗口是否处于边缘停靠态：停靠态的位置/置顶由停靠管理独占维护，截图结束后不回写
let preScreenshotMainDocked = false;
const preScreenshotVisiblePluginIds = new Set();
let screenshotOverlayWindow = null;

// 插件窗口表（由 pluginIpc 注入的同一 Map 实例）
let pluginWindowsRef = null;

async function startScreenshotCapture(options) {
  const mode = options && options.mode === 'translate' ? 'translate' : 'capture';
  // 翻译功能总开关：关闭时截图翻译入口直接退出，避免启动 OCR 服务
  if (mode === 'translate' && loadSettings().translateEnabled === 0) {
    return { success: false, error: '翻译功能已关闭' };
  }
  try {
    // OS 级全屏窗口只能落在单个显示器上：遮罩固定在鼠标所在屏
    const cursorDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const { bounds, scaleFactor, id } = cursorDisplay;

    const { getMainWindow, isWindowEdgeDocked } = require('../window/mainWindow.cjs');
    const mainWindow = getMainWindow();

    // 停靠态：位置与置顶由停靠管理独占维护（折叠位在屏幕外），这里只记可见性
    preScreenshotMainDocked = isWindowEdgeDocked();
    // 最小化窗口的 getBounds() 返回图标态坐标 (-32000,-32000)，绝不能作为还原依据
    const isMainRestorable = !!mainWindow && !mainWindow.isMinimized() && !preScreenshotMainDocked;
    preScreenshotBounds = isMainRestorable ? mainWindow.getBounds() : null;
    preScreenshotAlwaysOnTop = isMainRestorable ? mainWindow.isAlwaysOnTop() : false;
    preScreenshotMainVisible = !!mainWindow && !mainWindow.isMinimized() && mainWindow.isVisible();

    if (mainWindow) {
      // 停靠隐藏态的置顶由 edgeTopmost 维护，截图期间不能被摘掉
      if (isMainRestorable) mainWindow.setAlwaysOnTop(false);
      mainWindow.hide();
    }

    preScreenshotVisiblePluginIds.clear();
    pluginWindowsRef.forEach((window) => {
      if (!window.isDestroyed() && !window.isMinimized()) {
        if (window.isVisible()) preScreenshotVisiblePluginIds.add(window.id);
        window.hide();
      }
    });

    await new Promise(resolve => setTimeout(resolve, 300));

    const initScreenShot = require('../services/screenShotService.cjs').init;
    const screenShot = initScreenShot();
    const shotResult = await screenShot([{ id, bounds, scaleFactor }]);
    if (!shotResult.success) throw new Error(shotResult.error || '截图失败');
    const captureData = shotResult.captures;

    if (screenshotOverlayWindow && !screenshotOverlayWindow.isDestroyed()) {
      screenshotOverlayWindow.destroy();
    }

    // @deprecated 双倍冻结：插件 overlay 可用时由 resolvePluginOverlayFile 提供；
    // 不可用时（未安装/未升级/dist 缺失）回退到此内联 HTML，行为与改造前完全一致。
    const FALLBACK_OVERLAY_HTML = `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Screenshot Overlay</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; overflow: hidden; background: #000; }
          #bgBlock { position: absolute; top: 0; left: 0; }
          #bgBlock > img { position: absolute; top: 0; left: 0; pointer-events: none; }
          #selCanvas { position: absolute; top: 0; left: 0; z-index: 1; cursor: crosshair; }
          #sizeInfo {
            position: absolute; color: #fff; font-size: 12px;
            background: rgba(40,40,40,0.8); padding: 3px 8px; border-radius: 2px;
            font-family: Arial, sans-serif; display: none; z-index: 2; pointer-events: none;
          }
          #magnifier {
            position: absolute; width: 120px; height: 120px; border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.6); overflow: hidden;
            pointer-events: none; cursor: none; display: none; z-index: 3;
          }
          #magContent {
            position: absolute; width: 360px; height: 360px;
            background-repeat: no-repeat; pointer-events: none;
          }
          #magContent::after {
            content: ''; position: absolute; top: 50%; left: 0; width: 100%; height: 1px;
            background: rgba(255,255,255,0.4); z-index: 1;
          }
          #magContent::before {
            content: ''; position: absolute; left: 50%; top: 0; height: 100%; width: 1px;
            background: rgba(255,255,255,0.4); z-index: 1;
          }
          .toolbar {
            position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
            display: flex; gap: 8px; background: white; padding: 8px 16px;
            border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100;
          }
          .toolbar button { padding: 8px 16px; border: none; background: #f3f4f6; border-radius: 6px; cursor: pointer; font-size: 14px; color: #374151; }
          .toolbar button:hover { background: #e5e7eb; }
          .toolbar button.primary { background: #3b82f6; color: white; }
          .toolbar button.primary:hover { background: #2563eb; }
        </style>
      </head>
      <body>
        <div id="bgBlock"><img id="bgImg" style="position:absolute;top:0;left:0;pointer-events:none;"></div>
        <canvas id="selCanvas"></canvas>
        <div id="sizeInfo"></div>
        <div id="magnifier"><div id="magContent"></div></div>
        <script>
          (function() {
            let capture = null;
            let mode = 'capture';

            window.electron?.screenshot?.onData?.((data) => {
              capture = data.capture;
              mode = data.mode || 'capture';

              const overlayWidth  = capture.width;
              const overlayHeight = capture.height;

              const bgImg       = document.getElementById('bgImg');
              bgImg.style.width  = overlayWidth + 'px';
              bgImg.style.height = overlayHeight + 'px';
              const selCanvas   = document.getElementById('selCanvas');
              const selCtx      = selCanvas.getContext('2d');
              const sizeInfo    = document.getElementById('sizeInfo');
              const magnifier   = document.getElementById('magnifier');
              const magContent  = document.getElementById('magContent');
              selCanvas.width  = overlayWidth;
              selCanvas.height = overlayHeight;

              const bgCanvas = document.createElement('canvas');
              bgCanvas.width  = overlayWidth;
              bgCanvas.height = overlayHeight;
              const bgCtx = bgCanvas.getContext('2d');

              const bgImage = new Image();
              bgImage.onload = () => {
                bgCtx.drawImage(bgImage, 0, 0, overlayWidth, overlayHeight);
                selCtx.drawImage(bgCanvas, 0, 0);
                bgImg.src = capture.dataUrl;
                initMagnifier();
              };
              bgImage.src = capture.dataUrl;

              function initMagnifier() {
                const ZOOM = 3;
                const bgBlock = document.getElementById('bgBlock');
                const clone = bgBlock.cloneNode(true);
                clone.style.zoom           = ZOOM;
                clone.style.width          = (overlayWidth  * ZOOM) + 'px';
                clone.style.height         = (overlayHeight * ZOOM) + 'px';
                clone.style.position       = 'absolute';
                clone.getElementsByTagName('img')[0].removeAttribute('class');
                magContent.appendChild(clone);
                bgBlock.appendChild(magnifier);
              }

              let isDrawing = false;
              let startX = 0, startY = 0;
              let magReady = false;

              document.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startX = e.pageX;
                startY = e.pageY;
                isDrawing = true;
              });

              document.addEventListener('mousemove', (e) => {
                e.preventDefault();
                if (!isDrawing) return;

                const cx = e.pageX, cy = e.pageY;
                const w = cx - startX, h = cy - startY;
                const absW = Math.abs(w), absH = Math.abs(h);
                const left = w < 0 ? cx : startX;
                const top  = h < 0 ? cy : startY;

                selCtx.clearRect(0, 0, selCanvas.width, selCanvas.height);
                selCtx.drawImage(bgCanvas, 0, 0);
                selCtx.fillStyle = 'rgba(35,113,248,0.18)';
                selCtx.fillRect(left, top, absW, absH);
                selCtx.strokeStyle = '#2371F8';
                selCtx.lineWidth = 1;
                selCtx.strokeRect(left, top, absW, absH);

                sizeInfo.style.display = 'block';
                sizeInfo.style.left = left + 'px';
                sizeInfo.style.top  = (top - 24) + 'px';
                sizeInfo.textContent = absW + ' × ' + absH;

                if (magReady) {
                  magnifier.style.display = 'block';
                  magnifier.style.left = (-60 + e.pageX) + 'px';
                  magnifier.style.top  = (-60 + e.pageY) + 'px';
                  magContent.style.left = ((e.pageX - magnifier.offsetLeft) / 3 - e.pageX) + 'px';
                  magContent.style.top  = ((e.pageY - magnifier.offsetTop)  / 3 - e.pageY) + 'px';
                }
              });

              document.addEventListener('mouseup', (e) => {
                if (!isDrawing) return;
                isDrawing = false;
                magReady = true;
                sizeInfo.style.display = 'none';

                if (mode !== 'translate') {
                  magnifier.style.display = 'none';
                }

                const w = e.pageX - startX, h = e.pageY - startY;
                const absW = Math.abs(w), absH = Math.abs(h);
                const left = w < 0 ? e.pageX : startX;
                const top  = h < 0 ? e.pageY : startY;

                if (mode === 'translate' && absW > 5 && absH > 5) {
                  const imgData = bgCtx.getImageData(left, top, absW, absH);
                  const outCanvas = document.createElement('canvas');
                  outCanvas.width  = absW;
                  outCanvas.height = absH;
                  outCanvas.getContext('2d').putImageData(imgData, 0, 0);
                  window.electron?.screenshot?.translate?.(outCanvas.toDataURL());
                }
              });

              document.addEventListener('mouseleave', () => {
                magnifier.style.display = 'none';
              });

              document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                  window.electron?.screenshot?.cancel?.();
                  return;
                }
                if (!e.repeat && (e.key === 't' || e.key === 'T')) {
                  const dataUrl = selCanvas.toDataURL('image/png');
                  window.electron?.screenshot?.translate?.(dataUrl);
                }
              });

              if (mode !== 'translate') {
                const toolbar = document.createElement('div');
                toolbar.className = 'toolbar';

                const fullBtn  = document.createElement('button');
                fullBtn.textContent = '全屏';
                toolbar.appendChild(fullBtn);

                const translateBtn = document.createElement('button');
                translateBtn.textContent = '翻译 (T)';
                translateBtn.className = 'primary';
                toolbar.appendChild(translateBtn);

                const copyBtn    = document.createElement('button');
                copyBtn.textContent = '复制';
                toolbar.appendChild(copyBtn);

                const saveBtn    = document.createElement('button');
                saveBtn.textContent = '保存';
                toolbar.appendChild(saveBtn);

                const cancelBtn  = document.createElement('button');
                cancelBtn.textContent = '取消';
                toolbar.appendChild(cancelBtn);

                document.body.appendChild(toolbar);

                fullBtn.addEventListener('click', () => {
                  window.electron?.screenshot?.translate?.(bgCanvas.toDataURL('image/png'));
                });

                translateBtn.addEventListener('click', () => {
                  window.electron?.screenshot?.translate?.(bgCanvas.toDataURL('image/png'));
                });

                copyBtn.addEventListener('click', () => {
                  window.electron?.screenshot?.copyToClipboard?.(bgCanvas.toDataURL('image/png'));
                  window.electron?.screenshot?.complete?.();
                });

                saveBtn.addEventListener('click', () => {
                  window.electron?.screenshot?.save?.({ buffer: bgCanvas.toDataURL('image/png'), format: 'png' });
                  window.electron?.screenshot?.complete?.();
                });

                cancelBtn.addEventListener('click', () => {
                  window.electron?.screenshot?.cancel?.();
                });
              }
            });
          })();
        <\/script>
      </body>
      </html>
    `;

    screenshotOverlayWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      fullscreenable: true,
      movable: false,
      enableLargerThanScreen: true,
      transparent: false,
      backgroundColor: '#000000',
      skipTaskbar: true,
      resizable: false,
      maximizable: false,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    // Esc 退出兜底（主进程层拦截）：全局快捷键（Alt+W）触发截图时，Windows 下遮罩窗可能
    // 未真正获得键盘焦点，页面内的 document keydown 收不到事件，可选链会静默吞掉退出请求。
    // before-input-event 在 webContents 层触发，不依赖页面 DOM 焦点，保证 Esc 一定可退出。
    // 页面内的 Esc 监听保留（preventDefault 后不会再触发，二者互不冲突）。
    screenshotOverlayWindow.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.key === 'Escape') {
        event.preventDefault();
        restoreAfterScreenshot({ showMain: true });
      }
    });

    // 优先加载插件 overlay；不存在时回退到冻结的内联 HTML（截图翻译零回归保底）。
    const pluginOverlay = resolvePluginOverlayFile();
    if (pluginOverlay) {
      screenshotOverlayWindow.loadFile(pluginOverlay);
    } else {
      screenshotOverlayWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(FALLBACK_OVERLAY_HTML)}`
      );
    }

    // 页面加载完成后立即显示并进入 OS 级全屏，随后通过 IPC 发送截图数据，避免超长 data URL 嵌入 HTML
    screenshotOverlayWindow.webContents.once('did-finish-load', () => {
      const win = screenshotOverlayWindow;
      if (!win || win.isDestroyed() || win.isVisible()) return;
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.show();
      win.setSimpleFullScreen(true);
      win.focus();
      // 通过 IPC 将截图数据异步注入渲染进程，渲染进程收到后渲染选区 UI
      win.webContents.send('screenshot:data', { capture: captureData[0], mode });
    });

    // 兜底：页面加载失败时关闭遮罩并恢复主窗口
    screenshotOverlayWindow.webContents.once('did-fail-load', (_event, errorCode, errorDesc) => {
      console.error('[Screenshot] overlay did-fail-load:', errorCode, errorDesc);
      restoreAfterScreenshot();
    });

  } catch (error) {
    console.error('[Screenshot] startScreenshotCapture failed:', error.message);
    restoreAfterScreenshot();
    return { success: false, error: error.message };
  }
}

/** 结束截图会话：退出全屏 → 关闭遮罩 → 还原截图前可见的主窗口 / 插件窗口；翻译流程用 showInactive 避免抢焦点 */
function restoreAfterScreenshot({ showMain = true } = {}) {
  const overlay = screenshotOverlayWindow;
  if (overlay && !overlay.isDestroyed()) {
    // 先退出全屏再关闭，防止 Windows 残留全屏状态
    try { overlay.setSimpleFullScreen(false); } catch { /* 全屏状态已丢失时忽略 */ }
    overlay.close();
  }
  screenshotOverlayWindow = null;

  const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
  if (mainWindow) {
    // 停靠态的位置/置顶由停靠管理独占维护，截图结束不回写，否则会被还原到屏幕外的折叠位
    if (!preScreenshotMainDocked) {
      if (preScreenshotBounds) mainWindow.setBounds(preScreenshotBounds);
      mainWindow.setAlwaysOnTop(preScreenshotAlwaysOnTop);
    }
    // 截图前主窗口不可见（托盘 / Win+D 桌面态）时保持隐藏，避免误弹出；
    // 停靠态必须原样显示回去：pollEdgeWindowState 有 isVisible() 守卫，不显示则停靠永不展开
    if (preScreenshotMainVisible) {
      if (showMain) mainWindow.show();
      else mainWindow.showInactive();
    }
  }
  pluginWindowsRef.forEach((window) => {
    if (window.isDestroyed()) return;
    // 仅恢复截图前可见的插件窗口
    if (preScreenshotVisiblePluginIds.has(window.id)) {
      if (showMain) window.show();
      else window.showInactive();
    }
  });
}

/**
 * 探测已安装插件中是否有声明 overlay 字段的截图插件，返回 overlay.html 的绝对路径。
 * 任意异常均返回 null，调用方回退到内联 HTML。
 */
function resolvePluginOverlayFile() {
  try {
    const dir = path.join(app.getPath('userData'), 'extensions');
    if (!fs.existsSync(dir)) return null;
    for (const id of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!id.isDirectory()) continue;
      const mfPath = path.join(dir, id.name, 'manifest.json');
      if (!fs.existsSync(mfPath)) continue;
      const mf = JSON.parse(fs.readFileSync(mfPath, 'utf-8'));
      if (!mf.overlay) continue;
      const html = path.join(dir, id.name, mf.overlay);
      if (fs.existsSync(html)) return html;
    }
    // 开发期：直连 plugins-store 源码目录（仅 !app.isPackaged 时启用）
    if (!app.isPackaged) {
      const dev = path.resolve(__dirname, '../../../plugins-store/Screenshot-plugin/dist/overlay.html');
      if (fs.existsSync(dev)) return dev;
    }
  } catch (e) {
    console.warn('[Screenshot] overlay resolve failed, fallback:', e.message);
  }
  return null;
}

function registerScreenshotIpc({ pluginWindows }) {
  // 注入插件窗口表引用（与 pluginIpc.cjs 共享同一 Map 实例）
  pluginWindowsRef = pluginWindows;

  ipcMain.handle('start-screenshot-capture', () => {
    if (loadSettings().isLockEnabled === 1) return { success: false, error: '应用已锁定' };
    return startScreenshotCapture();
  });

  // 截图翻译：结束选区 → OCR → 按设置后处理文本 → 打开翻译浮层（失败时用浮层展示错误）
  ipcMain.handle('screenshot:translate', async (_event, dataUrl) => {
    // 翻译场景不应把主窗口拉出来，showInactive 只恢复遮罩和插件窗口
    restoreAfterScreenshot({ showMain: false });
    try {
      const settings = loadSettings();
      const { recognizeBase64 } = require('../services/ocrService.cjs');
      const { showTranslateWindow } = require('../window/translateWindow.cjs');
      const result = await recognizeBase64(dataUrl);

      if (!result.success || !result.text) {
        const error = result.error || '未识别到文字，请调整选区后重试';
        showTranslateWindow({ text: '', autoTranslate: false, trigger: 'screenshot', error });
        return { success: false, error };
      }

      let text = result.text;
      if (settings.translateOcrWrapReplaceSpace === 1) text = text.replace(/\r?\n/g, ' ');
      else if (settings.translateOcrWrapRemove === 1) text = text.replace(/\r?\n/g, '');
      text = text.trim();

      if (settings.translateOcrWriteClipboard === 1) clipboard.writeText(text);

      showTranslateWindow({ text, autoTranslate: true, trigger: 'screenshot' });
      return { success: true, text };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('cancel-screenshot', () => restoreAfterScreenshot({ showMain: true }));

  ipcMain.on('screenshot-session-complete', () => restoreAfterScreenshot({ showMain: true }));

  ipcMain.handle('save-screenshot', async (_event, data) => {
    const { buffer, format, destinationPath } = data;

    const base64Data = buffer.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    let savePath = destinationPath;

    if (!savePath) {
      // 遮罩窗是 screen-saver 级置顶的全屏窗口：仅改透明度没有用，必须从 OS z-order 摘掉
      // （hide）。另外 Windows 的原生对话框不会自己置顶，需要一个可见且置顶的 owner，
      // 否则会落到其它窗口之后。截图期间 mainWindow 始终是隐藏的（见 startScreenshotCapture），
      // 因此这里临时唤回它当 owner，对话框结束后再退回隐藏态。
      const overlay = screenshotOverlayWindow;
      const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
      const mainWasVisible = !!mainWindow && mainWindow.isVisible();
      try {
        if (overlay && !overlay.isDestroyed()) {
          overlay.setAlwaysOnTop(false);
          overlay.hide();
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWasVisible) mainWindow.show();
          mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
          mainWindow.focus();
        }

        const result = await dialog.showSaveDialog(mainWindow || undefined, {
          title: 'Save Screenshot',
          defaultPath: path.join(app.getPath('desktop'), `Screenshot_${Date.now()}.${format}`),
          filters: [
            { name: 'Images', extensions: [format] }
          ]
        });

        if (result.canceled || !result.filePath) return { success: false, reason: 'cancelled' };
        savePath = result.filePath;
      } finally {
        // mainWindow 退回截图期间的隐藏态与截图前的置顶级别
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (!mainWasVisible) mainWindow.hide();
          mainWindow.setAlwaysOnTop(preScreenshotAlwaysOnTop);
        }
        // 遮罩窗重新升权并恢复全屏态
        if (overlay && !overlay.isDestroyed()) {
          overlay.setSimpleFullScreen(true);
          overlay.setAlwaysOnTop(true, 'screen-saver', 1);
          overlay.show();
          overlay.focus();
        }
      }
    }

    try {
      await fs.promises.writeFile(savePath, imageBuffer);
      return { success: true, path: savePath };
    } catch (e) {
      return { success: false, reason: String(e) };
    }
  });

  ipcMain.on('copy-screenshot-to-clipboard', (_event, dataUrl) => {
    const img = nativeImage.createFromDataURL(dataUrl);
    clipboard.writeImage(img);
  });
}

module.exports = { registerScreenshotIpc, startScreenshotCapture };
