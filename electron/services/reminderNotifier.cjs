// 提醒呈现的唯一出口：主进程触发路径（计划任务冷/热唤醒、启动到期补偿）
// 与渲染进程「立即触发」共用同一实现。
//
// Windows 上系统通知改由 node-notifier 走内嵌 SnoreToast 直接调用 Win32 Toast，
// 不再使用 Electron 内置 Notification —— 后者在「计划任务冷拉起、主窗口隐藏」路径上
// 会静默丢弃通知（Toast 子系统/AUMID 注册时序 + 通知对象生命周期），
// 表现为「重启后系统提醒不弹出」，且失败无任何回调、无法自愈。
// node-notifier 在进程外呈现且提供显式错误回调，任何失败一律回退弹窗，提醒不会静默丢失。
const { app } = require('electron');
const { showReminderPopup } = require('../window/reminderPopupWindow.cjs');

// 与 package.json 的 build.appId、main.cjs 的 app.setAppUserModelId 保持一致
const APP_ID = 'com.toolbox.app';

// 通知回调超时兜底：回调始终 resolve，避免 fireReminder 卡住导致重复提醒不再重新注册
const NOTIFY_TIMEOUT_MS = 5000;

// 懒加载：加载失败即降级为弹窗，与 main.cjs 「重依赖不在顶层 require」的约定一致
let toaster;

function getToaster() {
  if (toaster === undefined) {
    try {
      const notifiers = require('node-notifier');
      toaster = process.platform === 'win32' ? new notifiers.WindowsToaster({ appID: APP_ID }) : null;
    } catch (err) {
      console.error('[reminderNotifier] node-notifier 不可用，系统通知将回退为弹窗:', err.message);
      toaster = null;
    }
  }
  return toaster;
}

function toPopupPayload(reminder) {
  return { title: reminder.title, content: reminder.content || '', id: reminder.id };
}

// 兜底：系统通知不可用或失败时，改用已验证可用的独立弹窗，保证提醒一定可见
function showPopupFallback(reminder, reason) {
  console.error('[reminderNotifier] 系统通知失败，回退弹窗:', reason);
  showReminderPopup(toPopupPayload(reminder));
}

async function notifyReminder(reminder) {
  if (!reminder) return;

  if (reminder.notify_method === 'popup') {
    showReminderPopup(toPopupPayload(reminder));
    return;
  }

  const activeToaster = getToaster();
  if (!activeToaster) {
    showPopupFallback(reminder, '当前平台没有可用的系统通知后端');
    return;
  }

  // app 就绪时立即返回、未就绪时阻塞：冷启动路径下不会因时序丢通知
  await app.whenReady();

  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, NOTIFY_TIMEOUT_MS);

    try {
      activeToaster.notify(
        {
          title: reminder.title,
          message: reminder.content || '',
          appID: APP_ID,
          // 不等用户交互，避免子进程常驻
          wait: false,
          // 不传 icon：SnoreToast 是外部进程，读不到 asar 内的图片路径
        },
        (err) => {
          if (err) showPopupFallback(reminder, err.message || String(err));
          done();
        }
      );
    } catch (err) {
      showPopupFallback(reminder, err && err.message ? err.message : String(err));
      done();
    }
  });
}

module.exports = { notifyReminder };
