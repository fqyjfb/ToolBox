const { ipcMain, dialog, desktopCapturer, screen, clipboard, nativeImage, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let pluginIpcRegistered = false;
const { app } = require('electron');

let preScreenshotBounds = null;
const pluginWindows = new Map();
let screenshotOverlayWindow = null;

const EXTENSIONS_DIR = path.join(app.getPath('userData'), 'extensions');
const CONFIG_FILE = path.join(app.getPath('userData'), 'extensions-config.json');

const GITHUB_MIRRORS = [
  'https://github.com.cnpmjs.org',
  'https://hub.fastgit.xyz',
  'https://gh.fastgit.org',
  'https://github.com',
];

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
      await new Promise((resolve, reject) => {
        const { execFile } = require('child_process');
        execFile('git', ['clone', '--depth=1', mirrorUrl, targetDir], { timeout: 45000 }, (error) => {
          if (error) reject(error);
          else resolve(null);
        });
      });
      console.log(`Successfully cloned from: ${mirrorUrl}`);
      return true;
    } catch (error) {
      lastError = error;
      console.warn(`Failed to clone from ${mirrorUrl}: ${error.message}`);
      if (fs.existsSync(targetDir)) {
        try {
          await fs.promises.rm(targetDir, { recursive: true, force: true });
        } catch { /* ignore */ }
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
      return plugins;
    } catch (error) {
      console.error('Failed to get installed plugins:', error);
      return [];
    }
  });

  ipcMain.handle('plugin:install', async (_event, { pluginId, repo }) => {
    try {
      const extensionsDir = getExtensionsDir();
      const pluginDir = path.join(extensionsDir, pluginId);
      
      if (fs.existsSync(pluginDir)) {
        await fs.promises.rm(pluginDir, { recursive: true, force: true });
      }
      
      const fullRepoUrl = repo.startsWith('http') ? repo : `https://github.com/${repo}`;
      
      await gitCloneWithRetry(fullRepoUrl, pluginDir);

      const config = loadConfig();
      config[pluginId] = { enabled: true };
      saveConfig(config);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('plugin:uninstall', async (_event, pluginId) => {
    try {
      const extensionsDir = getExtensionsDir();
      const pluginDir = path.join(extensionsDir, pluginId);
      
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

  ipcMain.handle('plugin:open-window', async (_event, { pluginId }) => {
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

      const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
      
      const pluginWindow = new BrowserWindow({
        width: manifest.width || 800,
        height: manifest.height || 600,
        minWidth: 400,
        minHeight: 300,
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
      
      const themeConfigPath = path.join(app.getPath('userData'), 'config.json');
      let isDark = false;
      try {
        if (fs.existsSync(themeConfigPath)) {
          const config = JSON.parse(fs.readFileSync(themeConfigPath, 'utf-8'));
          isDark = config.theme === 'dark' || config.isDark === true;
        } else {
          const theme = localStorageService?.getString?.('theme') || 
                        localStorageService?.getString?.('theme-isDark');
          isDark = theme === 'dark' || (theme && JSON.parse(theme) === true);
        }
      } catch { /* ignore */ }

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="zh-CN"${isDark ? ' class="dark"' : ''}>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${manifest.name}</title>
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
          <script src="https://cdn.tailwindcss.com"></script>
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
            <span class="plugin-header-title">${manifest.name}</span>
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
            window.__PLUGIN_DATA__ = ${JSON.stringify({ pluginId, pluginName: manifest.name, manifest, isDark, pluginDir })};
            
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
              script.src = '${entryUrl}';
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

  ipcMain.handle('start-screenshot-capture', async () => {
    try {
      const displays = screen.getAllDisplays();
      let minX = displays[0].bounds.x, minY = displays[0].bounds.y;
      let maxX = displays[0].bounds.x + displays[0].bounds.width;
      let maxY = displays[0].bounds.y + displays[0].bounds.height;

      displays.forEach(d => {
        if (d.bounds.x < minX) minX = d.bounds.x;
        if (d.bounds.y < minY) minY = d.bounds.y;
        if (d.bounds.x + d.bounds.width > maxX) maxX = d.bounds.x + d.bounds.width;
        if (d.bounds.y + d.bounds.height > maxY) maxY = d.bounds.y + d.bounds.height;
      });

      const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
      const pluginWindowsBounds = new Map();

      preScreenshotBounds = mainWindow ? mainWindow.getBounds() : null;

      if (mainWindow) {
        mainWindow.setAlwaysOnTop(false);
        mainWindow.hide();
      }

      pluginWindows.forEach((window, pluginId) => {
        if (!window.isDestroyed() && !window.isMinimized()) {
          pluginWindowsBounds.set(pluginId, window.getBounds());
          window.hide();
        }
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.max(...displays.map(d => d.bounds.width)),
          height: Math.max(...displays.map(d => d.bounds.height)),
        }
      });

      const captureData = displays.map((display) => {
        let source = sources.find((s) => s.display_id === display.id.toString());
        if (!source) {
          source = sources.find((s) => s.name === `Screen ${display.id}`) || sources[0];
        }
        const thumbnail = source.thumbnail;

        return {
          displayId: display.id.toString(),
          bounds: display.bounds,
          scaleFactor: display.scaleFactor,
          imageDataUrl: thumbnail.toDataURL(),
          dataUrl: thumbnail.toDataURL(),
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height,
        };
      });

      if (screenshotOverlayWindow && !screenshotOverlayWindow.isDestroyed()) {
        screenshotOverlayWindow.destroy();
      }

      const overlayHtml = `
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Screenshot Overlay</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { height: 100vh; overflow: hidden; background: transparent; }
            #root { height: 100%; }
            .overlay-container { position: relative; width: 100%; height: 100%; }
            .overlay-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.4); }
            .canvas-wrapper { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
            canvas { display: block; cursor: crosshair; }
            .selection-box { position: absolute; border: 2px solid #3b82f6; background: rgba(59,130,246,0.1); pointer-events: none; }
            .toolbar { position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%); display: flex; gap: 8px; background: white; padding: 8px 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 100; }
            .toolbar button { padding: 8px 16px; border: none; background: #f3f4f6; border-radius: 6px; cursor: pointer; font-size: 14px; color: #374151; }
            .toolbar button:hover { background: #e5e7eb; }
            .toolbar button.primary { background: #3b82f6; color: white; }
            .toolbar button.primary:hover { background: #2563eb; }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script>
            window.__SCREENSHOT_DATA__ = ${JSON.stringify({ captures: captureData })};
          </script>
          <script>
            (function() {
              const captures = window.__SCREENSHOT_DATA__.captures;
              const root = document.getElementById('root');
              
              const container = document.createElement('div');
              container.className = 'overlay-container';
              
              const bg = document.createElement('div');
              bg.className = 'overlay-bg';
              container.appendChild(bg);
              
              const wrapper = document.createElement('div');
              wrapper.className = 'canvas-wrapper';
              
              const canvas = document.createElement('canvas');
              wrapper.appendChild(canvas);
              container.appendChild(wrapper);
              
              const toolbar = document.createElement('div');
              toolbar.className = 'toolbar';
              
              const selectBtn = document.createElement('button');
              selectBtn.textContent = '选区';
              selectBtn.className = 'primary';
              toolbar.appendChild(selectBtn);
              
              const fullBtn = document.createElement('button');
              fullBtn.textContent = '全屏';
              toolbar.appendChild(fullBtn);
              
              const copyBtn = document.createElement('button');
              copyBtn.textContent = '复制';
              toolbar.appendChild(copyBtn);
              
              const saveBtn = document.createElement('button');
              saveBtn.textContent = '保存';
              toolbar.appendChild(saveBtn);
              
              const cancelBtn = document.createElement('button');
              cancelBtn.textContent = '取消';
              toolbar.appendChild(cancelBtn);
              
              container.appendChild(toolbar);
              root.appendChild(container);
              
              const ctx = canvas.getContext('2d');
              let totalWidth = 0;
              let totalHeight = 0;
              
              captures.forEach(c => {
                totalWidth = Math.max(totalWidth, c.x + c.width);
                totalHeight = Math.max(totalHeight, c.y + c.height);
              });
              
              canvas.width = totalWidth;
              canvas.height = totalHeight;
              
              let loadedCount = 0;
              captures.forEach(capture => {
                const img = new Image();
                img.onload = () => {
                  ctx.drawImage(img, capture.x, capture.y);
                  loadedCount++;
                };
                img.src = capture.dataUrl;
              });
              
              let selection = null;
              let isDrawing = false;
              let startX = 0, startY = 0;
              
              const selectionBox = document.createElement('div');
              selectionBox.className = 'selection-box';
              container.appendChild(selectionBox);
              
              canvas.addEventListener('mousedown', (e) => {
                const rect = canvas.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;
                isDrawing = true;
                selection = { x: startX, y: startY, width: 0, height: 0 };
                updateSelectionBox();
              });
              
              canvas.addEventListener('mousemove', (e) => {
                if (!isDrawing) return;
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                selection.width = Math.abs(x - startX);
                selection.height = Math.abs(y - startY);
                selection.x = x < startX ? x : startX;
                selection.y = y < startY ? y : startY;
                updateSelectionBox();
              });
              
              canvas.addEventListener('mouseup', () => {
                isDrawing = false;
              });
              
              canvas.addEventListener('mouseleave', () => {
                isDrawing = false;
              });
              
              function updateSelectionBox() {
                if (!selection) {
                  selectionBox.style.display = 'none';
                  return;
                }
                selectionBox.style.display = 'block';
                const rect = canvas.getBoundingClientRect();
                selectionBox.style.left = (rect.left + selection.x) + 'px';
                selectionBox.style.top = (rect.top + selection.y) + 'px';
                selectionBox.style.width = selection.width + 'px';
                selectionBox.style.height = selection.height + 'px';
              }
              
              selectBtn.addEventListener('click', () => {
              });
              
              fullBtn.addEventListener('click', () => {
                selection = { x: 0, y: 0, width: canvas.width, height: canvas.height };
                updateSelectionBox();
              });
              
              copyBtn.addEventListener('click', () => {
                const dataUrl = getSelectionDataUrl();
                window.electron?.screenshot?.copyToClipboard?.(dataUrl);
                window.electron?.screenshot?.complete?.();
              });
              
              saveBtn.addEventListener('click', () => {
                const dataUrl = getSelectionDataUrl();
                window.electron?.screenshot?.save?.({ buffer: dataUrl, format: 'png' });
                window.electron?.screenshot?.complete?.();
              });
              
              cancelBtn.addEventListener('click', () => {
                window.electron?.screenshot?.cancel?.();
              });
              
              document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                  window.electron?.screenshot?.cancel?.();
                }
              });
              
              function getSelectionDataUrl() {
                if (!selection || selection.width === 0 || selection.height === 0) {
                  return canvas.toDataURL('image/png');
                }
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = selection.width;
                tempCanvas.height = selection.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx.drawImage(canvas, selection.x, selection.y, selection.width, selection.height, 0, 0, selection.width, selection.height);
                return tempCanvas.toDataURL('image/png');
              }
            })();
          </script>
        </body>
        </html>
      `;

      screenshotOverlayWindow = new BrowserWindow({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        maximizable: false,
        hasShadow: false,
        webPreferences: {
          preload: path.join(__dirname, '../preload.cjs'),
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      screenshotOverlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(overlayHtml)}`);

      screenshotOverlayWindow.on('closed', () => {
        screenshotOverlayWindow = null;
      });

      return {
        captures: captureData,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.on('cancel-screenshot', () => {
    if (screenshotOverlayWindow && !screenshotOverlayWindow.isDestroyed()) {
      screenshotOverlayWindow.close();
    }
    const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
    if (mainWindow) {
      if (preScreenshotBounds) mainWindow.setBounds(preScreenshotBounds);
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true, process.platform === 'darwin' ? 'floating' : 'screen-saver', 1);
    }
    pluginWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.show();
      }
    });
  });

  ipcMain.on('screenshot-session-complete', () => {
    if (screenshotOverlayWindow && !screenshotOverlayWindow.isDestroyed()) {
      screenshotOverlayWindow.close();
    }
    const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
    if (mainWindow) {
      if (preScreenshotBounds) mainWindow.setBounds(preScreenshotBounds);
      mainWindow.show();
      mainWindow.setAlwaysOnTop(true, process.platform === 'darwin' ? 'floating' : 'screen-saver', 1);
    }
    pluginWindows.forEach((window) => {
      if (!window.isDestroyed()) {
        window.show();
      }
    });
  });

  ipcMain.handle('save-screenshot', async (_event, data) => {
    const { buffer, format, destinationPath } = data;

    const base64Data = buffer.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    let savePath = destinationPath;

    if (!savePath) {
      const mainWindow = require('../window/mainWindow.cjs').getMainWindow();
      if (mainWindow) mainWindow.setAlwaysOnTop(false);

      const result = await dialog.showSaveDialog(mainWindow || undefined, {
        title: 'Save Screenshot',
        defaultPath: path.join(app.getPath('desktop'), `Screenshot_${Date.now()}.${format}`),
        filters: [
          { name: 'Images', extensions: [format] }
        ]
      });

      if (mainWindow) mainWindow.setAlwaysOnTop(true, process.platform === 'darwin' ? 'floating' : 'screen-saver', 1);

      if (result.canceled || !result.filePath) return { success: false, reason: 'cancelled' };
      savePath = result.filePath;
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

module.exports = {
  registerPluginIpc,
};