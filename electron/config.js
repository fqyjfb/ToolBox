const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const shortcutsPath = path.join(app.getPath('userData'), 'shortcuts.json');
const floatConfigPath = path.join(app.getPath('userData'), 'floatConfig.json');

let settingsCache = null;
let shortcutsCache = null;
let floatConfigCache = null;

const defaultSettings = {
  isWindowEdgeAdsorption: 0,
  isMemoryOptimizationEnabled: 0,
  isOpenDevTools: 0,
  isOpenZoom: 0,
  isAutoLaunch: 0,
  isMenuVisible: 1,
  isOpenContextMenu: 1,
  systemTheme: 'system',
  leftMenuPosition: 'left',
  howLinkOpenMethod: 'internal',
  defaultWindowSize: { width: 1024, height: 800 },
  isFloatWindowEnabled: 0
};

const defaultFloatConfig = [
  { id: 1, type: 'nav', action: 'home', name: '主页', icon: 'Home', color: '#03a9f4' },
  { id: 2, type: 'nav', action: 'tools', name: '工具', icon: 'Wrench', color: '#0462df' },
  { id: 3, type: 'nav', action: 'quick', name: '快捷启动', icon: 'Zap', color: '#1db954' },
  { id: 4, type: 'nav', action: 'bookmark', name: '收藏', icon: 'Bookmark', color: '#8c9eff' },
  { id: 5, type: 'nav', action: 'todo', name: '待办', icon: 'CheckCircle', color: '#bd081c' },
  { id: 6, type: 'nav', action: 'search', name: '搜索', icon: 'Search', color: '#ea4c89' },
  { id: 7, type: 'nav', action: 'news', name: '热点', icon: 'Flame', color: '#333' },
  { id: 8, type: 'nav', action: 'settings', name: '设置', icon: 'Settings', color: '#ff4500' }
];

const defaultShortcuts = [
  { id: 1, tag: '退出软件', cmd: 'CommandOrControl+Q', isOpen: 1, isGlobal: 1, name: 'softwareExit' },
  { id: 2, tag: '隐藏/显示 软件窗口', cmd: 'CommandOrControl+H', isOpen: 1, isGlobal: 1, name: 'softwareWindowVisibilityController' },
  { id: 3, tag: '隐藏/显示 侧边导航', cmd: 'CommandOrControl+B', isOpen: 1, isGlobal: 0, name: 'isMenuVisible' },
  { id: 4, tag: '打开设置', cmd: 'CommandOrControl+S', isOpen: 1, isGlobal: 0, name: 'softwareSetting' },
  { id: 5, tag: '取消/设置 窗口置顶', cmd: 'CommandOrControl+T', isOpen: 1, isGlobal: 0, name: 'windowTopmostToggle' },
  { id: 6, tag: '恢复默认窗口', cmd: 'CommandOrControl+O', isOpen: 1, isGlobal: 0, name: 'restoreDefaultWindow' },
  { id: 7, tag: '刷新当前页面', cmd: 'CommandOrControl+R', isOpen: 1, isGlobal: 0, name: 'currentPageRefresher' },
  { id: 8, tag: '最小化窗口', cmd: 'CommandOrControl+[', isOpen: 1, isGlobal: 0, name: 'windowMinimize' },
  { id: 9, tag: '最大化窗口', cmd: 'CommandOrControl+]', isOpen: 1, isGlobal: 0, name: 'windowMaximizer' },
];

const loadSettings = () => {
  if (settingsCache) return settingsCache;
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      settingsCache = { ...defaultSettings, ...JSON.parse(data) };
      return settingsCache;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  settingsCache = { ...defaultSettings };
  return settingsCache;
};

const saveSettings = (settings) => {
  try {
    settingsCache = settings;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

const loadShortcuts = () => {
  if (shortcutsCache) return shortcutsCache;
  try {
    if (fs.existsSync(shortcutsPath)) {
      const data = fs.readFileSync(shortcutsPath, 'utf-8');
      const shortcuts = JSON.parse(data);
      shortcutsCache = shortcuts.map(s => ({ ...defaultShortcuts.find(ds => ds.id === s.id), ...s }));
      return shortcutsCache;
    }
  } catch (error) {
    console.error('Failed to load shortcuts:', error);
  }
  shortcutsCache = [...defaultShortcuts];
  return shortcutsCache;
};

const saveShortcuts = (shortcuts) => {
  try {
    shortcutsCache = shortcuts;
    fs.writeFileSync(shortcutsPath, JSON.stringify(shortcuts, null, 2));
  } catch (error) {
    console.error('Failed to save shortcuts:', error);
  }
};

const loadFloatConfig = () => {
  if (floatConfigCache) return floatConfigCache;
  try {
    if (fs.existsSync(floatConfigPath)) {
      const data = fs.readFileSync(floatConfigPath, 'utf-8');
      const config = JSON.parse(data);
      const mergedConfig = defaultFloatConfig.map((defaultItem) => {
        const savedItem = config.find(c => c.id === defaultItem.id);
        return savedItem ? { ...defaultItem, ...savedItem } : defaultItem;
      });
      floatConfigCache = mergedConfig;
      return mergedConfig;
    }
  } catch (error) {
    console.error('Failed to load float config:', error);
  }
  floatConfigCache = [...defaultFloatConfig];
  return floatConfigCache;
};

const saveFloatConfig = (config) => {
  try {
    floatConfigCache = config;
    fs.writeFileSync(floatConfigPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save float config:', error);
  }
};

module.exports = {
  loadSettings,
  saveSettings,
  loadShortcuts,
  saveShortcuts,
  loadFloatConfig,
  saveFloatConfig,
  defaultSettings,
  defaultShortcuts,
  defaultFloatConfig
};