// 自动生成的 system/ip IPC 注册模块（从 mainWindow.cjs 拆分，行为完全一致）
const { registerSystemIpc } = (() => {
  // 直接 require，避免与 mainWindow.cjs 形成循环依赖
  const systemInfoService = require('../services/systemInfoService.cjs');
  const { ipcMain } = require('electron');

  function fetchJson(url) {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? require('https') : require('http');
      const req = lib.get(url, { timeout: 8000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('响应解析失败')); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    });
  }

  return {
    registerSystemIpc() {
      ipcMain.handle('ip-info:query', async (event, ip) => {
        const baseUrl = ip
          ? `https://ipinfo.io/${ip}/json`
          : 'https://ipinfo.io/json';
        try {
          const data = await fetchJson(baseUrl);
          if (data.error) throw new Error(data.reason || '查询失败');
          const [latitude, longitude] = data.loc
            ? data.loc.split(',').map(Number)
            : [0, 0];
          return {
            ip: data.ip || '',
            version: (data.ip || '').includes(':') ? 'IPv6' : 'IPv4',
            city: data.city || '',
            region: data.region || '',
            country_name: data.country || '',
            country_code: data.country || '',
            timezone: data.timezone || '',
            currency: data.currency ? data.currency.id || '' : '',
            currency_name: data.currency ? data.currency.name || '' : '',
            postal: data.postal || '',
            latitude,
            longitude,
            org: data.org || '',
            asn: data.asn || '',
            languages: data.locale ? data.locale.languages || '' : '',
          };
        } catch (err) {
          throw new Error(err.message || '查询失败，请检查网络连接');
        }
      });
      ipcMain.handle('system-info:get', () => {
        return systemInfoService.getSystemInfo();
      });
    },
  };
})();

module.exports = { registerSystemIpc };
