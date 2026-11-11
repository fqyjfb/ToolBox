// 应用锁 IPC 通道：域:动作 命名，幂等注册（遵循 reminderIpc.cjs 范式）。
// 注册时顺带执行启动自愈（恢复上次会话遗留的挂起进程）。
const { ipcMain } = require('electron');
const appLockService = require('../services/appLockService.cjs');

let registered = false;

function registerAppLockIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle('appLock:getConfig', () => appLockService.getConfig());
  ipcMain.handle('appLock:getStatus', () => appLockService.getStatus());
  ipcMain.handle('appLock:setMasterEnabled', (_e, enabled) => appLockService.setMasterEnabled(enabled));
  ipcMain.handle('appLock:addApp', (_e, payload) => appLockService.addApp(payload));
  ipcMain.handle('appLock:removeApp', (_e, id) => appLockService.removeApp(id));
  ipcMain.handle('appLock:toggleApp', (_e, payload) => {
    const { id, enabled } = payload || {};
    return appLockService.toggleApp(id, enabled);
  });
  ipcMain.handle('appLock:resolveApp', (_e, exePath) => appLockService.resolveApp(exePath));

  // 启动自愈：无条件恢复上次会话遗留的挂起进程（即使 masterEnabled 已关闭）
  appLockService.recoverOnStartup()
    .catch((error) => console.error('[AppLock] 启动自愈失败:', error.message));
}

module.exports = { registerAppLockIpc };
