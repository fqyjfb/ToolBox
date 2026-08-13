const { BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { loadSettings, saveSettings } = require('../lib/config.cjs');

let lockWindow = null;
let dragOffset = { x: 0, y: 0 };

const getLockPasswordPath = () => {
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'lockPassword.json');
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { salt, hash };
};

const verifyPassword = (password, storedSalt, storedHash) => {
  const hash = crypto.pbkdf2Sync(password, storedSalt, 100000, 64, 'sha512').toString('hex');
  return hash === storedHash;
};

let isAppQuitting = false;

const createLockWindow = () => {
  if (lockWindow) {
    lockWindow.show();
    lockWindow.focus();
    return lockWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowWidth = 360;
  const windowHeight = 280;
  const x = Math.floor((width - windowWidth) / 2);
  const y = Math.floor((height - windowHeight) / 2);

  lockWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, './lock/lock-preload.cjs'),
    },
  });

  const lockHtmlPath = path.join(__dirname, './lock/lock.html');
  const { app } = require('electron');

  app.on('before-quit', () => {
    isAppQuitting = true;
    if (lockWindow) {
      lockWindow.removeAllListeners('close');
      lockWindow.close();
    }
  });

  if (app.isPackaged) {
    const packagedPath = path.join(process.resourcesPath, 'app', 'electron', 'window', 'lock', 'lock.html');
    if (fs.existsSync(packagedPath)) {
      lockWindow.loadFile(packagedPath);
    } else {
      lockWindow.loadFile(lockHtmlPath);
    }
  } else {
    lockWindow.loadFile(lockHtmlPath);
  }

  lockWindow.once('ready-to-show', () => {
    lockWindow.show();
  });

  lockWindow.on('close', (e) => {
    if (!isAppQuitting && lockWindow) {
      e.preventDefault();
      lockWindow.hide();
    }
  });

  return lockWindow;
};

const lock = () => {
  const settings = loadSettings();

  if (!settings.lockPassword) {
    return false;
  }

  if (settings.isLockEnabled === 1) {
    return false;
  }

  settings.isLockEnabled = 1;
  settings.lockedAt = Date.now();
  saveSettings(settings);

  const mainWindow = require('./mainWindow.cjs').getMainWindow();
  if (mainWindow) {
    mainWindow.hide();
  }

  const floatWindow = require('./floatWindow.cjs').getFloatWindow();
  if (floatWindow) {
    floatWindow.hide();
  }

  createLockWindow();
  require('./tray.cjs').refreshTrayMenu();

  return true;
};

const lockOrPrompt = () => {
  const settings = loadSettings();

  if (!settings.lockPassword) {
    dialog.showMessageBox({
      type: 'info',
      title: '设置锁定密码',
      message: '请先设置锁定密码',
      detail: '点击确定前往设置页面设置锁定密码',
      buttons: ['确定', '取消'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        const mainWindow = require('./mainWindow.cjs').getMainWindow();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/settings');
        }
      }
    });
    return false;
  }

  return lock();
};

const unlock = () => {
  const settings = loadSettings();
  settings.isLockEnabled = 0;
  settings.lockedAt = null;
  saveSettings(settings);

  require('./mainWindow.cjs').resetAutoLockTimer();

  if (lockWindow) {
    lockWindow.removeAllListeners('close');
    lockWindow.close();
    lockWindow = null;
  }

  require('../main.cjs').createWindowOnUnlock();
  require('./tray.cjs').refreshTrayMenu();

  setTimeout(() => {
    if (settings.isFloatWindowEnabled === 1) {
      require('./floatWindow.cjs').createFloatWindow();
    }
  }, 500);
};

const toggleLock = () => {
  const settings = loadSettings();
  if (settings.isLockEnabled === 1) {
    if (lockWindow) {
      lockWindow.show();
      lockWindow.focus();
    } else {
      createLockWindow();
    }
  } else {
    lock();
  }
};

const getLockStatus = () => {
  const settings = loadSettings();
  return {
    isLockEnabled: settings.isLockEnabled === 1,
    lockPassword: settings.lockPassword,
  };
};

let lockIpcHandlersRegistered = false;

const registerLockIpcHandlers = () => {
  if (lockIpcHandlersRegistered) return;
  lockIpcHandlersRegistered = true;

  ipcMain.handle('lock:verifyPassword', async (event, password) => {
    const passwordFile = getLockPasswordPath();
    if (!fs.existsSync(passwordFile)) {
      return false;
    }

    try {
      const data = JSON.parse(fs.readFileSync(passwordFile, 'utf-8'));
      return verifyPassword(password, data.salt, data.passwordHash);
    } catch (error) {
      console.error('Failed to verify password:', error);
      return false;
    }
  });

  ipcMain.handle('lock:setPassword', async (event, password) => {
    const passwordFile = getLockPasswordPath();
    const { salt, hash } = hashPassword(password);

    try {
      if (password) {
        fs.writeFileSync(passwordFile, JSON.stringify({
          passwordHash: hash,
          salt: salt,
          createdAt: new Date().toISOString(),
        }));

        const settings = loadSettings();
        settings.lockPassword = hash;
        saveSettings(settings);

        require('./mainWindow.cjs').resetAutoLockTimer();
        require('./mainWindow.cjs').startAutoLock();
      } else {
        if (fs.existsSync(passwordFile)) {
          fs.unlinkSync(passwordFile);
        }

        const settings = loadSettings();
        settings.lockPassword = '';
        saveSettings(settings);

        require('./mainWindow.cjs').stopAutoLock();
      }

      return { success: true };
    } catch (error) {
      console.error('Failed to set password:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('lock:getStatus', () => {
    return getLockStatus();
  });

  ipcMain.handle('lock:unlock', () => {
    unlock();
    return { success: true };
  });

  ipcMain.handle('lock:closeWindow', () => {
    if (lockWindow) {
      lockWindow.hide();
    }
    return { success: true };
  });

  ipcMain.handle('lock:exitApp', () => {
    require('electron').app.quit();
    return { success: true };
  });

  ipcMain.on('lock-drag-start', () => {
    if (!lockWindow) return;
    const cursor = screen.getCursorScreenPoint();
    const [wx, wy] = lockWindow.getPosition();
    dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  });

  ipcMain.on('lock-drag-move', () => {
    if (!lockWindow) return;
    const { x, y } = screen.getCursorScreenPoint();
    lockWindow.setPosition(Math.round(x - dragOffset.x), Math.round(y - dragOffset.y));
  });
};

const checkLockOnStartup = () => {
  const settings = loadSettings();

  if (settings.lockPassword && settings.lockPassword !== '') {
    settings.isLockEnabled = 1;
    settings.lockedAt = Date.now();
    saveSettings(settings);
    
    require('./mainWindow.cjs').resetAutoLockTimer();
    
    createLockWindow();
    return true;
  }

  return false;
};

module.exports = {
  lock,
  lockOrPrompt,
  unlock,
  toggleLock,
  getLockStatus,
  createLockWindow,
  registerLockIpcHandlers,
  checkLockOnStartup,
};
