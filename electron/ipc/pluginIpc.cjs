const { ipcMain, dialog, screen, clipboard, nativeImage, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { getMimeType } = require('../services/fileTypeUtils.cjs');
// 安装成功后把插件图标落盘到本地缓存，保证已安装插件的图标展示不再依赖网络
const { cachePluginIcon, resolveIconUrls, isDarkTheme, loadSettings } = require('../lib/config.cjs');
const { getAppIcon } = require('../lib/appIcon.cjs');
const { hasLocalPluginIcon } = require('../lib/pluginLocalIcons.cjs');
const { isRunning, terminate: stopOcrService } = require('../services/ocrService.cjs');

let pluginIpcRegistered = false;
const { app } = require('electron');

let preScreenshotBounds = null;
let preScreenshotAlwaysOnTop = false;
let preScreenshotMainVisible = false;
// 截图启动时主窗口是否处于边缘停靠态：停靠态的位置/置顶由停靠管理独占维护，截图结束后不回写
let preScreenshotMainDocked = false;
const preScreenshotVisiblePluginIds = new Set();
const pluginWindows = new Map();
let screenshotOverlayWindow = null;

const S3_CLIENTS = new Map();
const MAX_S3_CLIENTS = 5;

// 系统级剪贴板监听：key = webContents.id，value = { timer, lastText }
// 让插件窗口在失焦/最小化时也能捕获系统剪贴板变化
const clipboardWatchers = new Map();

function stopClipboardWatcher(wcId) {
  const watcher = clipboardWatchers.get(wcId);
  if (!watcher) return;
  clearInterval(watcher.timer);
  clipboardWatchers.delete(wcId);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEndpoint(endpoint) {
  if (!endpoint) return '';
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    return `https://${endpoint}`;
  }
  return endpoint;
}

function getS3Client(config) {
  const key = `${config.endpoint}-${config.accessKeyId}`;
  if (S3_CLIENTS.has(key)) {
    return S3_CLIENTS.get(key);
  }

  if (S3_CLIENTS.size >= MAX_S3_CLIENTS) {
    const firstKey = S3_CLIENTS.keys().next().value;
    if (firstKey) S3_CLIENTS.delete(firstKey);
  }

  const { S3Client } = require('@aws-sdk/client-s3');
  const normalizedEndpoint = normalizeEndpoint(config.endpoint);
  const region = config.region || 'us-east-1';
  
  const client = new S3Client({
    region: region,
    endpoint: normalizedEndpoint || undefined,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
    tls: normalizedEndpoint?.includes('localhost') && normalizedEndpoint?.startsWith('http:') ? false : true,
    signingRegion: region,
    signingName: 's3',
  });
  
  S3_CLIENTS.set(key, { client, config });
  return { client, config };
}

const EXTENSIONS_DIR = path.join(app.getPath('userData'), 'extensions');
const CONFIG_FILE = path.join(app.getPath('userData'), 'extensions-config.json');

const GITHUB_MIRRORS = [
  'https://hub.fastgit.xyz',
  'https://gh.fastgit.org',
  'https://github.com',
];

const GITHUB_RELEASE_MIRRORS = [
  'https://github.com',
  'https://hub.fastgit.xyz',
  'https://gh.fastgit.org',
];

async function downloadReleaseZip(url, targetDir, onProgress) {
  const { createWriteStream, unlinkSync, existsSync, mkdirSync } = require('fs');
  const { https } = require('follow-redirects');
  const AdmZip = require('adm-zip');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const zipPath = path.join(targetDir, 'plugin.zip');
  
  async function tryDownload(mirrorUrl) {
    const mirroredUrl = url.replace('https://github.com', mirrorUrl);
    return new Promise((resolve, reject) => {
      https.get(mirroredUrl, { timeout: 30000 }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10) || 0;
        let downloadedSize = 0;
        
        onProgress?.({
          status: 'downloading',
          message: '正在下载...',
          progress: 0,
          mirror: mirrorUrl
        });

        const file = createWriteStream(zipPath);
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            const speed = (downloadedSize / 1024 / 1024).toFixed(2);
            onProgress?.({
              status: 'downloading',
              message: `正在下载... ${speed}MB`,
              progress,
              mirror: mirrorUrl
            });
          }
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(true));
        });
        file.on('error', reject);
      }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
    });
  }

  for (const mirror of GITHUB_RELEASE_MIRRORS) {
    try {
      await tryDownload(mirror);
      onProgress?.({
        status: 'extracting',
        message: '正在解压...',
        progress: 95,
        mirror: mirror
      });
      
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(targetDir, true);
      unlinkSync(zipPath);
      onProgress?.({
        status: 'installing',
        message: '正在安装...',
        progress: 98,
        mirror: mirror
      });
      return;
    } catch (error) {
      console.warn(`Failed to download from ${mirror}:`, error.message);
    }
  }

  throw new Error('Failed to download plugin from all mirrors');
}

async function executeGitClone(mirrorUrl, targetDir, depth = true) {
  return new Promise((resolve, reject) => {
    const { execFile } = require('child_process');
    const args = depth ? ['clone', '--depth=1', mirrorUrl, targetDir] : ['clone', mirrorUrl, targetDir];
    execFile('git', args, { timeout: 60000 }, (error) => {
      if (error) reject(error);
      else resolve(null);
    });
  });
}

async function gitCloneWithRetry(repoUrl, targetDir) {
  const originalUrl = repoUrl;
  let lastError = null;

  for (const mirror of GITHUB_MIRRORS) {
    let mirrorUrl = originalUrl;
    if (originalUrl.startsWith('https://github.com/')) {
      mirrorUrl = mirror + originalUrl.slice('https://github.com'.length);
    } else if (originalUrl.startsWith('git@github.com:')) {
      mirrorUrl = mirror + '/' + originalUrl.slice('git@github.com:'.length);
    }

    console.log(`Trying to clone from: ${mirrorUrl}`);

    try {
      await executeGitClone(mirrorUrl, targetDir, true);
      console.log(`Successfully cloned from: ${mirrorUrl}`);
      return true;
    } catch (error) {
      lastError = error;
      console.warn(`Shallow clone failed from ${mirrorUrl}: ${error.message}`);
      if (fs.existsSync(targetDir)) {
        try {
          await fs.promises.rm(targetDir, { recursive: true, force: true });
        } catch { /* ignore */ }
      }

      try {
        await executeGitClone(mirrorUrl, targetDir, false);
        console.log(`Successfully cloned (full) from: ${mirrorUrl}`);
        return true;
      } catch (fullError) {
        console.warn(`Full clone also failed from ${mirrorUrl}: ${fullError.message}`);
        if (fs.existsSync(targetDir)) {
          try {
            await fs.promises.rm(targetDir, { recursive: true, force: true });
          } catch { /* ignore */ }
        }
      }
    }
  }

  throw lastError || new Error('All GitHub mirrors failed');
}

function getExtensionsDir() {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });
  }
  return EXTENSIONS_DIR;
}

async function openPluginWindow(pluginId, userId) {
  try {
    const existingWindow = pluginWindows.get(pluginId);
    if (existingWindow && !existingWindow.isDestroyed()) {
      if (existingWindow.isMinimized()) {
        existingWindow.restore();
      }
      existingWindow.show();
      existingWindow.focus();
      return { success: true };
    }

    const extensionsDir = getExtensionsDir();
    const pluginDir = path.join(extensionsDir, pluginId);
    const manifestPath = path.join(pluginDir, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: 'Plugin not found' };
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const entryPath = path.join(pluginDir, manifest.entry || 'dist/index.js');

    if (!fs.existsSync(entryPath)) {
      return { success: false, error: 'Plugin entry not found' };
    }

    const pluginWindow = new BrowserWindow({
      width: manifest.width || 800,
      height: manifest.height || 600,
      minWidth: 400,
      minHeight: 300,
      // 会出现在任务栏（skipTaskbar: false），必须带应用图标，否则显示 Electron 默认图标
      icon: getAppIcon(),
      frame: false,
      transparent: false,
      alwaysOnTop: true,
      modal: false,
      resizable: true,
      skipTaskbar: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, '../preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    pluginWindow.on('ready-to-show', () => {
      pluginWindow.show();
      pluginWindow.focus();
      setTimeout(() => {
        pluginWindow.setAlwaysOnTop(false);
      }, 500);
    });

    pluginWindows.set(pluginId, pluginWindow);

    const entryUrl = pathToFileURL(entryPath).href;
    
    // systemTheme: 'dark' | 'light' | 'system'；自定义主题仍以其明暗基色写入该字段
    const isDark = isDarkTheme();

    const escapedName = escapeHtml(manifest.name);
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN"${isDark ? ' class="dark"' : ''}>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${escapedName}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              darkMode: 'class',
              theme: {
                extend: {
                  colors: {
                    primary: '#059669',
                    'bg-primary': '#059669',
                  }
                }
              }
            }
          </script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; overflow: hidden; }
            .plugin-header { height: 40px; background: #f3f4f6; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; -webkit-app-region: drag; }
            .dark .plugin-header { background: #1f2937; border-bottom-color: #374151; }
            .plugin-header-title { font-size: 14px; font-weight: 500; color: #374151; }
            .dark .plugin-header-title { color: #e5e7eb; }
            .plugin-header-controls { display: flex; gap: 8px; -webkit-app-region: no-drag; }
            .plugin-header-controls button { background: none; border: none; cursor: pointer; padding: 6px; color: #6b7280; border-radius: 6px; transition-all duration-300; }
            .plugin-header-controls button:hover { color: #374151; background: #e5e7eb; }
            .dark .plugin-header-controls button:hover { color: #f3f4f6; background: #374151; }
            .plugin-header-controls button.close-btn:hover { color: #dc2626; background: #fee2e2; }
            .dark .plugin-header-controls button.close-btn:hover { color: #f87171; background: #7f1d1d; }
            .plugin-content { height: calc(100vh - 40px); overflow-y: auto; }
            .error-panel { padding: 20px; background: #fef2f2; color: #b91c1c; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
            #root { height: 100%; }
          </style>
        </head>
        <body class="${isDark ? 'dark' : ''}">
          <div class="plugin-header">
            <span class="plugin-header-title">${escapedName}</span>
            <div class="plugin-header-controls">
              <button onclick="window.electron?.plugin?.minimizeWindow()" title="最小化">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"></path></svg>
              </button>
              <button onclick="window.electron?.plugin?.maximizeWindow()" title="最大化">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect></svg>
              </button>
              <button class="close-btn" onclick="window.electron?.plugin?.closeWindow()" title="关闭">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"></path><path d="M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
          <div class="plugin-content">
            <div id="root"></div>
          </div>
          <div id="error-panel"></div>
          <script>
            window.__PLUGIN_DATA__ = ${JSON.stringify({ pluginId, pluginName: manifest.name, manifest, isDark, pluginDir, userId: userId || null })};
            
            window.onerror = function(message, source, lineno, colno, error) {
              var panel = document.getElementById('error-panel');
              if (panel) {
                panel.className = 'error-panel';
                panel.innerHTML += 'Error: ' + message + '<br>Source: ' + source + '<br>Line: ' + lineno + '<br><br>';
              }
              console.error('Plugin error:', message, source, lineno, error);
              return true;
            };
            
            window.addEventListener('error', function(e) {
              var panel = document.getElementById('error-panel');
              if (panel) {
                panel.className = 'error-panel';
                panel.innerHTML += 'Error Event: ' + e.message + '<br>';
              }
              console.error('Plugin error event:', e);
            });
          </script>
          <script>
            try {
              var script = document.createElement('script');
              script.src = ${JSON.stringify(entryUrl)};
              script.onload = function() {
                console.log('Plugin script loaded successfully');
              };
              script.onerror = function() {
                var panel = document.getElementById('error-panel');
                if (panel) {
                  panel.className = 'error-panel';
                  panel.innerHTML = 'Failed to load plugin script: ' + script.src;
                }
                console.error('Failed to load plugin script:', script.src);
              };
              document.body.appendChild(script);
            } catch (e) {
              var panel = document.getElementById('error-panel');
              if (panel) {
                panel.className = 'error-panel';
                panel.innerHTML = 'Error loading plugin: ' + e.message;
              }
              console.error('Error loading plugin:', e);
            }
          </script>
        </body>
        </html>
      `;

    const tempHtmlPath = path.join(pluginDir, 'plugin-window.html');
    fs.writeFileSync(tempHtmlPath, htmlContent);
    
    pluginWindow.loadFile(tempHtmlPath);

    pluginWindow.on('closed', () => {
      pluginWindows.delete(pluginId);
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch { /* ignore */ }
}

// 后台补齐已安装插件的本地图标缓存（best-effort，失败不影响列表返回）
function cacheInstalledPluginIcons(plugins) {
  try {
    const urls = (plugins || [])
      // 已有本地图标的插件显示时用包内文件，再预取远程图标只会白下载一份，
      // 还会让设置页「插件图标缓存」一直统计着这些永远不会被显示的图标
      .filter((plugin) => !hasLocalPluginIcon(plugin?.id, plugin?.iconUrl))
      .map((plugin) => plugin?.iconUrl)
      .filter((url) => typeof url === 'string' && url.startsWith('http'));
    if (urls.length > 0) {
      resolveIconUrls(urls, 'plugin');
    }
  } catch { /* ignore */ }
}

/**
 * 启动全屏截图选区（窗口内入口与截图翻译共用）。
 * options.mode：'capture'（默认，手动点按钮）/ 'translate'（截图翻译，松开鼠标即 OCR+翻译，
 * 对齐 TTime 的交互：框选结束自动触发，无需再点按钮）。
 * 成功返回 { success: true, captures }，失败返回 { success: false, error }。
 */
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
    pluginWindows.forEach((window) => {
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
        </script>
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
  pluginWindows.forEach((window) => {
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
    const dir = EXTENSIONS_DIR;
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

function registerPluginIpc() {
  if (pluginIpcRegistered) return;
  pluginIpcRegistered = true;

  ipcMain.handle('plugin:get-available', async () => {
    try {
      const config = loadConfig();
      let registry = { plugins: [] };
      try {
        registry = require('../../registry.json');
      } catch {
        console.warn('registry.json not found, using empty registry');
      }
      const installed = await ipcMain.invoke('plugin:get-installed');
      const installedIds = new Set(installed.map(p => p.id));
      
      return registry.plugins.map(plugin => ({
        ...plugin,
        installed: installedIds.has(plugin.id),
        enabled: config[plugin.id]?.enabled ?? true
      }));
    } catch (error) {
      console.error('Failed to get available plugins:', error);
      return [];
    }
  });

  ipcMain.handle('plugin:get-installed', async () => {
    try {
      const extensionsDir = getExtensionsDir();
      const config = loadConfig();
      const plugins = [];
      
      if (fs.existsSync(extensionsDir)) {
        const entries = fs.readdirSync(extensionsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const manifestPath = path.join(extensionsDir, entry.name, 'manifest.json');
            if (fs.existsSync(manifestPath)) {
              try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
                const pluginId = manifest.id || entry.name;
                plugins.push({
                  id: pluginId,
                  name: manifest.name || entry.name,
                  version: manifest.version || '1.0.0',
                  installedVersion: manifest.version || '1.0.0',
                  description: manifest.description || '',
                  icon: manifest.icon || 'Package',
                  iconName: manifest.icon || 'Package',
                  iconUrl: manifest.iconUrl || undefined,
                  image: manifest.image || undefined,
                  color: manifest.color || '#3b82f6',
                  textColor: manifest.textColor || '#ffffff',
                  author: manifest.author || 'Unknown',
                  categories: manifest.categories || [],
                  path: `/tools/${pluginId}`,
                  tags: manifest.tags || [],
                  githubRepo: manifest.githubRepo || undefined,
                  entry: manifest.entry || 'dist/index.js',
                  isBeta: manifest.isBeta === true,
                  enabled: config[pluginId]?.enabled ?? true,
                  installDate: config[pluginId]?.installDate || Date.now(),
                  isPinned: config[pluginId]?.isPinned === true,
                });
              } catch (e) {
                console.warn(`Invalid manifest for ${entry.name}:`, e);
              }
            }
          }
        }
      }

      // 补齐尚未落盘的图标（如升级前安装的插件）：已缓存的会直接跳过，不会产生重复下载
      cacheInstalledPluginIcons(plugins);

      return plugins;
    } catch (error) {
      console.error('Failed to get installed plugins:', error);
      return [];
    }
  });

  async function fetchReleaseUrlFromGithub(repo) {
  const https = require('follow-redirects').https;
  const mirrors = ['https://api.github.com'];
  
  for (const mirror of mirrors) {
    try {
      const url = `${mirror}/repos/${repo}/releases/latest`;
      const data = await new Promise((resolve, reject) => {
        https.get(url, { timeout: 15000 }, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          let body = '';
          res.on('data', (chunk) => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
          res.on('error', reject);
        }).on('timeout', () => reject(new Error('Timeout')));
      });
      
      const assets = data.assets || [];
      const zipAsset = assets.find(a => a.name.endsWith('.zip')) || assets[0];
      if (zipAsset?.browser_download_url) {
        return zipAsset.browser_download_url;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

ipcMain.handle('plugin:install', async (event, { pluginId, repo, releaseUrl }) => {
    const extensionsDir = getExtensionsDir();
    const pluginDir = path.join(extensionsDir, pluginId);

    try {
      // 覆盖安装/升级 orc-plugin 前先停止共用引擎，避免模型缓存被占用
      if (pluginId === 'plugin-orc' && isRunning()) {
        await stopOcrService();
      }

      if (fs.existsSync(pluginDir)) {
        await fs.promises.rm(pluginDir, { recursive: true, force: true });
      }

      const sendProgress = (progress) => {
        event.sender.send('plugin:install-progress', { pluginId, ...progress });
      };

      if (!releaseUrl && repo) {
        sendProgress({
          status: 'starting',
          message: '获取插件版本信息...',
          progress: 0
        });

        releaseUrl = await fetchReleaseUrlFromGithub(repo);

        if (!releaseUrl) {
          return { success: false, error: '无法获取插件发布版本，请检查网络连接或插件仓库是否已发布 Release' };
        }
      }

      if (!releaseUrl) {
        return { success: false, error: '插件暂未发布可用版本' };
      }

      sendProgress({
        status: 'starting',
        message: '准备安装...',
        progress: 0
      });

      await downloadReleaseZip(releaseUrl, pluginDir, sendProgress);

      const config = loadConfig();
      config[pluginId] = { enabled: true };
      saveConfig(config);

      cachePluginIcon(pluginDir);

      sendProgress({
        status: 'completed',
        message: '安装完成',
        progress: 100
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to install plugin:', error);
      try {
        if (fs.existsSync(pluginDir)) {
          await fs.promises.rm(pluginDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup plugin directory:', cleanupError);
      }
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:uninstall', async (_event, pluginId) => {
    try {
      const extensionsDir = getExtensionsDir();
      const pluginDir = path.join(extensionsDir, pluginId);

      // 卸载 orc-plugin 前先停止共用引擎，避免模型缓存被占用
      if (pluginId === 'plugin-orc' && isRunning()) {
        await stopOcrService();
      }

      if (fs.existsSync(pluginDir)) {
        await fs.promises.rm(pluginDir, { recursive: true, force: true });
      }

      const config = loadConfig();
      delete config[pluginId];
      saveConfig(config);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:toggle-enabled', async (_event, { pluginId, enabled }) => {
    try {
      const config = loadConfig();
      config[pluginId] = { enabled };
      saveConfig(config);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:install-from-file', async () => {
    try {
      const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
      const result = await dialog.showOpenDialog(mainWindow, {
        filters: [{ name: 'Plugin Files', extensions: ['zip'] }],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths.length) {
        return { success: false, error: 'No file selected' };
      }

      const zipPath = result.filePaths[0];
      const extensionsDir = getExtensionsDir();
      const pluginId = path.basename(zipPath, '.zip');
      const pluginDir = path.join(extensionsDir, pluginId);

      if (!fs.existsSync(pluginDir)) {
        await fs.promises.mkdir(pluginDir, { recursive: true });
      }

      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(pluginDir, true);

      const config = loadConfig();
      config[pluginId] = { enabled: true };
      saveConfig(config);

      cachePluginIcon(pluginDir);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:install-from-path', async (_event, filePath) => {
    try {
      const extensionsDir = getExtensionsDir();
      const pluginId = path.basename(filePath);
      const pluginDir = path.join(extensionsDir, pluginId);

      if (fs.existsSync(pluginDir)) {
        await fs.promises.rm(pluginDir, { recursive: true, force: true });
      }

      await fs.promises.cp(filePath, pluginDir, { recursive: true });

      const config = loadConfig();
      config[pluginId] = { enabled: true };
      saveConfig(config);

      cachePluginIcon(pluginDir);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:install-from-github', async (_event, { id, repo }) => {
    try {
      const extensionsDir = getExtensionsDir();
      const pluginDir = path.join(extensionsDir, id);
      
      if (fs.existsSync(pluginDir)) {
        await fs.promises.rm(pluginDir, { recursive: true, force: true });
      }
      
      const fullRepoUrl = repo.startsWith('http') ? repo : `https://github.com/${repo}`;
      
      await gitCloneWithRetry(fullRepoUrl, pluginDir);

      const config = loadConfig();
      config[id] = { enabled: true };
      saveConfig(config);

      cachePluginIcon(pluginDir);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:open-extensions-dir', async () => {
    try {
      const extensionsDir = getExtensionsDir();
      await require('electron').shell.openPath(extensionsDir);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:open-window', async (_event, { pluginId, userId }) => {
    return openPluginWindow(pluginId, userId);
  });

  ipcMain.on('plugin-window-minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.minimize();
  });

  ipcMain.on('plugin-window-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    }
  });

  ipcMain.on('plugin-window-close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.close();
  });

  ipcMain.handle('plugin:save-file', async (_event, { path: filePath, data }) => {
    try {
      await fs.promises.writeFile(filePath, data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 锁屏守卫：与 translateScreenshot / showTranslateWindow 一致。
  // 全屏遮罩是最高层级窗口，不守卫会直接盖住锁屏窗口
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

  ipcMain.handle('s3:listBuckets', async (_event, config) => {
    try {
      console.log('[S3 Proxy] listBuckets called with config:', {
        endpoint: config.endpoint,
        region: config.region,
        accessKeyId: config.accessKeyId?.substring?.(0, 8) + '...',
        bucketName: config.bucketName
      });
      
      const { client } = getS3Client(config);
      const { ListBucketsCommand } = require('@aws-sdk/client-s3');
      const command = new ListBucketsCommand({});
      const response = await client.send(command);
      
      console.log('[S3 Proxy] listBuckets success:', response.Buckets?.length || 0, 'buckets');
      return {
        success: true,
        data: (response.Buckets || []).map(b => ({
          name: b.Name || 'Unknown',
          creationDate: b.CreationDate
        }))
      };
    } catch (error) {
      console.error('[S3 Proxy] listBuckets error:', error);
      return { 
        success: false, 
        error: error.message, 
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2) 
      };
    }
  });

  ipcMain.handle('s3:listFiles', async (_event, { config, prefix }) => {
    try {
      console.log('[S3 Proxy] listFiles called:', { bucket: config.bucketName, prefix });
      const { client } = getS3Client(config);
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      let isTruncated = true;
      let continuationToken;
      const allFiles = [];

      while (isTruncated) {
        const command = new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix || '',
          Delimiter: '/',
          ContinuationToken: continuationToken,
        });

        const response = await client.send(command);

        if (response.CommonPrefixes) {
          response.CommonPrefixes.forEach((p) => {
            if (p.Prefix) {
              const exists = allFiles.some(f => f.key === p.Prefix);
              if (!exists) {
                allFiles.push({
                  key: p.Prefix,
                  name: p.Prefix.replace(prefix || '', '').replace('/', ''),
                  size: 0,
                  lastModified: new Date(),
                  isFolder: true,
                });
              }
            }
          });
        }

        if (response.Contents) {
          response.Contents.forEach((c) => {
            if (c.Key && c.Key !== prefix) {
              allFiles.push({
                key: c.Key,
                name: c.Key.replace(prefix || '', ''),
                size: c.Size || 0,
                lastModified: c.LastModified || new Date(),
                isFolder: false,
                mimeType: getMimeType(c.Key),
              });
            }
          });
        }

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
      }

      console.log('[S3 Proxy] listFiles success:', allFiles.length, 'files');
      return {
        success: true,
        data: allFiles.sort((a, b) => {
          if (a.isFolder === b.isFolder) {
            return a.name.localeCompare(b.name);
          }
          return a.isFolder ? -1 : 1;
        })
      };
    } catch (error) {
      console.error('[S3 Proxy] listFiles error:', error);
      return { 
        success: false, 
        error: error.message, 
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2) 
      };
    }
  });

  ipcMain.handle('s3:getObject', async (_event, { config, key }) => {
    try {
      console.log('[S3 Proxy] getObject called:', { bucket: config.bucketName, key });
      const { client } = getS3Client(config);
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const command = new GetObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      const response = await client.send(command);
      if (response.Body) {
        const byteArray = await response.Body.transformToByteArray();
        console.log('[S3 Proxy] getObject success:', byteArray.length, 'bytes');
        return {
          success: true,
          data: byteArray.buffer,
          contentType: response.ContentType || 'application/octet-stream'
        };
      }
      return { success: false, error: 'No body in response', name: 'Error' };
    } catch (error) {
      console.error('[S3 Proxy] getObject error:', error);
      return { 
        success: false, 
        error: error.message, 
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2) 
      };
    }
  });

  ipcMain.handle('s3:putObject', async (_event, { config, key, body, contentType }) => {
    try {
      console.log('[S3 Proxy] putObject called:', { bucket: config.bucketName, key, contentType });
      const { client } = getS3Client(config);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: typeof body === 'string' ? body : Buffer.from(body),
        ContentType: contentType || 'text/plain',
      });
      await client.send(command);
      console.log('[S3 Proxy] putObject success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] putObject error:', error);
      return { 
        success: false, 
        error: error.message, 
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2) 
      };
    }
  });

  ipcMain.handle('s3:deleteObject', async (_event, { config, key }) => {
    try {
      console.log('[S3 Proxy] deleteObject called:', { bucket: config.bucketName, key });
      const { client } = getS3Client(config);
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      });
      await client.send(command);
      console.log('[S3 Proxy] deleteObject success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] deleteObject error:', error);
      return { 
        success: false, 
        error: error.message, 
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2) 
      };
    }
  });

  ipcMain.handle('s3:deleteObjects', async (_event, { config, keys }) => {
    try {
      console.log('[S3 Proxy] deleteObjects called:', { bucket: config.bucketName, count: keys.length });
      const { client } = getS3Client(config);
      const { DeleteObjectsCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteObjectsCommand({
        Bucket: config.bucketName,
        Delete: {
          Objects: keys.map(k => ({ Key: k })),
          Quiet: true
        }
      });
      await client.send(command);
      console.log('[S3 Proxy] deleteObjects success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] deleteObjects error:', error);
      return { 
        success: false, 
        error: error.message, 
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2) 
      };
    }
  });

  ipcMain.handle('s3:copyObject', async (_event, { config, sourceKey, destKey }) => {
    try {
      console.log('[S3 Proxy] copyObject called:', { bucket: config.bucketName, sourceKey, destKey });
      const { client } = getS3Client(config);
      const { CopyObjectCommand } = require('@aws-sdk/client-s3');
      const command = new CopyObjectCommand({
        Bucket: config.bucketName,
        Key: destKey,
        CopySource: `${config.bucketName}/${encodeURIComponent(sourceKey)}`,
      });
      await client.send(command);
      console.log('[S3 Proxy] copyObject success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] copyObject error:', error);
      return { 
        success: false, 
        error: error.message, 
        name: error.name,
        code: error.code || error.$metadata?.httpStatusCode,
        details: JSON.stringify(error, null, 2) 
      };
    }
  });

  ipcMain.handle('s3:getPresignedUrl', async (_event, { config, key, options }) => {
    try {
      const { client } = getS3Client(config);
      const { GetObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
      
      const commandInput = {
        Bucket: config.bucketName,
        Key: key,
      };

      if (options?.download) {
        const filename = key.split('/').pop() || 'file';
        commandInput.ResponseContentDisposition = `attachment; filename="${filename}"`;
      }

      const command = new GetObjectCommand(commandInput);
      const url = await getSignedUrl(client, command, { expiresIn: options?.expiresIn || 3600 });
      return { success: true, data: url };
    } catch (error) {
      console.error('[S3 Proxy] getPresignedUrl error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:uploadFile', async (_event, { config, key, fileBuffer, contentType }) => {
    try {
      console.log('[S3 Proxy] uploadFile called:', { bucket: config.bucketName, key, contentType });
      const { client } = getS3Client(config);
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const command = new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: Buffer.from(fileBuffer),
        ContentType: contentType || 'application/octet-stream',
      });
      await client.send(command);
      console.log('[S3 Proxy] uploadFile success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] uploadFile error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:listAllObjects', async (_event, { config, prefix }) => {
    try {
      console.log('[S3 Proxy] listAllObjects called:', { bucket: config.bucketName, prefix });
      const { client } = getS3Client(config);
      const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
      let isTruncated = true;
      let continuationToken;
      const objects = [];

      while (isTruncated) {
        const command = new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix || '',
          ContinuationToken: continuationToken,
        });

        const response = await client.send(command);

        if (response.Contents) {
          response.Contents.forEach(c => {
            if (c.Key) objects.push({ Key: c.Key, Size: c.Size || 0 });
          });
        }

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
      }

      console.log('[S3 Proxy] listAllObjects success:', objects.length, 'objects');
      return { success: true, data: objects };
    } catch (error) {
      console.error('[S3 Proxy] listAllObjects error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:createBucket', async (_event, { config, bucketName }) => {
    try {
      console.log('[S3 Proxy] createBucket called:', { bucketName });
      const { client } = getS3Client(config);
      const { CreateBucketCommand } = require('@aws-sdk/client-s3');
      const command = new CreateBucketCommand({ Bucket: bucketName });
      await client.send(command);
      console.log('[S3 Proxy] createBucket success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] createBucket error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

  ipcMain.handle('s3:deleteBucket', async (_event, { config, bucketName }) => {
    try {
      console.log('[S3 Proxy] deleteBucket called:', { bucketName });
      const { client } = getS3Client(config);
      const { DeleteBucketCommand } = require('@aws-sdk/client-s3');
      const command = new DeleteBucketCommand({ Bucket: bucketName });
      await client.send(command);
      console.log('[S3 Proxy] deleteBucket success');
      return { success: true };
    } catch (error) {
      console.error('[S3 Proxy] deleteBucket error:', error);
      return { success: false, error: error.message, name: error.name, code: error.code || error.$metadata?.httpStatusCode, details: JSON.stringify(error, null, 2) };
    }
  });

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

module.exports = {
  registerPluginIpc,
  openPluginWindow,
  startScreenshotCapture,
};