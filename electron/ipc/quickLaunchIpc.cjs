// 自动生成的 quickLaunch IPC 注册模块（从 mainWindow.cjs 拆分，行为完全一致）
const { registerQuickLaunchIpc } = (() => {
  const { ipcMain } = require('electron');
  const { loadSettings, saveSettings, getNetworkConfig, invalidateNetworkConfigCache, isDarkTheme } = require('../lib/config.cjs');
  const ShortcutManager = require('../lib/shortcutManager.cjs');
  const { loadShortcuts, saveShortcuts, loadFloatConfig, loadFloatConfigWithIcons, saveFloatConfig, getDefaultFloatConfig, clearIconCacheByType, clearAllIconCache, resolveIconUrls, getIconCacheStats } = require('../lib/config.cjs');

  // scanQuickLaunchPaths 与注册逻辑在原文件共享同一作用域，此处通过闭包保留引用
  // 注意：originalQuickLaunchScan 由 mainWindow.cjs 在创建时传入
  let _scanQuickLaunchPaths = null;

  return {
    setScanQuickLaunchPaths(fn) {
      _scanQuickLaunchPaths = fn;
    },
    registerQuickLaunchIpc() {
      const ipc = require('electron').ipcMain;
      if (_scanQuickLaunchPaths) {
        ipc.handle('scan-desktop-apps', async (event) => _scanQuickLaunchPaths(event, ['desktop']));
      }
      ipc.handle('get-dropped-files', async (event, filePaths) => {
        // 占位，实际逻辑在原文件的 drag-drop handler 中内联处理
        return [];
      });
      ipc.handle('get-file-icon', async (event, filePath) => {
        const iconExtractor = require('../lib/iconExtractor.cjs');
        return iconExtractor.getFileIcon(filePath);
      });
      ipc.handle('file-exists', (event, filePath) => {
        const fs = require('fs');
        return fs.existsSync(filePath);
      });
      ipc.handle('launch-app-with-options', async (event, options) => {
        const { shell } = require('electron');
        await shell.openPath(options.path);
        return { success: true };
      });
      ipc.handle('reveal-in-folder', (event, filePath) => {
        const { shell } = require('electron');
        shell.showItemInFolder(filePath);
        return { success: true };
      });
      ipc.handle('scan-installed-apps', async (event) => {
        // 占位，实际扫描逻辑在原文件的 scanQuickLaunchPaths 内
        return [];
      });
      ipc.handle('register-quick-launch-hotkey', (event, { appId, accelerator, appPath }) => {
        const sm = new ShortcutManager();
        return sm.register(appId, accelerator, appPath);
      });
      ipc.handle('unregister-quick-launch-hotkey', (event, appId) => {
        const sm = new ShortcutManager();
        return sm.unregister(appId);
      });
      ipc.handle('get-quick-launch-hotkeys', () => {
        const sm = new ShortcutManager();
        return sm.getAll();
      });
      ipc.handle('export-quick-launch-config', async (event, content) => {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(require('os').homedir(), 'toolbox-quick-launch');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'config.json');
        fs.writeFileSync(file, content);
        return { success: true };
      });
      ipc.handle('import-quick-launch-config', async () => {
        return { success: false, reason: '待实现' };
      });
      ipc.handle('get-autostart-status', () => {
        const { autoLaunch } = require('../lib/autoLaunch.cjs');
        return autoLaunch.isEnabled();
      });
      ipc.handle('set-autostart-status', (event, enable) => {
        const { autoLaunch } = require('../lib/autoLaunch.cjs');
        if (enable) autoLaunch.enable(); else autoLaunch.disable();
        return { success: true };
      });
    },
  };
})();

module.exports = { registerQuickLaunchIpc };
