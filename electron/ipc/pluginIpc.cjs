const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
// 安装成功后把插件图标落盘到本地缓存，保证已安装插件的图标展示不再依赖网络
const { cachePluginIcon, resolveIconUrls, isDarkTheme } = require('../lib/config.cjs');
const { getAppIcon } = require('../lib/appIcon.cjs');
const { hasLocalPluginIcon } = require('../lib/pluginLocalIcons.cjs');
const { isRunning, terminate: stopOcrService } = require('../services/ocrService.cjs');
// 按操作域拆分的 IPC 子模块（通道清单与拆分前完全一致）
const { registerS3Ipc } = require('./s3Ipc.cjs');
const { registerClipboardIpc } = require('./clipboardIpc.cjs');
const { registerScreenshotIpc, startScreenshotCapture } = require('./screenshotIpc.cjs');

let pluginIpcRegistered = false;
const { app } = require('electron');

const pluginWindows = new Map();

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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


function registerPluginIpc() {
  if (pluginIpcRegistered) return;
  pluginIpcRegistered = true;

  // 按操作域拆分的子注册（s3 / 剪贴板 / 截图）；pluginWindows 以引用共享给截图域
  registerScreenshotIpc({ pluginWindows });
  registerS3Ipc();
  registerClipboardIpc();

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

}

module.exports = {
  registerPluginIpc,
  openPluginWindow,
  startScreenshotCapture,
};