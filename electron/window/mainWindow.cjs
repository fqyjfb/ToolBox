const { BrowserWindow, dialog, screen, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { loadSettings, saveSettings } = require('../lib/config.cjs');
const ShortcutManager = require('../lib/shortcutManager.cjs');
const notesService = require('../services/notesService.cjs');
const { getFloatWindow } = require('./floatWindow.cjs');

let mainWindow = null;
let memoryCleanupTimer = null;
let autoLockTimer = null;
let lastActivityTime = Date.now();

const iconCacheFolder = path.join(require('electron').app.getPath('userData'), 'icon-cache');
if (!fs.existsSync(iconCacheFolder)) {
  fs.mkdirSync(iconCacheFolder, { recursive: true });
}

const shortcutManager = new ShortcutManager();

// 检查锁定状态，如果已锁定则聚焦锁定窗口
const checkLockAndShowMain = (callback) => {
  const settings = loadSettings();
  if (settings.isLockEnabled === 1) {
    require('./lockWindow.cjs').toggleLock();
    return false;
  }
  if (callback) callback();
  return true;
};

const shortcutFunctions = {
  softwareExit: () => { require('electron').app.quit(); },
  softwareWindowVisibilityController: () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        checkLockAndShowMain(() => {
          mainWindow.show();
          mainWindow.focus();
        });
      }
    }
  },
  isMenuVisible: () => {
    const settings = loadSettings();
    settings.isMenuVisible = settings.isMenuVisible === 1 ? 0 : 1;
    saveSettings(settings);
    mainWindow?.webContents.send('setting-changed', { name: 'isMenuVisible', value: settings.isMenuVisible });
  },
  softwareSetting: () => {
    checkLockAndShowMain(() => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('navigate-to', '/settings');
      }
    });
  },
  windowTopmostToggle: () => {
    if (mainWindow) {
      const isTopmost = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isTopmost);
    }
  },
  restoreDefaultWindow: () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      const origin = loadSettings().defaultWindowSize || { width: 1024, height: 800 };
      if (width === origin.width && height === origin.height) {
        mainWindow.maximize();
      } else {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        checkLockAndShowMain(() => {
          if (!mainWindow.isVisible()) mainWindow.show();
          mainWindow.setSize(origin.width, origin.height, true);
          mainWindow.center();
        });
      }
    }
  },
  currentPageRefresher: () => {
    if (mainWindow) {
      mainWindow.webContents.reload();
    }
  },
  windowMinimize: () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.minimize();
    }
  },
  windowMaximizer: () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  },
  lockToggle: () => {
    const { loadSettings } = require('../lib/config.cjs');
    const settings = loadSettings();

    if (settings.isLockEnabled === 1) {
      require('./lockWindow.cjs').toggleLock();
    } else {
      require('./lockWindow.cjs').lockOrPrompt();
    }
  },
};

const generateCacheFileName = (filePath) => {
  return crypto.createHash('sha1').update(filePath).digest('hex');
};

const getCacheFilePath = (filePath) => {
  return path.join(iconCacheFolder, `${generateCacheFileName(filePath)}.png`);
};

const isSupportedFileType = (filePath) => {
  const extensions = ['.lnk', '.url', '.appref-ms', '.exe'];
  return extensions.some(ext => filePath.toLowerCase().endsWith(ext));
};

const initShortcuts = () => {
  const { loadShortcuts } = require('../lib/config.cjs');
  shortcutManager.unregisterAll();
  const shortcuts = loadShortcuts();
  shortcuts.forEach((shortcut) => {
    if (shortcut.isOpen === 0) return;
    if (!shortcutManager.isRegistered(shortcut.cmd)) {
      shortcutManager.register(shortcut.cmd, shortcutFunctions[shortcut.name].bind(this), shortcut.isGlobal === 1);
    }
  });
};

const updateShortcut = (shortcut, oldShortcut) => {
  if (shortcutManager.isRegistered(shortcut.cmd)) {
    return false;
  }
  shortcutManager.unregister(oldShortcut.cmd);
  shortcutManager.register(shortcut.cmd, shortcutFunctions[shortcut.name].bind(this), shortcut.isGlobal === 1);
  return true;
};

const isDisableShortcuts = (shortcut) => {
  if (shortcut.isOpen === 0 && shortcutManager.isRegistered(shortcut.cmd)) {
    shortcutManager.unregister(shortcut.cmd);
    return true;
  }
  if (shortcut.isOpen === 1 && !shortcutManager.isRegistered(shortcut.cmd)) {
    shortcutManager.register(shortcut.cmd, shortcutFunctions[shortcut.name].bind(this), shortcut.isGlobal === 1);
    return true;
  }
  return true;
};

const startMemoryOptimization = () => {
  stopMemoryOptimization();
  const settings = loadSettings();
  if (!settings.isMemoryOptimizationEnabled) return;

  const cleanupInterval = 5 * 60 * 1000;
  const cleanup = () => {
    try {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript('window.gc && window.gc();');
        mainWindow.webContents.send('memory-cleanup');
      }
    } catch (error) {
      console.error('[MEMORY] Memory cleanup error:', error);
    }
  };
  memoryCleanupTimer = setInterval(cleanup, cleanupInterval);
};

const stopMemoryOptimization = () => {
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    memoryCleanupTimer = null;
  }
};

const stopAutoLock = () => {
  if (autoLockTimer) {
    clearInterval(autoLockTimer);
    autoLockTimer = null;
  }
};

const startAutoLock = () => {
  stopAutoLock();
  const settings = loadSettings();
  if (!settings.isAutoLockEnabled || !settings.lockPassword) return;

  const threshold = (settings.autoLockTimeout || 600) * 1000;
  const checkInterval = Math.max(5000, threshold / 10);
  const { execFile } = require('child_process');

  autoLockTimer = setInterval(() => {
    const currentSettings = loadSettings();
    
    if (!currentSettings.isAutoLockEnabled || !currentSettings.lockPassword) {
      stopAutoLock();
      return;
    }

    if (currentSettings.isLockEnabled === 1) {
      return;
    }

    if (process.platform === 'win32') {
      execFile('powershell.exe', [
        '-ExecutionPolicy', 'Bypass',
        '-Command',
        'Add-Type -TypeDefinition "using System; using System.Runtime.InteropServices; public static class User32 { [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; } [DllImport(`\"user32.dll`\")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii); }"; $lastInputInfo = New-Object User32+LASTINPUTINFO; $lastInputInfo.cbSize = [System.Runtime.InteropServices.Marshal]::SizeOf($lastInputInfo); [User32]::GetLastInputInfo([ref]$lastInputInfo) | Out-Null; [Environment]::TickCount - $lastInputInfo.dwTime'
      ], (error, stdout) => {
        if (error || !stdout) return;
        
        const idleMs = parseInt(stdout.trim(), 10);
        const currentThreshold = (currentSettings.autoLockTimeout || 600) * 1000;
        
        if (idleMs >= 0 && idleMs >= currentThreshold) {
          require('./lockWindow.cjs').lock();
        }
      });
    } else {
      const elapsed = Date.now() - lastActivityTime;
      const currentThreshold = (currentSettings.autoLockTimeout || 600) * 1000;
      if (elapsed >= currentThreshold) {
        require('./lockWindow.cjs').lock();
      }
    }
  }, checkInterval);
};

const resetAutoLockTimer = () => {
  lastActivityTime = Date.now();
};

const createWindow = (onReadyCallback, showOnReady = true) => {
  const { app } = require('electron');
  let iconPath = null;
  const iconPaths = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'app', 'public', 'favicon.ico'),
        path.join(process.resourcesPath, 'app', 'public', 'favicon.png'),
        path.join(process.resourcesPath, 'public', 'favicon.ico'),
        path.join(process.resourcesPath, 'public', 'favicon.png')
      ]
    : [
        path.join(__dirname, '../../public/favicon.ico'),
        path.join(__dirname, '../../public/favicon.png')
      ];

  for (const p of iconPaths) {
    if (fs.existsSync(p)) {
      iconPath = p;
      break;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  let indexPath;
  if (app.isPackaged) {
    const possiblePaths = [
      path.join(__dirname, '../../dist/index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'dist', 'index.html')
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        indexPath = p;
        break;
      }
    }
    if (indexPath) {
      mainWindow.loadURL(url.format({
        pathname: indexPath,
        protocol: 'file:',
        slashes: true,
      }));
    } else {
      mainWindow.loadURL('data:text/html,<h1>Error</h1><p>Could not find index.html.</p>');
    }
  } else {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (showOnReady) {
      mainWindow.show();
    }
    initShortcuts();
    startAutoLock();

    if (onReadyCallback) {
      onReadyCallback();
    }
  });

  mainWindow.on('closed', () => {
    stopAutoLock();
    mainWindow = null;
  });

  mainWindow.on('minimize', (event) => {
    event.preventDefault();
    mainWindow.hide();
  });

  let isAdjusting = false;
  mainWindow.on('move', () => {
    const settings = loadSettings();
    if (!settings.isWindowEdgeAdsorption) return;
    if (isAdjusting) return;

    const windowBounds = mainWindow.getBounds();
    const centerPoint = {
      x: windowBounds.x + windowBounds.width / 2,
      y: windowBounds.y + windowBounds.height / 2
    };

    const display = screen.getDisplayNearestPoint(centerPoint);
    const workArea = display.workArea;
    const scaleFactor = display.scaleFactor;
    const threshold = 30 * scaleFactor;

    const leftEdgeDistance = windowBounds.x - workArea.x;
    const rightEdgeDistance = (workArea.x + workArea.width) - (windowBounds.x + windowBounds.width);
    let newBounds = { ...windowBounds };

    if (Math.abs(leftEdgeDistance) <= threshold) {
      Object.assign(newBounds, {
        x: workArea.x,
        y: workArea.y,
        height: workArea.height
      });
    } else if (Math.abs(rightEdgeDistance) <= threshold) {
      Object.assign(newBounds, {
        x: workArea.x + workArea.width - windowBounds.width,
        y: workArea.y,
        height: workArea.height
      });
    }
    if (JSON.stringify(newBounds) !== JSON.stringify(windowBounds)) {
      isAdjusting = true;
      mainWindow.setBounds(newBounds, true);
      isAdjusting = false;
    }
  });
};

let ipcHandlersRegistered = false;

const registerIpcHandlers = () => {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;
  
  const { ipcMain } = require('electron');
  const { loadShortcuts, saveShortcuts, loadFloatConfig, saveFloatConfig, defaultFloatConfig } = require('../lib/config.cjs');

  ipcMain.on('window-minimize', () => { mainWindow.minimize(); });
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => { mainWindow.hide(); });
  ipcMain.on('open-external', (event, url) => { shell.openExternal(url); });

  ipcMain.on('open-file', (event, filePath) => {
    shell.openPath(filePath).catch((error) => { console.error('Failed to open file:', error); });
  });

  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '可执行文件', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('scan-desktop-apps', async () => {
    const desktopPath = require('electron').app.getPath('desktop');
    if (!fs.existsSync(desktopPath)) return [];
    try {
      const files = fs.readdirSync(desktopPath);
      const appFiles = [];
      for (const file of files) {
        const filePath = path.join(desktopPath, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile() && isSupportedFileType(filePath)) {
          appFiles.push({
            name: file.replace(/\.(exe|bat|cmd|lnk)$/i, ''),
            path: filePath
          });
        }
      }
      return appFiles;
    } catch (error) {
      return [];
    }
  });

  const logger = require('../logs/logger.cjs');

  const getShortcutTarget = (shortcutPath) => {
    return new Promise((resolve) => {
      const escapedPath = shortcutPath.replace(/\\/g, '\\\\').replace(/"/g, '`"');
      const psScript = `
        $Shell = New-Object -ComObject WScript.Shell
        try {
          $Shortcut = $Shell.CreateShortcut("${escapedPath}")
          $TargetPath = $Shortcut.TargetPath
          if ($TargetPath -and (Test-Path -Path $TargetPath -PathType Leaf)) {
            Write-Output $TargetPath
          } else {
            Write-Output "${escapedPath}"
          }
        } catch {
          Write-Output "${escapedPath}"
        }
      `;
      execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 5000 }, (error, stdout) => {
        if (stdout?.trim()) {
          resolve(stdout.trim());
        } else {
          resolve(shortcutPath);
        }
      });
    });
  };

  const normalizePath = (inputPath) => {
    if (!inputPath) return null;
    
    let normalized = inputPath.trim();
    normalized = normalized.replace(/\//g, '\\');
    
    if (normalized.startsWith('\\')) {
      normalized = normalized.substring(1);
    }
    
    const unixDriveMatch = normalized.match(/^([A-Za-z]):\\/);
    if (!unixDriveMatch) {
      const driveMatch = inputPath.match(/^\/([A-Za-z])\//);
      if (driveMatch) {
        normalized = `${driveMatch[1]}:\\${inputPath.substring(3).replace(/\//g, '\\')}`;
      }
    }
    
    return normalized;
  };

  ipcMain.handle('get-dropped-files', async (event, filePaths) => {
    const result = [];

    logger.addLog('debug', `[QuickLaunch] 接收到 ${filePaths.length} 个文件路径`, 'drag-drop');

    for (const filePath of filePaths) {
      if (!filePath || !filePath.trim()) {
        continue;
      }

      logger.addLog('debug', `[QuickLaunch] 处理文件: ${filePath}`, 'drag-drop');

      if (isSupportedFileType(filePath)) {
        const targetPath = filePath.toLowerCase().endsWith('.lnk')
          ? await getShortcutTarget(filePath)
          : filePath;
        
        if (fs.existsSync(targetPath)) {
          logger.addLog('debug', `[QuickLaunch] 路径存在: ${targetPath}`, 'drag-drop');
          result.push(targetPath);
        } else {
          logger.addLog('warn', `[QuickLaunch] 路径不存在: ${targetPath}`, 'drag-drop');
        }
      } else {
        logger.addLog('debug', `[QuickLaunch] 路径扩展名不支持: ${filePath}`, 'drag-drop');
      }
    }

    logger.addLog('info', `[QuickLaunch] getDroppedFiles 返回 ${result.length} 个有效路径`, 'drag-drop');
    return result;
  });

  ipcMain.handle('get-file-icon', async (event, filePath) => {
    if (!filePath) return null;
    const cacheFilePath = getCacheFilePath(filePath);
    if (fs.existsSync(cacheFilePath)) {
      try {
        const buffer = fs.readFileSync(cacheFilePath);
        return buffer.toString('base64');
      } catch (e) {}
    }
    if (!isSupportedFileType(filePath)) return null;
    const result = await getIconViaPowerShell(filePath, cacheFilePath);
    return result || null;
  });

  const getIconViaPowerShell = async (filePath, cacheFilePath) => {
    return new Promise((resolve) => {
      const psScript = `
function Get-Shortcut-Target {
    param([string]$ShortcutFilePath)
    try {
        $Shell = New-Object -ComObject WScript.Shell
        $Shortcut = $Shell.CreateShortcut($ShortcutFilePath)
        $TargetPath = $Shortcut.TargetPath
        $IconLocation = $Shortcut.IconLocation
        $lastComma = $IconLocation.LastIndexOf(",")
        if ($lastComma -gt -1) {
            $IconPath = $IconLocation.Substring(0, $lastComma).Trim()
        } else {
            $IconPath = $IconLocation.Trim()
        }
        if ($IconPath -and (Test-Path -Path $IconPath -PathType Leaf)) {
            return $IconPath
        }
        if (Test-Path -Path $TargetPath -PathType Leaf) {
            return $TargetPath
        } else {
            return $ShortcutFilePath
        }
    } catch {
        return $ShortcutFilePath
    }
}
function Get-Associated-Icon {
    param([string]$InFilePath, [string]$OutFilePath)
    $ErrorActionPreference = "SilentlyContinue"
    Add-Type -AssemblyName System.Drawing
    if ($InFilePath.EndsWith(".lnk")) {
        $InFilePath = Get-Shortcut-Target -ShortcutFilePath $InFilePath
    }
    $Icon = [System.Drawing.Icon]::ExtractAssociatedIcon($InFilePath)
    if ($null -ne $Icon) {
        $Icon.ToBitmap().Save($OutFilePath, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Output 'success'
    }
}
Get-Associated-Icon -InFilePath "${filePath}" -OutFilePath "${cacheFilePath}"
      `;
      execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 15000 }, (error, stdout) => {
        if (stdout?.trim() === 'success' && fs.existsSync(cacheFilePath)) {
          try {
            const buffer = fs.readFileSync(cacheFilePath);
            resolve(buffer.toString('base64'));
            return;
          } catch (e) {}
        }
        resolve(null);
      });
    });
  };

  ipcMain.handle('get-autostart-status', () => {
    const settings = require('electron').app.getLoginItemSettings();
    return settings.openAtLogin;
  });

  ipcMain.handle('set-autostart-status', (event, enable) => {
    require('electron').app.setLoginItemSettings({ args: [], openAtLogin: enable, path: process.execPath });
    const settings = loadSettings();
    settings.isAutoLaunch = enable ? 1 : 0;
    saveSettings(settings);
    return true;
  });

  ipcMain.handle('get-settings', () => {
    const settings = loadSettings();
    return Object.keys(settings).map(key => ({ name: key, value: settings[key] }));
  });

  ipcMain.handle('get-float-config', () => { return loadFloatConfig(); });

  ipcMain.handle('update-float-config', (event, config) => {
    saveFloatConfig(config);
    const floatWindow = getFloatWindow();
    if (floatWindow) {
      floatWindow.webContents.send('float-config-changed', config);
    }
    return { code: 0, msg: '悬浮球配置已更新' };
  });

  ipcMain.handle('reset-float-config', () => {
    saveFloatConfig([...defaultFloatConfig]);
    return { code: 0, msg: '悬浮球配置已重置' };
  });

  ipcMain.handle('update-setting', (event, setting) => {
    const settings = loadSettings();
    settings[setting.name] = setting.value;
    saveSettings(settings);

    if (setting.name === 'isAutoLaunch') {
      require('electron').app.setLoginItemSettings({ args: [], openAtLogin: setting.value === 1, path: process.execPath });
    }

    if (setting.name === 'isMemoryOptimizationEnabled') {
      startMemoryOptimization();
    }

    if (setting.name === 'isAutoLockEnabled' || setting.name === 'autoLockTimeout') {
      startAutoLock();
      if (setting.name === 'isAutoLockEnabled') {
        resetAutoLockTimer();
      }
    }

    mainWindow?.webContents.send('setting-changed', { name: setting.name, value: setting.value });
    return { code: 0, msg: '设置已更新' };
  });

  ipcMain.handle('clear-cache', async () => {
    try {
      const userDataPath = require('electron').app.getPath('userData');
      const cacheFolders = [
        path.join(userDataPath, 'icon-cache'),
        path.join(userDataPath, 'Cache'),
        path.join(userDataPath, 'Code Cache'),
        path.join(userDataPath, 'GPUCache'),
        path.join(userDataPath, 'Service Worker')
      ];
      cacheFolders.forEach(folder => {
        if (fs.existsSync(folder)) {
          try { fs.rmSync(folder, { recursive: true, force: true }); } catch (folderError) {}
        }
      });
      fs.mkdirSync(path.join(userDataPath, 'icon-cache'), { recursive: true });
      if (mainWindow && mainWindow.webContents) {
        try {
          await mainWindow.webContents.session.clearCache();
          await mainWindow.webContents.session.clearStorageData();
        } catch (sessionError) {}
      }
      return { code: 0, msg: '缓存已清除' };
    } catch (error) {
      return { code: -1, msg: '清除缓存失败: ' + error.message };
    }
  });

  ipcMain.handle('get-user-data-path', () => {
    return require('electron').app.getPath('userData');
  });

  ipcMain.handle('open-user-data-folder', async () => {
    const userDataPath = require('electron').app.getPath('userData');
    await shell.openPath(userDataPath);
    return { success: true };
  });

  ipcMain.handle('get-shortcuts', () => { return loadShortcuts(); });

  ipcMain.handle('update-shortcut', (event, shortcut) => {
    const shortcuts = loadShortcuts();
    const index = shortcuts.findIndex(s => s.id === shortcut.id);
    if (index !== -1) {
      const oldShortcut = { ...shortcuts[index] };
      shortcuts[index] = { ...shortcuts[index], ...shortcut };
      saveShortcuts(shortcuts);

      let success = true;
      let message = '快捷键已更新';

      if (shortcut.flag) {
        success = isDisableShortcuts(shortcuts[index]);
        if (success) { message = '快捷键状态已更新'; }
      } else {
        success = updateShortcut(shortcuts[index], oldShortcut);
        if (!success) { message = '快捷键已被占用'; }
      }
      return { code: success ? 0 : -1, msg: message, data: shortcuts[index] };
    }
    return { code: -1, msg: '快捷键不存在' };
  });

  ipcMain.handle('get-version', async () => {
    let newVersion = '未知';
    let downloadUrl = 'https://github.com/fqyjfb/ToolBox';
    try {
      const https = require('https');
      const options = {
        hostname: 'api.github.com',
        path: '/repos/fqyjfb/ToolBox/releases/latest',
        headers: { 'User-Agent': 'ToolBox-App' }
      };
      const response = await new Promise((resolve, reject) => {
        https.get(options, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }).on('error', reject);
      });
      const release = JSON.parse(response);
      if (release.tag_name) {
        newVersion = release.tag_name.replace('v', '');
      }
      if (release.assets && release.assets.length > 0) {
        const installer = release.assets.find(a => a.name.endsWith('.exe'));
        if (installer) {
          downloadUrl = installer.browser_download_url;
        }
      }
    } catch (error) {}
    return {
      version: require('electron').app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      newVersion: newVersion,
      github: 'https://github.com/fqyjfb/ToolBox',
      download: downloadUrl
    };
  });

  ipcMain.handle('download-update', async (event, url) => {
    try {
      const https = require('https');
      const downloadPath = path.join(require('electron').app.getPath('downloads'), 'ToolBox-Setup.exe');
      return new Promise((resolve, reject) => {
        https.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject({ code: -1, msg: `下载失败，HTTP状态码: ${response.statusCode}` });
            return;
          }
          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloadedSize = 0;
          const file = fs.createWriteStream(downloadPath);
          response.on('data', (chunk) => {
            downloadedSize += chunk.length;
            if (totalSize > 0) {
              const progress = Math.round((downloadedSize / totalSize) * 100);
              event.sender.send('update-download-progress', progress);
            }
          });
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            event.sender.send('update-download-progress', 100);
            resolve({ code: 0, msg: '下载完成', path: downloadPath });
          });
          file.on('error', (err) => {
            fs.unlink(downloadPath, () => {});
            reject({ code: -1, msg: `文件写入失败: ${err.message}` });
          });
        }).on('error', (err) => {
          fs.unlink(downloadPath, () => {});
          reject({ code: -1, msg: `网络请求失败: ${err.message}` });
        });
      });
    } catch (error) {
      return { code: -1, msg: `下载失败: ${error.message}` };
    }
  });

  ipcMain.handle('install-update', async (event, filePath) => {
    try {
      return new Promise((resolve, reject) => {
        execFile(filePath, [], (error) => {
          if (error) {
            reject({ code: -1, msg: `安装启动失败: ${error.message}` });
          } else {
            resolve({ code: 0, msg: '安装程序已启动' });
          }
        });
      });
    } catch (error) {
      return { code: -1, msg: `安装失败: ${error.message}` };
    }
  });

  ipcMain.on('open-internal', (event, urlPath) => {
    const { BrowserWindow, Menu, MenuItem, nativeImage, app } = require('electron');
    // 查找 icon 路径
    let iconPath = null;
    const iconPaths = app.isPackaged
      ? [
          path.join(process.resourcesPath, 'app', 'public', 'favicon.ico'),
          path.join(process.resourcesPath, 'app', 'public', 'favicon.png'),
          path.join(process.resourcesPath, 'public', 'favicon.ico'),
          path.join(process.resourcesPath, 'public', 'favicon.png')
        ]
      : [
          path.join(__dirname, '../../public/favicon.ico'),
          path.join(__dirname, '../../public/favicon.png')
        ];

    for (const p of iconPaths) {
      if (fs.existsSync(p)) {
        iconPath = p;
        break;
      }
    }
    
    const internalWindow = new BrowserWindow({
      width: 1024,
      height: 768,
      title: 'ToolBox 浏览器',
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    internalWindow.loadURL(urlPath);
    const menu = new Menu();
    menu.append(new MenuItem({
      label: '导航',
      submenu: [
        { label: '后退', accelerator: 'Alt+左箭头', click: () => { if (internalWindow.webContents.canGoBack()) { internalWindow.webContents.goBack(); } }, enabled: false },
        { label: '前进', accelerator: 'Alt+右箭头', click: () => { if (internalWindow.webContents.canGoForward()) { internalWindow.webContents.goForward(); } }, enabled: false },
        { type: 'separator' },
        { label: '刷新', accelerator: 'F5', click: () => { internalWindow.webContents.reload(); } },
        { label: '停止', accelerator: 'Esc', click: () => { internalWindow.webContents.stop(); } },
      ]
    }));
    menu.append(new MenuItem({
      label: '编辑',
      submenu: [
        { label: '复制', accelerator: 'Ctrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'Ctrl+V', role: 'paste' },
        { label: '剪切', accelerator: 'Ctrl+X', role: 'cut' },
        { type: 'separator' },
        { label: '全选', accelerator: 'Ctrl+A', role: 'selectAll' },
      ]
    }));
    menu.append(new MenuItem({
      label: '查看',
      submenu: [
        { label: '重新加载', accelerator: 'Ctrl+R', click: () => { internalWindow.webContents.reload(); } },
        { type: 'separator' },
        { label: '开发者工具', accelerator: 'F12', click: () => { internalWindow.webContents.toggleDevTools(); } },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', click: () => { internalWindow.setFullScreen(!internalWindow.isFullScreen()); } },
      ]
    }));
    menu.append(new MenuItem({
      label: '窗口',
      submenu: [
        { label: '最小化', accelerator: 'Ctrl+M', click: () => { internalWindow.minimize(); } },
        { label: '最大化', accelerator: 'Ctrl+Shift+M', click: () => { if (internalWindow.isMaximized()) { internalWindow.unmaximize(); } else { internalWindow.maximize(); } } },
        { type: 'separator' },
        { label: '关闭', accelerator: 'Ctrl+W', click: () => { internalWindow.close(); } },
      ]
    }));
    menu.append(new MenuItem({
      label: '帮助',
      submenu: [
        { label: '关于 ToolBox', click: () => {} },
      ]
    }));
    internalWindow.setMenu(menu);
    internalWindow.webContents.on('did-navigate', () => {
      menu.items[0].submenu.items[0].enabled = internalWindow.webContents.canGoBack();
      menu.items[0].submenu.items[1].enabled = internalWindow.webContents.canGoForward();
    });
  });

  ipcMain.handle('notes-has-root-path', () => notesService.hasRootPath());
  ipcMain.handle('notes-get-root-path', () => notesService.getRootPath());
  ipcMain.handle('notes-set-root-path', (event, rootPath) => notesService.setRootPath(rootPath));
  ipcMain.handle('notes-select-folder', async () => notesService.selectFolder());
  ipcMain.handle('notes-validate-folder', (event, folderPath) => notesService.validateFolder(folderPath));
  ipcMain.handle('notes-scan-folder', (event, rootPath) => notesService.scanFolder(rootPath));
  ipcMain.handle('notes-get-file-tree', () => notesService.getFileTree());
  ipcMain.handle('notes-create-folder', (event, parentPath, name) => notesService.createFolder(parentPath, name));
  ipcMain.handle('notes-create-folder-force', (event, parentPath, name, mode) => notesService.createFolderForce(parentPath, name, mode));
  ipcMain.handle('notes-create-note', (event, parentPath, name, content) => notesService.createNote(parentPath, name, content));
  ipcMain.handle('notes-create-note-force', (event, parentPath, name, mode, content) => notesService.createNoteForce(parentPath, name, mode, content));
  ipcMain.handle('notes-read-file', (event, filePath) => notesService.readFile(filePath));
  ipcMain.handle('notes-save-file', (event, filePath, content) => notesService.saveFile(filePath, content));
  ipcMain.handle('notes-rename-item', (event, oldPath, newName) => notesService.renameItem(oldPath, newName));
  ipcMain.handle('notes-delete-item', (event, itemPath) => notesService.deleteItem(itemPath));
  ipcMain.handle('notes-index-all', (event, rootPath) => notesService.indexAllNotes(rootPath));
  ipcMain.handle('notes-open-file-in-folder', (event, filePath) => notesService.openFileInFolder(filePath));

  ipcMain.handle('ip-info:query', async (event, ip) => {
    const https = require('https');
    return new Promise((resolve) => {
      const url = ip ? `https://ipinfo.io/${ip}/json` : 'https://ipinfo.io/json';
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              resolve({ error: true, reason: result.error.message || '查询失败' });
            } else {
              const [latitude, longitude] = result.loc ? result.loc.split(',').map(Number) : [0, 0];
              resolve({
                ip: result.ip || '',
                version: result.ip?.includes(':') ? 'IPv6' : 'IPv4',
                city: result.city || '',
                region: result.region || '',
                country_name: result.country || '',
                country_code: result.country || '',
                timezone: result.timezone || '',
                currency: '',
                currency_name: '',
                postal: result.postal || '',
                latitude,
                longitude,
                org: result.org || '',
                asn: result.asn || '',
                languages: '',
              });
            }
          } catch (error) {
            resolve({ error: true, reason: '解析数据失败' });
          }
        });
      }).on('error', (error) => {
        resolve({ error: true, reason: error.message });
      });
    });
  });
};

module.exports = {
  createWindow,
  registerIpcHandlers,
  startMemoryOptimization,
  stopMemoryOptimization,
  startAutoLock,
  stopAutoLock,
  resetAutoLockTimer,
  getMainWindow: () => mainWindow,
};
