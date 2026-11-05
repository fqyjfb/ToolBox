// 自动生成的 system/ip IPC 注册模块（从 mainWindow.cjs 拆分，行为完全一致）
const { registerSystemIpc } = (() => {
  // 直接 require，避免与 mainWindow.cjs 形成循环依赖
  const systemInfoService = require('../services/systemInfoService.cjs');
  const { ipcMain } = require('electron');

  return {
    registerSystemIpc() {
      ipcMain.handle('ip-info:query', async (event, ip) => {
        const { dns } = require('dns');
        return new Promise((resolve, reject) => {
          dns.lookup(ip || '', { all: false }, (err, address, family) => {
            if (err) return reject(err);
            resolve({ ip: address || ip, version: family === 6 ? 'IPv6' : 'IPv4' });
          });
        });
      });
      ipcMain.handle('system-info:get', () => {
        return systemInfoService.getSystemInfo();
      });
    },
  };
})();

module.exports = { registerSystemIpc };
