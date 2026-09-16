const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let quickLoginWindow = null;
let dragOffset = { x: 0, y: 0 };

const createQuickLoginWindow = (payload) => {
  if (quickLoginWindow) {
    quickLoginWindow.destroy();
    quickLoginWindow = null;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowWidth = 340;
  const windowHeight = 400;
  const x = width - windowWidth - 20;
  const y = Math.floor((height - windowHeight) / 2);

  quickLoginWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    resizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, './quickLogin/quick-login-preload.cjs'),
    },
  });

  const htmlPath = path.join(__dirname, './quickLogin/quick-login.html');
  const { app } = require('electron');

  if (app.isPackaged) {
    const packagedPath = path.join(process.resourcesPath, 'app', 'electron', 'window', 'quickLogin', 'quick-login.html');
    if (fs.existsSync(packagedPath)) {
      quickLoginWindow.loadFile(packagedPath);
    } else {
      quickLoginWindow.loadFile(htmlPath);
    }
  } else {
    quickLoginWindow.loadFile(htmlPath);
  }

  quickLoginWindow.webContents.once('did-finish-load', () => {
    quickLoginWindow.show();
    quickLoginWindow.webContents.send('quick-login:data', payload);
  });

  quickLoginWindow.on('closed', () => {
    quickLoginWindow = null;
    const mainWindow = require('./mainWindow.cjs').getMainWindow();
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return quickLoginWindow;
};

const openQuickLogin = (payload) => {
  const mainWindow = require('./mainWindow.cjs').getMainWindow();
  if (mainWindow) {
    mainWindow.hide();
  }
  createQuickLoginWindow(payload);
};

let quickLoginIpcHandlersRegistered = false;

const registerQuickLoginIpcHandlers = () => {
  if (quickLoginIpcHandlersRegistered) return;
  quickLoginIpcHandlersRegistered = true;

  ipcMain.handle('quick-login:open', (event, payload) => {
    openQuickLogin(payload);
    return { success: true };
  });

  ipcMain.on('quick-login:close', () => {
    if (quickLoginWindow) {
      quickLoginWindow.close();
    }
  });

  ipcMain.on('quick-login-drag-start', () => {
    if (!quickLoginWindow) return;
    const cursor = screen.getCursorScreenPoint();
    const [wx, wy] = quickLoginWindow.getPosition();
    dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
  });

  ipcMain.on('quick-login-drag-move', () => {
    if (!quickLoginWindow) return;
    const { x, y } = screen.getCursorScreenPoint();
    quickLoginWindow.setPosition(Math.round(x - dragOffset.x), Math.round(y - dragOffset.y));
  });
};

module.exports = {
  registerQuickLoginIpcHandlers,
  openQuickLogin,
};
