// 定时提醒弹窗：独立的 frameless BrowserWindow，alwaysOnTop + skipTaskbar。
// 触发 notify_method === 'popup' 时由主进程创建/复用，加载 ?standalone=reminder-popup#/reminder-popup 路由。
// 通过 webContents.send('show-reminder', data) 下发提醒内容到弹窗渲染进程。
const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { getAppIcon } = require('../lib/appIcon.cjs');

let popupWindow = null;
let autoCloseTimer = null;

// 自动关闭时长（毫秒）：30 秒后未手动关闭则自动消失
const AUTO_CLOSE_MS = 30000;

function showReminderPopup(reminder) {
  // 已存在则复用：仅刷新数据并聚焦
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.webContents.send('show-reminder', reminder);
    popupWindow.show();
    popupWindow.focus();
    resetAutoCloseTimer();
    return;
  }

  const { workArea } = screen.getPrimaryDisplay();
  const width = 400;
  const height = 320;

  popupWindow = new BrowserWindow({
    width,
    height,
    x: workArea.x + workArea.width - width - 20,
    y: workArea.y + workArea.height - height - 20,
    title: '定时提醒',
    icon: getAppIcon(),
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  popupWindow.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}?standalone=reminder-popup#/reminder-popup`);

  popupWindow.once('ready-to-show', () => {
    popupWindow.webContents.send('show-reminder', reminder);
    popupWindow.show();
    popupWindow.focus();
    resetAutoCloseTimer();
  });

  popupWindow.on('closed', () => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }
    popupWindow = null;
  });
}

function resetAutoCloseTimer() {
  if (autoCloseTimer) clearTimeout(autoCloseTimer);
  autoCloseTimer = setTimeout(() => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.close();
    }
  }, AUTO_CLOSE_MS);
}

module.exports = { showReminderPopup };
