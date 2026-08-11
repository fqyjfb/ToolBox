const { BrowserWindow, Menu, screen, ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { loadSettings, saveSettings, loadFloatConfig } = require('../lib/config.cjs');

let floatWindow = null;
let dragOffset = { x: 0, y: 0 };
let pollIgnoring = true;
let isExpanded = false;

// ── 悬浮球形象辅助函数 ──

// 使用 __dirname 解析路径，在 dev 和 asar 打包环境下均能正确工作
const getFloatImgDir = () => path.join(__dirname, '../../public', 'float-img');

const getFloatImgList = () => {
  try {
    const dir = getFloatImgDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.toLowerCase().endsWith('.png'))
      .map(f => f.replace(/\.png$/i, ''))
      .sort();
  } catch {
    return [];
  }
};

const getFloatImgDataUrl = (name) => {
  if (!name) return '';
  try {
    const filePath = path.join(getFloatImgDir(), name + '.png');
    if (!fs.existsSync(filePath)) return '';
    const buffer = fs.readFileSync(filePath);
    return 'data:image/png;base64,' + buffer.toString('base64');
  } catch {
    return '';
  }
};

const createFloatWindow = () => {
  if (floatWindow) {
    floatWindow.show();
    floatWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primaryDisplay = displays[0];
  const { width, height } = primaryDisplay.workAreaSize;

  const defaultX = width - 60 - Math.round(150);
  const defaultY = height - 60 - Math.round(150);

  let x = defaultX;
  let y = defaultY;
  const settings = loadSettings();
  if (settings.floatBallPosition && typeof settings.floatBallPosition.x === 'number' && typeof settings.floatBallPosition.y === 'number') {
    const inBounds =
      settings.floatBallPosition.x >= -150 &&
      settings.floatBallPosition.x <= width - 150 &&
      settings.floatBallPosition.y >= 0 &&
      settings.floatBallPosition.y <= height - 40;
    if (inBounds) {
      x = settings.floatBallPosition.x;
      y = settings.floatBallPosition.y;
    }
  }

  floatWindow = new BrowserWindow({
    width: 300,
    height: 300,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    focusable: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, './float/float-preload.cjs'),
    },
  });

  if (process.platform === 'darwin') {
    floatWindow.setAlwaysOnTop(true, 'floating');
  } else {
    floatWindow.setAlwaysOnTop(true);
  }

  floatWindow.setIgnoreMouseEvents(false);

  const POLL_INTERVAL = 80;
  const BALL_SIZE = 44;
  const pollTimer = setInterval(() => {
    if (!floatWindow || floatWindow.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = floatWindow.getBounds();
    const ballCenterX = bounds.x + Math.round(bounds.width / 2);
    const ballCenterY = bounds.y + Math.round(bounds.height / 2);
    const dx = cursor.x - ballCenterX;
    const dy = cursor.y - ballCenterY;
    const inBall = dx * dx + dy * dy <= (BALL_SIZE / 2 + 4) * (BALL_SIZE / 2 + 4);
    if (inBall) {
      if (pollIgnoring) {
        pollIgnoring = false;
        floatWindow.setIgnoreMouseEvents(false);
      }
    } else if (!isExpanded) {
      if (!pollIgnoring) {
        pollIgnoring = true;
        floatWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, POLL_INTERVAL);

  const floatHtmlPath = path.join(__dirname, './float/float.html');
  const packagedPath = path.join(process.resourcesPath, 'app', 'electron', 'window', 'float', 'float.html');

  if (app.isPackaged && fs.existsSync(packagedPath)) {
    floatWindow.loadFile(packagedPath);
  } else {
    floatWindow.loadFile(floatHtmlPath);
  }

  floatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  floatWindow.once('ready-to-show', () => {
    floatWindow.show();
  });

  floatWindow.on('system-context-menu', (e) => {
    e.preventDefault();
  });

  floatWindow.on('closed', () => {
    clearInterval(pollTimer);
    floatWindow = null;
  });
};

const toggleFloatWindow = () => {
  const settings = loadSettings();
  if (settings.isFloatWindowEnabled === 1) {
    if (floatWindow) {
      floatWindow.close();
      floatWindow = null;
    }
    settings.isFloatWindowEnabled = 0;
    saveSettings(settings);
  } else {
    createFloatWindow();
    settings.isFloatWindowEnabled = 1;
    saveSettings(settings);
  }
  
  const mainWindow = require('./mainWindow.cjs').getMainWindow();
  mainWindow?.webContents.send('setting-changed', { name: 'isFloatWindowEnabled', value: settings.isFloatWindowEnabled });
  
  require('./tray.cjs').refreshTrayMenu();
  
  return settings.isFloatWindowEnabled;
};

// 构建"切换形象"子菜单
const buildAppearanceMenu = (settings) => {
  const imgList = getFloatImgList();
  if (imgList.length === 0) return [];
  const current = settings.floatBallAppearance || '';
  const items = imgList.map(name => ({
    label: name,
    type: 'radio',
    checked: current === name,
    click: () => {
      const s = loadSettings();
      s.floatBallAppearance = name;
      saveSettings(s);
      const dataUrl = getFloatImgDataUrl(name);
      if (floatWindow && !floatWindow.isDestroyed()) {
        floatWindow.webContents.send('appearance-changed', { name, dataUrl });
      }
    }
  }));
  return [{
    label: '切换形象',
    submenu: [
      {
        label: '默认',
        type: 'radio',
        checked: current === '',
        click: () => {
          const s = loadSettings();
          s.floatBallAppearance = '';
          saveSettings(s);
          if (floatWindow && !floatWindow.isDestroyed()) {
            floatWindow.webContents.send('appearance-changed', { name: '', dataUrl: '' });
          }
        }
      },
      { type: 'separator' },
      ...items
    ]
  }];
};

let floatIpcHandlersRegistered = false;

const registerFloatIpcHandlers = () => {
  if (floatIpcHandlersRegistered) return;
  floatIpcHandlersRegistered = true;
  
  ipcMain.on('float-window-action', (event, action) => {
    if (action === 'toggle-lock') {
      require('./lockWindow.cjs').toggleLock();
      return;
    }
    
    const settings = loadSettings();
    const checkLockAndShow = (callback) => {
      if (settings.isLockEnabled === 1) {
        require('./lockWindow.cjs').toggleLock();
        return false;
      }
      callback();
      return true;
    };
    
    const mainWindow = require('./mainWindow.cjs').getMainWindow();
    
    if (action.startsWith('open-app:')) {
      const appPath = action.replace('open-app:', '');
      require('electron').shell.openPath(appPath).catch(err => {});
      return;
    }
    
    if (action.startsWith('plugin:')) {
      const pluginId = action.replace('plugin:', '');
      checkLockAndShow(() => {
        const { openPluginWindow } = require('../ipc/pluginIpc.cjs');
        openPluginWindow(pluginId);
      });
      return;
    }
    
    const actions = {
      home: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate-to', '/'); } },
      tools: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate-to', '/tools'); } },
      quick: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate-to', '/launch'); } },
      bookmark: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate-to', '/nav'); } },
      todo: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate-to', '/tools/todo'); } },
      news: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate-to', '/news'); } },
      settings: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('navigate-to', '/settings'); } },
      'clear-recycle-bin': () => {
        exec('powershell -Command "Clear-RecycleBin -Force; exit 0"', (error) => {
          if (!error) { require('electron').dialog.showMessageBox({ type: 'info', title: '提示', message: '回收站已清空' }); }
        });
      },
      'open-my-computer': () => { require('electron').shell.openExternal('shell:MyComputerFolder').catch(() => {}); },
      shutdown: () => { exec('shutdown /s /t 0'); },
      restart: () => { exec('shutdown /r /t 0'); },
      'restart-app': () => { require('electron').app.relaunch(); require('electron').app.quit(); }
    };
    
    const navAction = action.replace('nav:', '');
     if (typeof actions[navAction] === 'function') {
       checkLockAndShow(() => actions[navAction]());
       return;
     }
     
     if (action.startsWith('nav:')) {
       const navPath = action.replace('nav:', '');
       checkLockAndShow(() => {
         if (mainWindow && navPath) {
           mainWindow.show();
           mainWindow.focus();
           mainWindow.webContents.send('navigate-to', navPath);
         }
       });
       return;
     }
    if (typeof actions[action] === 'function') {
      checkLockAndShow(() => actions[action]());
    }
  });

  ipcMain.on('float-drag-start', () => {
    if (!floatWindow) return;
    const cursor = screen.getCursorScreenPoint();
    const [wx, wy] = floatWindow.getPosition();
    dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  });

  ipcMain.on('float-drag-move', () => {
    if (!floatWindow) return;
    const { x, y } = screen.getCursorScreenPoint();
    floatWindow.setPosition(Math.round(x - dragOffset.x), Math.round(y - dragOffset.y));
  });

  ipcMain.on('float-drag-end', () => {
    if (!floatWindow) return;
    const [bx, by] = floatWindow.getPosition();
    const settings = loadSettings();
    settings.floatBallPosition = { x: bx, y: by };
    saveSettings(settings);
  });

  ipcMain.on('float-set-ignore-events', (_event, ignore) => {
    if (!floatWindow) return;
    floatWindow.setIgnoreMouseEvents(ignore, { forward: ignore });
  });

  ipcMain.on('float-show-context-menu', () => {
    if (!floatWindow) return;
    const settings = loadSettings();
    
    if (settings.isLockEnabled === 1) {
      require('./lockWindow.cjs').toggleLock();
      return;
    }
    
    const checkLockAndShow = (callback) => {
      if (settings.isLockEnabled === 1) {
        require('./lockWindow.cjs').toggleLock();
        return;
      }
      callback();
    };

    const menu = Menu.buildFromTemplate([
      {
        label: '主窗口',
        click: () => { 
          checkLockAndShow(() => {
            const mainWindow = require('./mainWindow.cjs').getMainWindow();
            if (mainWindow) { mainWindow.show(); mainWindow.focus(); } 
          });
        }
      },
      {
        label: '记事本',
        click: () => {
          checkLockAndShow(() => {
            const mainWindow = require('./mainWindow.cjs').getMainWindow();
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('open-notes-chat');
            }
          });
        }
      },
      {
        label: '备忘录',
        click: () => {
          checkLockAndShow(() => {
            const mainWindow = require('./mainWindow.cjs').getMainWindow();
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
              mainWindow.webContents.send('navigate-to', '/tools/memo');
            }
          });
        }
      },
      ...buildAppearanceMenu(settings),
      { type: 'separator' },
      {
        label: '关闭',
        click: () => {
          checkLockAndShow(() => {
            const settings = loadSettings();
            settings.isFloatWindowEnabled = 0;
            saveSettings(settings);
            if (floatWindow) { floatWindow.close(); floatWindow = null; }
            const mainWindow = require('./mainWindow.cjs').getMainWindow();
            mainWindow?.webContents.send('setting-changed', { name: 'isFloatWindowEnabled', value: 0 });
            require('./tray.cjs').refreshTrayMenu();
          });
        }
      }
    ]);
    menu.popup({ window: floatWindow });
  });

  ipcMain.on('float-drop-files', (_event, paths) => {
    paths.forEach(p => { require('electron').shell.openPath(p).catch(err => {}); });
  });

  ipcMain.on('float-expanded', (_event, expanded) => {
    isExpanded = expanded;
    if (expanded && floatWindow) {
      floatWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.handle('toggle-float-window', () => { return toggleFloatWindow(); });

  ipcMain.on('float-config-changed', () => {
    if (floatWindow) {
      floatWindow.webContents.send('float-config-changed', loadFloatConfig());
    }
  });

  ipcMain.handle('float-get-appearance', () => {
    const settings = loadSettings();
    const name = settings.floatBallAppearance || '';
    const dataUrl = name ? getFloatImgDataUrl(name) : '';
    return { name, dataUrl };
  });
};

module.exports = {
  createFloatWindow,
  toggleFloatWindow,
  registerFloatIpcHandlers,
  getFloatWindow: () => floatWindow,
};
