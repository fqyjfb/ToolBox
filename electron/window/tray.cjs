const { Tray, Menu, nativeImage } = require('electron');
const { exec } = require('child_process');
const { loadSettings } = require('../lib/config.cjs');
const { getAppIcon } = require('../lib/appIcon.cjs');

let tray = null;

const createTray = () => {
  if (tray) return;
  
  // 与所有窗口共用同一份图标解析（含打包后 asar 外真实文件优先）
  let icon;
  try {
    icon = getAppIcon() || nativeImage.createEmpty();
  } catch (error) {
    icon = nativeImage.createEmpty();
  }

  try {
    tray = new Tray(icon);
    tray.setToolTip('ToolBox');
    refreshTrayMenu();

    tray.on('click', () => {
      const settings = loadSettings();
      if (settings.isLockEnabled === 1) {
        require('./lockWindow.cjs').toggleLock();
        return;
      }
      const windowModule = require('./mainWindow.cjs');
      const mainWindow = windowModule.getMainWindow();
      if (!mainWindow) return;
      // 停靠（贴边吸附）态：左键切换「折叠 ⇄ 展开」；非停靠态保持原 显示/隐藏 切换
      if (windowModule.isWindowEdgeDocked()) {
        windowModule.toggleEdgeDockWindow();
        return;
      }
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
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

  if (settings.isLockEnabled === 1) {
    const lockMenu = Menu.buildFromTemplate([
      {
        label: '解锁',
        click: () => {
          require('./lockWindow.cjs').toggleLock();
        },
      },
      { type: 'separator' },
      { label: '退出', click: () => { require('electron').app.quit(); } },
    ]);
    tray.setContextMenu(lockMenu);
    return;
  }

  const floatWindowLabel = settings.isFloatWindowEnabled === 1 ? '关闭悬浮窗' : '开启悬浮窗';

  const checkLockAndShow = (callback) => {
    if (settings.isLockEnabled === 1) {
      require('./lockWindow.cjs').toggleLock();
      return;
    }
    callback();
  };

  const newContextMenu = Menu.buildFromTemplate([
    {
      label: '新建待办',
      click: () => {
        checkLockAndShow(() => {
          const mainWindow = require('./mainWindow.cjs').getMainWindow();
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate-to', '/tools/todo');
            setTimeout(() => {
              mainWindow.webContents.send('open-add-todo');
            }, 300);
          }
        });
      },
    },
    {
      label: '新建备忘',
      click: () => {
        checkLockAndShow(() => {
          const mainWindow = require('./mainWindow.cjs').getMainWindow();
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate-to', '/tools/memo');
            setTimeout(() => {
              mainWindow.webContents.send('open-add-memo');
            }, 300);
          }
        });
      },
    },
    {
      label: '新建提醒',
      click: () => {
        checkLockAndShow(() => {
          const mainWindow = require('./mainWindow.cjs').getMainWindow();
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('navigate-to', '/tools/reminder');
            setTimeout(() => {
              mainWindow.webContents.send('open-add-reminder');
            }, 300);
          }
        });
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
          click: () => {
            checkLockAndShow(() => {
              require('./floatWindow.cjs').toggleFloatWindow();
            });
          },
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
            checkLockAndShow(() => {
              const mainWindow = require('./mainWindow.cjs').getMainWindow();
              if (mainWindow) { mainWindow.show(); mainWindow.webContents.send('navigate-to', '/settings'); }
            });
          },
        },
        {
          label: '日志',
          click: () => {
            checkLockAndShow(() => {
              require('../logs/window.cjs').openLogWindow();
            });
          },
        },
        { label: '重启', click: () => { require('electron').app.relaunch(); require('electron').app.quit(); } },
      ],
    },
    { type: 'separator' },
    {
      label: '锁定',
      click: () => {
        require('./lockWindow.cjs').lockOrPrompt();
      },
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
