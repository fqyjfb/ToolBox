const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { loadSettings } = require('../lib/config');

let tray = null;

const createTray = () => {
  let iconPath = null;
  const iconPaths = [
    path.join(__dirname, '../../public/favicon.png'),
    path.join(__dirname, '../../dist/favicon.png'),
    path.join(process.resourcesPath, 'app', 'public', 'favicon.png'),
    path.join(process.resourcesPath, 'app', 'dist', 'favicon.png'),
    path.join(process.resourcesPath, 'public', 'favicon.png'),
    path.join(process.resourcesPath, 'dist', 'favicon.png'),
    path.join(process.resourcesPath, 'favicon.png')
  ];

  for (const p of iconPaths) {
    if (fs.existsSync(p)) {
      iconPath = p;
      break;
    }
  }

  let icon;
  if (iconPath) {
    try {
      icon = nativeImage.createFromPath(iconPath);
    } catch (error) {
      icon = nativeImage.createEmpty();
    }
  } else {
    icon = nativeImage.createEmpty();
  }

  try {
    tray = new Tray(icon);
    tray.setToolTip('ToolBox');
    refreshTrayMenu();

    tray.on('click', () => {
      const mainWindow = require('./mainWindow').getMainWindow();
      if (mainWindow && mainWindow.isVisible()) {
        mainWindow.hide();
      } else if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
};

const refreshTrayMenu = () => {
  if (!tray) return;
  const settings = loadSettings();
  const floatWindowLabel = settings.isFloatWindowEnabled === 1 ? '关闭悬浮窗' : '开启悬浮窗';

  const newContextMenu = Menu.buildFromTemplate([
    {
      label: '新建待办',
      click: () => {
        const mainWindow = require('./mainWindow').getMainWindow();
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/tools/todo');
          setTimeout(() => {
            mainWindow.webContents.send('open-add-todo');
          }, 300);
        }
      },
    },
    { type: 'separator' },
    {
      label: '功能',
      submenu: [
        {
          label: '清空回收站',
          click: () => {
            exec('powershell -ExecutionPolicy Bypass -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; exit 0"', (error) => {
              const { dialog } = require('electron');
              if (!error) {
                dialog.showMessageBox({ type: 'info', title: '提示', message: '回收站已清空' });
              } else {
                dialog.showMessageBox({ type: 'error', title: '错误', message: '清空回收站失败，请以管理员身份运行' });
              }
            });
          },
        },
        {
          label: '我的电脑',
          click: () => { require('electron').shell.openExternal('shell:MyComputerFolder').catch(() => {}); },
        },
      ],
    },
    {
      label: '悬浮窗',
      submenu: [
        {
          label: floatWindowLabel,
          click: () => { require('./floatWindow').toggleFloatWindow(); },
        },
      ],
    },
    {
      label: '系统',
      submenu: [
        { label: '关机', click: () => { exec('shutdown /s /t 0'); } },
        { label: '重启', click: () => { exec('shutdown /r /t 0'); } },
      ],
    },
    {
      label: '程序',
      submenu: [
        {
          label: '设置',
          click: () => {
            const mainWindow = require('./mainWindow').getMainWindow();
            if (mainWindow) { mainWindow.show(); mainWindow.webContents.send('navigate-to', '/settings'); }
          },
        },
        {
          label: '日志',
          click: () => {
            require('../logs/window').openLogWindow();
          },
        },
        { label: '重启', click: () => { require('electron').app.relaunch(); require('electron').app.quit(); } },
      ],
    },
    { type: 'separator' },
    { label: '退出', click: () => { require('electron').app.quit(); } },
  ]);

  tray.setContextMenu(newContextMenu);
};

module.exports = {
  createTray,
  refreshTrayMenu,
};
