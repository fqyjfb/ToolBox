const { BrowserWindow, ipcMain, dialog, screen, app } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { loadSettings, saveSettings, isDarkTheme, loadThemeSnapshot, saveThemeSnapshot } = require('../lib/config.cjs');
const lockSleepService = require('../services/lockSleepService.cjs');

const AUX_RESTORE_DELAY_MS = 500;
const LOCK_RESTORE_TIMEOUT_MS = 15000;

let lockWindow = null;
let restoreTimeout = null;
let dragOffset = { x: 0, y: 0 };

// 防暴力破解：连续失败达到上限后进入冷却，冷却时长每次翻倍（封顶 10 分钟）
const MAX_LOCK_ATTEMPTS = 5;

const getLockPasswordPath = () => {
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

// 模块顶层注册 before-quit，避免 createLockWindow 重复调用时累积监听器
app.on('before-quit', () => {
  isAppQuitting = true;
  lockSleepService.dispose();
  if (restoreTimeout) clearTimeout(restoreTimeout);
  if (lockWindow && !lockWindow.isDestroyed()) {
    lockWindow.removeAllListeners('close');
    lockWindow.close();
  }
});

const createLockWindow = () => {
  if (lockWindow) {
    lockWindow.show();
    lockWindow.focus();
    return lockWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowWidth = 208;
  const windowHeight = 248;
  const x = Math.floor((width - windowWidth) / 2);
  const y = Math.floor((height - windowHeight) / 2);

  // 窗口底色跟随应用主题（含自定义），避免窗口出现早于页面首帧时闪白
  const themeSnapshot = loadThemeSnapshot();

  lockWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    hasShadow: false,
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
  const floatWindow = require('./floatWindow.cjs').getFloatWindow();
  const stickyNoteWallWindow = require('./stickyNoteWallWindow.cjs');
  const candidates = {
    mainWindow,
    floatWindow,
    wallWindow: stickyNoteWallWindow.getWallWindow(),
  };

  if (mainWindow) mainWindow.hide();
  if (floatWindow) floatWindow.hide();

  // 钉桌面便签跟随应用锁隐藏，避免锁屏后便签内容仍暴露在桌面上
  try {
    stickyNoteWallWindow.hideWall();
  } catch (error) {
    console.error('[Lock] 隐藏钉桌面便签失败:', error.message);
  }

  createLockWindow();
  lockSleepService.startLockCycle(candidates);
  require('./tray.cjs').refreshTrayMenu();

  // 应用锁联动：锁定配置的外部应用（fire-and-forget，异常自吞不影响锁定主流程）
  try {
    require('../services/appLockService.cjs').onAppLocked();
  } catch (error) {
    console.error('[AppLock] 联动锁定外部应用失败:', error.message);
  }

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

const finalizeUnlock = () => {
  try {
    require('../services/appLockService.cjs').onAppUnlocking();
  } catch (error) {
    console.error('[AppLock] 联动恢复外部应用失败:', error.message);
  }

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
  require('./tray.cjs').refreshTrayMenu();
};

const restorePinnedWall = () => {
  const wallModule = require('./stickyNoteWallWindow.cjs');
  if (wallModule.getWallWindow()) {
    wallModule.showWall();
    return;
  }
  if (require('../services/stickyNotesService.cjs').listPinned().length > 0) {
    wallModule.openWall();
  }
};

const restoreAuxiliaryWindows = (restoreState) => {
  setTimeout(() => {
    const settings = loadSettings();
    if (!lockSleepService.isRestoreCycleActive(restoreState.cycleId) || settings.isLockEnabled === 1) return;
    const snapshot = restoreState.snapshot;
    if ((!snapshot || snapshot.restoreFloat) && settings.isFloatWindowEnabled === 1) {
      require('./floatWindow.cjs').createFloatWindow();
    }
    if (snapshot && !snapshot.restoreWall) return;
    try {
      restorePinnedWall();
    } catch (error) {
      console.error('[Lock] 恢复钉桌面便签失败:', error.message);
    }
  }, AUX_RESTORE_DELAY_MS);
};

const unlockDirectly = (restoreState) => {
  finalizeUnlock();
  require('../main.cjs').createWindowOnUnlock({ restoreAuxWindows: false });
  restoreAuxiliaryWindows(restoreState);
  return { success: true };
};

const failDeepRestore = (restoreState) => {
  const mainWindowModule = require('./mainWindow.cjs');
  const mainWindow = mainWindowModule.getMainWindow();
  if (mainWindow) mainWindowModule.destroyForLockSleep(mainWindow);
  lockSleepService.retainDeepSleep(restoreState.snapshot);
  if (lockWindow && !lockWindow.isDestroyed()) {
    lockWindow.show();
    lockWindow.focus();
  }
  return { success: false, error: '主窗口恢复失败，请重试' };
};

const settleDeepRestore = (restoreState, success, resolve) => {
  if (!lockSleepService.isRestoreCycleActive(restoreState.cycleId)) {
    resolve({ success: false, error: '恢复已取消' });
    return;
  }
  if (!success) {
    resolve(failDeepRestore(restoreState));
    return;
  }
  finalizeUnlock();
  restoreAuxiliaryWindows(restoreState);
  resolve({ success: true });
};

const unlockFromDeepSleep = (restoreState) => new Promise((resolve) => {
  let settled = false;
  const finish = (success) => {
    if (settled) return;
    settled = true;
    if (restoreTimeout) clearTimeout(restoreTimeout);
    restoreTimeout = null;
    settleDeepRestore(restoreState, success, resolve);
  };

  restoreTimeout = setTimeout(() => finish(false), LOCK_RESTORE_TIMEOUT_MS);
  try {
    require('../main.cjs').createWindowOnUnlock({
      initialHash: restoreState.snapshot.mainHash,
      restoreAuxWindows: false,
      preserveShortcuts: true,
      showOnLoadError: false,
      onReady: () => finish(true),
      onLoadError: () => finish(false),
    });
  } catch (error) {
    console.error('[Lock] 主窗口恢复失败:', error.message);
    finish(false);
  }
});

const unlock = () => {
  const restoreState = lockSleepService.beginUnlock();
  return restoreState.deepSleep
    ? unlockFromDeepSleep(restoreState)
    : unlockDirectly(restoreState);
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
  const cooldownUntil = settings.lockCooldownUntil || 0;
  return {
    isLockEnabled: settings.isLockEnabled === 1,
    lockPassword: settings.lockPassword,
    cooldownRemainingSeconds: cooldownUntil > Date.now()
      ? Math.ceil((cooldownUntil - Date.now()) / 1000)
      : 0,
  };
};

let lockIpcHandlersRegistered = false;

const registerLockIpcHandlers = () => {
  if (lockIpcHandlersRegistered) return;
  lockIpcHandlersRegistered = true;

  ipcMain.handle('lock:verifyPassword', async (event, password) => {
    const settings = loadSettings();
    const now = Date.now();
    const cooldownUntil = settings.lockCooldownUntil || 0;

    // 冷却期内一律拒绝，不再做哈希比对
    if (now < cooldownUntil) {
      return {
        success: false,
        remainingAttempts: 0,
        cooldownSeconds: Math.ceil((cooldownUntil - now) / 1000),
      };
    }

    const passwordFile = getLockPasswordPath();
    if (!fs.existsSync(passwordFile)) {
      return { success: false, remainingAttempts: MAX_LOCK_ATTEMPTS, cooldownSeconds: 0 };
    }

    let isValid = false;
    try {
      const data = JSON.parse(fs.readFileSync(passwordFile, 'utf-8'));
      isValid = verifyPassword(password, data.salt, data.passwordHash);
    } catch (error) {
      console.error('Failed to verify password:', error);
      return { success: false, remainingAttempts: MAX_LOCK_ATTEMPTS, cooldownSeconds: 0 };
    }

    if (isValid) {
      if (settings.lockFailedAttempts || settings.lockCooldownUntil) {
        settings.lockFailedAttempts = 0;
        settings.lockCooldownUntil = null;
        saveSettings(settings);
      }
      return { success: true, remainingAttempts: MAX_LOCK_ATTEMPTS, cooldownSeconds: 0 };
    }

    // 失败计数持久化在 settings，重开锁屏窗口 / 重启应用都不清零
    const attempts = (settings.lockFailedAttempts || 0) + 1;
    settings.lockFailedAttempts = attempts;

    if (attempts >= MAX_LOCK_ATTEMPTS) {
      const cooldownSeconds = Math.min(30 * 2 ** (attempts - MAX_LOCK_ATTEMPTS), 600);
      settings.lockCooldownUntil = now + cooldownSeconds * 1000;
      saveSettings(settings);
      return { success: false, remainingAttempts: 0, cooldownSeconds };
    }

    saveSettings(settings);
    return { success: false, remainingAttempts: MAX_LOCK_ATTEMPTS - attempts, cooldownSeconds: 0 };
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
        // 换密码后旧的失败记录与冷却一并作废
        settings.lockFailedAttempts = 0;
        settings.lockCooldownUntil = null;
        saveSettings(settings);

        require('./mainWindow.cjs').resetAutoLockTimer();
        require('./mainWindow.cjs').startAutoLock();
      } else {
        if (fs.existsSync(passwordFile)) {
          fs.unlinkSync(passwordFile);
        }

        const settings = loadSettings();
        settings.lockPassword = '';
        settings.lockFailedAttempts = 0;
        settings.lockCooldownUntil = null;
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

  // 主题：锁屏是独立窗口，读不到渲染层的 localStorage，由渲染层把自定义配色同步到主进程
  ipcMain.handle('theme:set-snapshot', (event, colors) => {
    saveThemeSnapshot(colors || null);
    // 翻译浮层同样是独立入口，主题变化时一并广播
    const { getTranslateWindow } = require('./translateWindow.cjs');
    const translateWindow = getTranslateWindow();
    if (translateWindow && !translateWindow.isDestroyed()) {
      translateWindow.webContents.send('theme-changed', {
        isDark: isDarkTheme(),
        snapshot: loadThemeSnapshot(),
      });
    }
    // 悬浮球 AI 面板读的是同一份快照，必须一起刷新，否则自定义配色下会与主窗口不一致
    require('./floatPanelWindow.cjs').notifyPanelTheme();
    return { code: 0 };
  });

  // 同步返回，保证锁屏首帧之前就能上色（避免明暗/自定义主题闪一下）；
  // 顺带带上皮肤配置，锁屏窗口创建时只需这一次同步读取
  ipcMain.on('lock:get-theme-sync', (event) => {
    const settings = loadSettings();
    event.returnValue = {
      isDark: isDarkTheme(),
      colors: loadThemeSnapshot(),
      skin: settings.lockSkin || 'ink',
    };
  });

  ipcMain.handle('lock:unlock', () => unlock());

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

    // 注意：启动/重启即锁场景不联动锁定外部应用（用户明确要求），
    // 仅托盘/悬浮球/快捷键/自动锁定等手动触发的 lock() 才执行联动
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
