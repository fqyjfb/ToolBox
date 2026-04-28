const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, globalShortcut } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const shortcutsPath = path.join(app.getPath('userData'), 'shortcuts.json');

const defaultSettings = {
  isWindowEdgeAdsorption: 0,
  isMemoryOptimizationEnabled: 0,
  isOpenDevTools: 0,
  isOpenZoom: 0,
  isAutoLaunch: 0,
  isMenuVisible: 1,
  isOpenContextMenu: 1,
  systemTheme: 'system',
  leftMenuPosition: 'left',
  howLinkOpenMethod: 'internal',
  defaultWindowSize: { width: 1024, height: 800 }
};

const defaultShortcuts = [
  { id: 1, tag: '退出软件', cmd: 'CommandOrControl+Q', isOpen: 1, isGlobal: 1, name: 'softwareExit' },
  { id: 2, tag: '隐藏/显示 软件窗口', cmd: 'CommandOrControl+H', isOpen: 1, isGlobal: 1, name: 'softwareWindowVisibilityController' },
  { id: 3, tag: '隐藏/显示 侧边导航', cmd: 'CommandOrControl+B', isOpen: 1, isGlobal: 0, name: 'isMenuVisible' },
  { id: 4, tag: '打开设置', cmd: 'CommandOrControl+S', isOpen: 1, isGlobal: 0, name: 'softwareSetting' },
  { id: 5, tag: '取消/设置 窗口置顶', cmd: 'CommandOrControl+T', isOpen: 1, isGlobal: 0, name: 'windowTopmostToggle' },
  { id: 6, tag: '恢复默认窗口', cmd: 'CommandOrControl+O', isOpen: 1, isGlobal: 0, name: 'restoreDefaultWindow' },
  { id: 7, tag: '刷新当前页面', cmd: 'CommandOrControl+R', isOpen: 1, isGlobal: 0, name: 'currentPageRefresher' },
  { id: 8, tag: '最小化窗口', cmd: 'CommandOrControl+[', isOpen: 1, isGlobal: 0, name: 'windowMinimize' },
  { id: 9, tag: '最大化窗口', cmd: 'CommandOrControl+]', isOpen: 1, isGlobal: 0, name: 'windowMaximizer' },
];

const loadSettings = () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return { ...defaultSettings };
};

const saveSettings = (settings) => {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

const loadShortcuts = () => {
  try {
    if (fs.existsSync(shortcutsPath)) {
      const data = fs.readFileSync(shortcutsPath, 'utf-8');
      const shortcuts = JSON.parse(data);
      return shortcuts.map(s => ({ ...defaultShortcuts.find(ds => ds.id === s.id), ...s }));
    }
  } catch (error) {
    console.error('Failed to load shortcuts:', error);
  }
  return [...defaultShortcuts];
};

const saveShortcuts = (shortcuts) => {
  try {
    fs.writeFileSync(shortcutsPath, JSON.stringify(shortcuts, null, 2));
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
  }
};

let mainWindow = null;
let tray = null;
let memoryCleanupTimer = null;

const iconCacheFolder = path.join(app.getPath('userData'), 'icon-cache');
if (!fs.existsSync(iconCacheFolder)) {
  fs.mkdirSync(iconCacheFolder, { recursive: true });
}

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
  console.log('[MEMORY] Memory optimization started');
};

const stopMemoryOptimization = () => {
  if (memoryCleanupTimer) {
    clearInterval(memoryCleanupTimer);
    memoryCleanupTimer = null;
    console.log('[MEMORY] Memory optimization stopped');
  }
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

console.log('Electron app starting...');
console.log('App path:', app.getAppPath());
console.log('Resources path:', process.resourcesPath);

class ShortcutManager {
  constructor() {
    this.localShortcuts = new Map();
    this.globalShortcuts = new Map();
  }

  register(accelerator, callback, isGlobal = false) {
    if (isGlobal) {
      this._registerGlobal(accelerator, callback);
    } else {
      this._registerLocal(accelerator, callback);
    }
  }

  _registerGlobal(accelerator, callback) {
    if (globalShortcut.isRegistered(accelerator)) {
      globalShortcut.unregister(accelerator);
    }

    if (globalShortcut.register(accelerator, callback)) {
      this.globalShortcuts.set(accelerator, callback);
      console.log(`Registered global shortcut: ${accelerator}`);
    }
  }

  _registerLocal(accelerator, callback) {
    this.localShortcuts.set(accelerator, callback);
    this._rebuildMenu();
    console.log(`Registered local shortcut: ${accelerator}`);
  }

  isRegistered(accelerator) {
    return this.localShortcuts.has(accelerator) || this.globalShortcuts.has(accelerator);
  }

  unregister(accelerator) {
    if (this.globalShortcuts.has(accelerator)) {
      globalShortcut.unregister(accelerator);
      this.globalShortcuts.delete(accelerator);
    }

    if (this.localShortcuts.has(accelerator)) {
      this.localShortcuts.delete(accelerator);
      this._rebuildMenu();
    }
    console.log(`Unregistered shortcut: ${accelerator}`);
  }

  unregisterAll() {
    globalShortcut.unregisterAll();
    this.globalShortcuts.clear();
    this.localShortcuts.clear();
    this._rebuildMenu();
  }

  _rebuildMenu() {
    const template = [];

    if (process.platform === 'darwin') {
      template.push({
        label: app.name,
        submenu: [
          { role: 'about' },
          { role: 'quit' }
        ]
      });
    }

    const fileMenu = {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    };

    const editMenu = {
      label: 'Edit',
      submenu: [
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' }
      ]
    };

    const shortcutsMenu = {
      label: 'Shortcuts',
      submenu: []
    };

    this.localShortcuts.forEach((callback, accelerator) => {
      shortcutsMenu.submenu.push({
        label: `${accelerator}`,
        accelerator,
        click: callback
      });
    });

    template.push(fileMenu, editMenu, shortcutsMenu);

    if (process.platform === 'darwin') {
      template.push({
        role: 'window',
        submenu: [
          { role: 'minimize' },
          { role: 'front' }
        ]
      });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }
}

const shortcutManager = new ShortcutManager();

const initShortcuts = () => {
  shortcutManager.unregisterAll();
  
  const shortcuts = loadShortcuts();
  shortcuts.forEach((shortcut) => {
    if (shortcut.isOpen === 0) {
      return;
    }
    if (!shortcutManager.isRegistered(shortcut.cmd)) {
      shortcutManager.register(shortcut.cmd, shortcutFunctions[shortcut.name].bind(this), shortcut.isGlobal === 1);
    }
  });
};

const shortcutFunctions = {
  softwareExit: () => {
    console.log('Shortcut: softwareExit');
    app.quit();
  },

  softwareWindowVisibilityController: () => {
    console.log('Shortcut: softwareWindowVisibilityController');
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  },

  isMenuVisible: () => {
    console.log('Shortcut: isMenuVisible');
    const settings = loadSettings();
    settings.isMenuVisible = settings.isMenuVisible === 1 ? 0 : 1;
    saveSettings(settings);
    mainWindow?.webContents.send('setting-changed', { name: 'isMenuVisible', value: settings.isMenuVisible });
  },

  softwareSetting: () => {
    console.log('Shortcut: softwareSetting');
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('navigate-to', '/settings');
    }
  },

  windowTopmostToggle: () => {
    console.log('Shortcut: windowTopmostToggle');
    if (mainWindow) {
      const isTopmost = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!isTopmost);
    }
  },

  restoreDefaultWindow: () => {
    console.log('Shortcut: restoreDefaultWindow');
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      const origin = loadSettings().defaultWindowSize || { width: 1024, height: 800 };

      if (width === origin.width && height === origin.height) {
        mainWindow.maximize();
      } else {
        if (mainWindow.isMaximized()) mainWindow.unmaximize();
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.setSize(origin.width, origin.height, true);
        mainWindow.center();
      }
    }
  },

  currentPageRefresher: () => {
    console.log('Shortcut: currentPageRefresher');
    if (mainWindow) {
      mainWindow.webContents.reload();
    }
  },

  windowMinimize: () => {
    console.log('Shortcut: windowMinimize');
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.minimize();
    }
  },

  windowMaximizer: () => {
    console.log('Shortcut: windowMaximizer');
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  }
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

const createWindow = () => {
  console.log('Creating main window...');
  let iconPath = null;
  const iconPaths = [
    path.join(__dirname, '../public/favicon.ico'),
    path.join(__dirname, '../public/favicon.png'),
    path.join(process.resourcesPath, 'app', 'public', 'favicon.ico'),
    path.join(process.resourcesPath, 'app', 'public', 'favicon.png'),
    path.join(process.resourcesPath, 'public', 'favicon.ico'),
    path.join(process.resourcesPath, 'public', 'favicon.png')
  ];
  
  console.log('Checking icon paths:');
  for (const p of iconPaths) {
    console.log('Checking icon path:', p);
    if (fs.existsSync(p)) {
      iconPath = p;
      console.log('Found icon at:', p);
      break;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hidden',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  let indexPath;
  if (app.isPackaged) {
    const possiblePaths = [
      path.join(__dirname, '../dist/index.html'),
      path.join(process.resourcesPath, 'app', 'dist', 'index.html'),
      path.join(process.resourcesPath, 'dist', 'index.html')
    ];
    
    for (const p of possiblePaths) {
      console.log('Checking path:', p);
      if (fs.existsSync(p)) {
        indexPath = p;
        console.log('Found index.html at:', p);
        break;
      }
    }
    
    if (indexPath) {
      mainWindow.loadURL(
        url.format({
          pathname: indexPath,
          protocol: 'file:',
          slashes: true,
        })
      );
    } else {
      console.error('Could not find index.html');
      mainWindow.loadURL('data:text/html,<h1>Error</h1><p>Could not find index.html. Please check the console for details.</p>');
    }
  } else {
    console.log('Running in development mode, loading from http://localhost:5174');
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  }
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
    initShortcuts();
  });
  
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load page:', errorCode, errorDescription, validatedURL);
    mainWindow.loadURL('data:text/html,<h1>Error</h1><p>Failed to load application. Please check the console for details.</p>');
  });

  mainWindow.on('closed', () => {
    console.log('Main window closed');
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
    
    const { screen } = require('electron');
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
    let newBounds = { ...windowBounds};

    if (Math.abs(leftEdgeDistance) <= threshold) {
      Object.assign(newBounds, {
        x: workArea.x,
        y: workArea.y,
        height: workArea.height
      });
    }
    else if (Math.abs(rightEdgeDistance) <= threshold) {
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

  const { ipcMain } = require('electron');
  
  ipcMain.on('window-minimize', () => {
    console.log('Minimize window requested');
    mainWindow.minimize();
  });
  
  ipcMain.on('window-maximize', () => {
    console.log('Maximize window requested');
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  
  ipcMain.on('window-close', () => {
    console.log('Close window requested');
    mainWindow.hide();
  });
  
  ipcMain.on('open-external', (event, url) => {
    console.log('Open external URL requested:', url);
    shell.openExternal(url);
  });
  
  ipcMain.on('open-file', (event, filePath) => {
    console.log('Open file requested:', filePath);
    shell.openPath(filePath).then(() => {
      console.log('File opened successfully');
    }).catch((error) => {
      console.error('Failed to open file:', error);
    });
  });
  
  ipcMain.handle('select-file', async () => {
    console.log('Select file dialog requested');
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '可执行文件', extensions: ['exe', 'bat', 'cmd', 'lnk'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      console.log('File selected:', result.filePaths[0]);
      return result.filePaths[0];
    }
    return null;
  });
  
  ipcMain.handle('scan-desktop-apps', async () => {
    console.log('[SCAN] Scanning desktop for applications');
    
    const desktopPath = app.getPath('desktop');
    console.log('[SCAN] Desktop path:', desktopPath);
    
    if (!fs.existsSync(desktopPath)) {
      console.log('[SCAN] Desktop path does not exist');
      return [];
    }
    
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
      
      console.log('[SCAN] Found', appFiles.length, 'applications');
      return appFiles;
    } catch (error) {
      console.error('[SCAN] Error scanning desktop:', error);
      return [];
    }
  });

  ipcMain.handle('get-file-icon', async (event, filePath) => {
    console.log('[ICON] Get file icon requested for:', filePath);
    
    if (!filePath) {
      console.log('[ICON] File path is empty');
      return null;
    }
    
    const cacheFilePath = getCacheFilePath(filePath);
    
    if (fs.existsSync(cacheFilePath)) {
      console.log('[ICON] Using cached icon');
      try {
        const buffer = fs.readFileSync(cacheFilePath);
        return buffer.toString('base64');
      } catch (e) {
        console.log('[ICON] Error reading cached icon:', e.message);
      }
    }
    
    if (!isSupportedFileType(filePath)) {
      console.log('[ICON] Unsupported file type:', filePath);
      return null;
    }
    
    const result = await getIconViaPowerShell(filePath, cacheFilePath);
    if (result) {
      console.log('[ICON] Success with PowerShell method');
      return result;
    }
    
    console.log('[ICON] Failed to get icon, returning null');
    return null;
  });

  const getIconViaPowerShell = async (filePath, cacheFilePath) => {
    return new Promise((resolve) => {
      const { execFile } = require('child_process');
      
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
        }
        else {
            $IconPath = $IconLocation.Trim()
        }
        
        if ($IconPath -and (Test-Path -Path $IconPath -PathType Leaf)) {
            return $IconPath
        }
        if (Test-Path -Path $TargetPath -PathType Leaf) {
            return $TargetPath
        }
        else {
            return $ShortcutFilePath
        }
    }
    catch {
        return $ShortcutFilePath
    }
}

function Get-Associated-Icon {
    param(
        [string]$InFilePath,
        [string]$OutFilePath
    )
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
      
      execFile('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', psScript], { timeout: 15000 }, (error, stdout, stderr) => {
        if (stdout?.trim() === 'success' && fs.existsSync(cacheFilePath)) {
          try {
            const buffer = fs.readFileSync(cacheFilePath);
            resolve(buffer.toString('base64'));
            return;
          } catch (e) {
            console.log('[ICON] Error reading cache file:', e.message);
          }
        }
        resolve(null);
      });
    });
  };

  ipcMain.handle('get-autostart-status', () => {
    console.log('[AUTOSTART] Get autostart status requested');
    const settings = app.getLoginItemSettings();
    console.log('[AUTOSTART] Autostart status:', settings.openAtLogin);
    return settings.openAtLogin;
  });
  
  ipcMain.handle('set-autostart-status', (event, enable) => {
    console.log('[AUTOSTART] Set autostart status requested:', enable);
    app.setLoginItemSettings({
      args: [],
      openAtLogin: enable,
      path: process.execPath,
    });
    console.log('[AUTOSTART] Autostart status set to:', enable);
    
    const settings = loadSettings();
    settings.isAutoLaunch = enable ? 1 : 0;
    saveSettings(settings);
    
    return true;
  });
  
  ipcMain.handle('get-settings', () => {
    console.log('[SETTINGS] Get settings requested');
    const settings = loadSettings();
    const result = Object.keys(settings).map(key => ({
      name: key,
      value: settings[key]
    }));
    return result;
  });
  
  ipcMain.handle('update-setting', (event, setting) => {
    console.log('[SETTINGS] Update setting requested:', setting);
    const settings = loadSettings();
    settings[setting.name] = setting.value;
    saveSettings(settings);
    
    if (setting.name === 'isAutoLaunch') {
      app.setLoginItemSettings({
        args: [],
        openAtLogin: setting.value === 1,
        path: process.execPath,
      });
    }
    
    if (setting.name === 'isMemoryOptimizationEnabled') {
      startMemoryOptimization();
    }
    
    mainWindow?.webContents.send('setting-changed', { name: setting.name, value: setting.value });
    
    return { code: 0, msg: '设置已更新' };
  });
  
  ipcMain.handle('clear-cache', async () => {
    console.log('[CACHE] Clear cache requested');
    try {
      const userDataPath = app.getPath('userData');
      
      const cacheFolders = [
        path.join(userDataPath, 'icon-cache'),
        path.join(userDataPath, 'Cache'),
        path.join(userDataPath, 'Code Cache'),
        path.join(userDataPath, 'GPUCache'),
        path.join(userDataPath, 'Service Worker')
      ];

      cacheFolders.forEach(folder => {
        if (fs.existsSync(folder)) {
          try {
            fs.rmSync(folder, { recursive: true, force: true });
            console.log(`[CACHE] Cleared folder: ${folder}`);
          } catch (folderError) {
            console.warn(`[CACHE] Failed to clear folder ${folder}:`, folderError.message);
          }
        }
      });

      fs.mkdirSync(path.join(userDataPath, 'icon-cache'), { recursive: true });

      if (mainWindow && mainWindow.webContents) {
        try {
          await mainWindow.webContents.session.clearCache();
          await mainWindow.webContents.session.clearStorageData();
          console.log('[CACHE] Cleared browser session cache');
        } catch (sessionError) {
          console.warn('[CACHE] Failed to clear session cache:', sessionError.message);
        }
      }

      console.log('[CACHE] All cache cleared successfully');
      return { code: 0, msg: '缓存已清除' };
    } catch (error) {
      console.error('[CACHE] Failed to clear cache:', error);
      return { code: -1, msg: '清除缓存失败: ' + error.message };
    }
  });
  
  ipcMain.handle('get-shortcuts', () => {
    console.log('[SHORTCUTS] Get shortcuts requested');
    const shortcuts = loadShortcuts();
    return shortcuts;
  });
  
  ipcMain.handle('update-shortcut', (event, shortcut) => {
    console.log('[SHORTCUTS] Update shortcut requested:', shortcut);
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
        if (success) {
          message = '快捷键状态已更新';
        }
      } else {
        success = updateShortcut(shortcuts[index], oldShortcut);
        if (!success) {
          message = '快捷键已被占用';
        }
      }
      
      return { code: success ? 0 : -1, msg: message, data: shortcuts[index] };
    }
    return { code: -1, msg: '快捷键不存在' };
  });
  
  ipcMain.handle('get-version', async () => {
    console.log('[VERSION] Get version requested');
    let newVersion = '未知';
    let downloadUrl = 'https://github.com/fqyjfb/ToolBox';
    
    try {
      const https = require('https');
      const options = {
        hostname: 'api.github.com',
        path: '/repos/fqyjfb/ToolBox/releases/latest',
        headers: {
          'User-Agent': 'ToolBox-App'
        }
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
      console.log('[VERSION] Checked latest version:', newVersion);
    } catch (error) {
      console.error('[VERSION] Failed to check updates:', error);
    }
    
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      newVersion: newVersion,
      github: 'https://github.com/fqyjfb/ToolBox',
      download: downloadUrl
    };
  });
  
  ipcMain.handle('download-update', async (event, url) => {
    console.log('[UPDATE] Download update requested:', url);
    try {
      const https = require('https');
      const path = require('path');
      const fs = require('fs');
      
      const downloadPath = path.join(app.getPath('downloads'), 'ToolBox-Setup.exe');
      
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
            console.log('[UPDATE] Download completed:', downloadPath);
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
      console.error('[UPDATE] Download error:', error);
      return { code: -1, msg: `下载失败: ${error.message}` };
    }
  });
  
  ipcMain.handle('install-update', async (event, filePath) => {
    console.log('[UPDATE] Install update requested:', filePath);
    try {
      const { execFile } = require('child_process');
      
      return new Promise((resolve, reject) => {
        execFile(filePath, [], (error) => {
          if (error) {
            console.error('[UPDATE] Install error:', error);
            reject({ code: -1, msg: `安装启动失败: ${error.message}` });
          } else {
            console.log('[UPDATE] Installer started successfully');
            resolve({ code: 0, msg: '安装程序已启动' });
          }
        });
      });
    } catch (error) {
      console.error('[UPDATE] Install error:', error);
      return { code: -1, msg: `安装失败: ${error.message}` };
    }
  });
  
  ipcMain.on('open-internal', (event, url) => {
    console.log('Open internal URL requested:', url);
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
    
    internalWindow.loadURL(url);
    
    const { Menu, MenuItem } = require('electron');
    const menu = new Menu();
    
    menu.append(new MenuItem({
      label: '导航',
      submenu: [
        { 
          label: '后退', 
          accelerator: 'Alt+左箭头',
          click: () => {
            if (internalWindow.webContents.canGoBack()) {
              internalWindow.webContents.goBack();
            }
          },
          enabled: false
        },
        { 
          label: '前进', 
          accelerator: 'Alt+右箭头',
          click: () => {
            if (internalWindow.webContents.canGoForward()) {
              internalWindow.webContents.goForward();
            }
          },
          enabled: false
        },
        { type: 'separator' },
        { 
          label: '刷新', 
          accelerator: 'F5',
          click: () => {
            internalWindow.webContents.reload();
          }
        },
        { 
          label: '停止', 
          accelerator: 'Esc',
          click: () => {
            internalWindow.webContents.stop();
          }
        },
      ]
    }));
    
    menu.append(new MenuItem({
      label: '编辑',
      submenu: [
        { 
          label: '复制', 
          accelerator: 'Ctrl+C',
          role: 'copy'
        },
        { 
          label: '粘贴', 
          accelerator: 'Ctrl+V',
          role: 'paste'
        },
        { 
          label: '剪切', 
          accelerator: 'Ctrl+X',
          role: 'cut'
        },
        { type: 'separator' },
        { 
          label: '全选', 
          accelerator: 'Ctrl+A',
          role: 'selectAll'
        },
      ]
    }));
    
    menu.append(new MenuItem({
      label: '查看',
      submenu: [
        { 
          label: '重新加载', 
          accelerator: 'Ctrl+R',
          click: () => {
            internalWindow.webContents.reload();
          }
        },
        { type: 'separator' },
        { 
          label: '开发者工具', 
          accelerator: 'F12',
          click: () => {
            internalWindow.webContents.toggleDevTools();
          }
        },
        { type: 'separator' },
        { 
          label: '全屏', 
          accelerator: 'F11',
          click: () => {
            internalWindow.setFullScreen(!internalWindow.isFullScreen());
          }
        },
      ]
    }));
    
    menu.append(new MenuItem({
      label: '窗口',
      submenu: [
        { 
          label: '最小化', 
          accelerator: 'Ctrl+M',
          click: () => {
            internalWindow.minimize();
          }
        },
        { 
          label: '最大化', 
          accelerator: 'Ctrl+Shift+M',
          click: () => {
            if (internalWindow.isMaximized()) {
              internalWindow.unmaximize();
            } else {
              internalWindow.maximize();
            }
          }
        },
        { type: 'separator' },
        { 
          label: '关闭', 
          accelerator: 'Ctrl+W',
          click: () => {
            internalWindow.close();
          }
        },
      ]
    }));
    
    menu.append(new MenuItem({
      label: '帮助',
      submenu: [
        { 
          label: '关于 ToolBox', 
          click: () => {
            console.log('About ToolBox');
          }
        },
      ]
    }));
    
    internalWindow.setMenu(menu);
    
    internalWindow.webContents.on('did-navigate', () => {
      const menuItem = menu.items[0].submenu.items[0];
      menuItem.enabled = internalWindow.webContents.canGoBack();
      menu.items[0].submenu.items[1].enabled = internalWindow.webContents.canGoForward();
    });
    
    internalWindow.on('closed', () => {
      console.log('Internal browser window closed');
    });
  });
  
};

const createTray = () => {
  console.log('Creating tray...');
  let iconPath = null;
  const iconPaths = [
    path.join(__dirname, '../public/favicon.png'),
    path.join(__dirname, '../dist/favicon.png'),
    path.join(process.resourcesPath, 'app', 'public', 'favicon.png'),
    path.join(process.resourcesPath, 'app', 'dist', 'favicon.png'),
    path.join(process.resourcesPath, 'public', 'favicon.png'),
    path.join(process.resourcesPath, 'dist', 'favicon.png')
  ];
  
  console.log('Checking icon paths:');
  for (const p of iconPaths) {
    console.log('Checking icon path:', p);
    if (fs.existsSync(p)) {
      iconPath = p;
      console.log('Found icon at:', p);
      break;
    }
  }
  
  let icon;
  if (iconPath) {
    try {
      icon = nativeImage.createFromPath(iconPath);
      console.log('Created icon from path:', iconPath);
    } catch (error) {
      console.error('Error creating icon from path:', error);
      icon = nativeImage.createEmpty();
    }
  } else {
    console.log('No icon found, using empty icon');
    icon = nativeImage.createEmpty();
  }
  
  try {
    tray = new Tray(icon);
    console.log('Created tray');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '系统关机',
        click: () => {
          console.log('Shutdown clicked');
          exec('shutdown /s /t 0', (error) => {
            if (error) {
              console.error('Error shutting down:', error);
              dialog.showErrorBox('错误', '无法执行关机操作');
            }
          });
        },
      },
      {
        label: '系统重启',
        click: () => {
          console.log('Restart clicked');
          exec('shutdown /r /t 0', (error) => {
            if (error) {
              console.error('Error restarting:', error);
              dialog.showErrorBox('错误', '无法执行重启操作');
            }
          });
        },
      },
      {
        label: '清空回收站',
        click: () => {
          console.log('Empty Recycle Bin clicked');
          exec('powershell -Command "Clear-RecycleBin -Force; exit 0"', (error, stdout, stderr) => {
            console.log('Recycle bin command completed');
            dialog.showMessageBox({
              type: 'info',
              title: '提示',
              message: '回收站已清空',
            });
          });
        },
      },
      {
        type: 'separator',
      },
      {
        label: '程序重启',
        click: () => {
          console.log('Restart ToolBox clicked');
          app.relaunch();
          app.quit();
        },
      },
      {
        label: '程序设置',
        click: () => {
          console.log('Settings clicked');
          if (mainWindow) {
            mainWindow.show();
            mainWindow.webContents.send('navigate-to', '/settings');
          }
        },
      },
      {
        type: 'separator',
      },
      {
        label: '程序退出',
        click: () => {
          console.log('Quit clicked');
          app.quit();
        },
      },
    ]);

    tray.setToolTip('ToolBox');
    tray.setContextMenu(contextMenu);
    console.log('Set tray context menu');

    tray.on('click', () => {
      console.log('Tray clicked');
      if (mainWindow && mainWindow.isVisible()) {
        mainWindow.hide();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (error) {
    console.error('Error creating tray:', error);
  }
};

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});