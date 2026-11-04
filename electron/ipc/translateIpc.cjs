/**
 * 翻译相关 IPC 编排：取词入口、浮层显隐 / 尺寸 / 剪贴板、主题与 AI 配置快照、翻译记录。
 */
const { ipcMain, clipboard } = require('electron');
const {
  isDarkTheme,
  loadThemeSnapshot,
  loadAIConfigSnapshot,
  saveAIConfigSnapshot,
} = require('../lib/config.cjs');
const { readSelectedText } = require('../services/selectionReader.cjs');
const historyService = require('../services/translateHistoryService.cjs');
const {
  showTranslateWindow,
  hideTranslateWindow,
  resizeTranslateWindow,
  setPinned,
  isTranslateWindowVisible,
  getLastShownText,
  getTranslateWindow,
} = require('../window/translateWindow.cjs');

let registered = false;

/** 快捷键「划词翻译」入口：取词 → 开窗；已显示且文本相同时再次触发即隐藏 */
const triggerSelectionTranslate = async () => {
  let result;
  try {
    result = await readSelectedText();
  } catch (error) {
    result = { text: '', fallback: false, busy: false, error: error.message };
  }
  if (result.busy) return { success: false, busy: true };

  const text = (result.text || '').trim();
  if (text && isTranslateWindowVisible() && getLastShownText() === text) {
    hideTranslateWindow();
    return { success: true, hidden: true };
  }

  showTranslateWindow({
    text,
    autoTranslate: !!text,
    trigger: 'selection',
    fallback: result.fallback,
    error: text ? '' : '未获取到选中文本，请确认目标窗口已选中文字后重试',
  });
  return { success: !!text, text, fallback: result.fallback };
};

const registerTranslateIpc = () => {
  if (registered) return;
  registered = true;

  ipcMain.handle('translate:selection', () => triggerSelectionTranslate());

  ipcMain.handle('translate:open', (_event, payload = {}) => showTranslateWindow(payload || {}));

  ipcMain.handle('translate:close', () => {
    hideTranslateWindow();
    return { success: true };
  });

  ipcMain.handle('translate:resize', (_event, { height, historyOpen } = {}) => {
    resizeTranslateWindow(height, historyOpen);
    return { success: true };
  });

  ipcMain.handle('translate:copy', (_event, { text } = {}) => {
    clipboard.writeText(String(text || ''));
    return { success: true };
  });

  ipcMain.handle('translate:setPinned', (_event, { pinned } = {}) => {
    setPinned(Boolean(pinned));
    return { success: true, pinned: Boolean(pinned) };
  });

  ipcMain.handle('translate:theme-snapshot', () => ({
    isDark: isDarkTheme(),
    snapshot: loadThemeSnapshot(),
  }));

  ipcMain.handle('translate:ai-config', () => loadAIConfigSnapshot());

  ipcMain.handle('ai-config:set-snapshot', (_event, config) => {
    saveAIConfigSnapshot(config);
    const translateWindow = getTranslateWindow();
    if (translateWindow && !translateWindow.isDestroyed()) {
      translateWindow.webContents.send('ai-config-changed', config);
    }
    return { success: true };
  });

  ipcMain.handle('translate:history:list', (_event, payload) => historyService.list(payload || {}));

  ipcMain.handle('translate:history:save', (_event, record) => historyService.save(record));

  ipcMain.handle('translate:history:delete', (_event, { id } = {}) =>
    historyService.remove(String(id || '')),
  );

  ipcMain.handle('translate:history:clear', () => historyService.clear());
};

module.exports = { registerTranslateIpc, triggerSelectionTranslate };
