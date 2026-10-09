// 定时提醒 IPC 通道：供前端 ReminderService 调用主进程的计划任务管理。
// 遵循 sqliteIpc.cjs 注册模式。
const { ipcMain } = require('electron');
const reminderScheduler = require('../services/reminderScheduler.cjs');
const { notifyReminder } = require('../services/reminderNotifier.cjs');

let registered = false;

function registerReminderIpc() {
  if (registered) return;
  registered = true;

  // 创建/更新计划任务（先删后建）
  ipcMain.handle('reminder:schedule', (_e, reminder) =>
    reminderScheduler.scheduleTask(reminder));

  // 删除计划任务
  ipcMain.handle('reminder:remove', (_e, id) =>
    reminderScheduler.removeTask(id));

  // 手动触发提醒（用于"立即触发"按钮）：与主进程定时触发共用 reminderNotifier
  ipcMain.handle('reminder:notify', (_e, reminder) => notifyReminder(reminder));
}

module.exports = { registerReminderIpc };
