const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { https, http } = require('follow-redirects');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
const shortcutsPath = path.join(app.getPath('userData'), 'shortcuts.json');
const floatConfigPath = path.join(app.getPath('userData'), 'floatConfig.json');
const lockPasswordPath = path.join(app.getPath('userData'), 'lockPassword.json');
const iconCacheDir = path.join(app.getPath('userData'), 'icon-cache');
const iconCacheIndexPath = path.join(iconCacheDir, 'index.json');

const ICON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

let settingsCache = null;
let shortcutsCache = null;
let floatConfigCache = null;
let iconCacheIndex = null;
let iconCacheInitPromise = null;
let cachedNetworkConfig = null;

const defaultNetworkConfig = {
  appUpdate: {
    checkUrl: 'https://api.github.com/repos/fqyjfb/ToolBox/releases/latest',
    repoUrl: 'https://github.com/fqyjfb/ToolBox',
    requestTimeout: 10000,
  },
  hotNews: {
    primaryUrl: 'https://60s.fqy-jfb.workers.dev/v2',
    fallbackUrl: 'https://60s.viki.moe/v2',
    requestTimeout: 15000,
  },
  pluginStore: {
    registryUrls: [
      'https://raw.githubusercontent.com/fqyjfb/toolbox-plugins-registry/main/registry.json',
      'https://raw.fastgit.org/fqyjfb/toolbox-plugins-registry/main/registry.json',
      'https://raw.gitmirror.com/fqyjfb/toolbox-plugins-registry/main/registry.json',
    ],
    githubRawMirrors: [
      'https://raw.githubusercontent.com',
      'https://raw.fastgit.org',
      'https://raw.gitmirror.com',
    ],
    githubApiMirrors: ['https://api.github.com'],
    requestTimeout: 15000,
  },
  iconCache: {
    ttl: ICON_CACHE_TTL,
    maxItems: 500,
    requestTimeout: 10000,
  },
};

const getNetworkConfig = () => {
  if (cachedNetworkConfig) return cachedNetworkConfig;
  const saved = loadSettings().networkConfig || {};
  const merged = {
    appUpdate: { ...defaultNetworkConfig.appUpdate, ...(saved.appUpdate || {}) },
    hotNews: { ...defaultNetworkConfig.hotNews, ...(saved.hotNews || {}) },
    pluginStore: { ...defaultNetworkConfig.pluginStore, ...(saved.pluginStore || {}) },
    iconCache: { ...defaultNetworkConfig.iconCache, ...(saved.iconCache || {}) },
  };
  cachedNetworkConfig = {
    appUpdate: {
      checkUrl: merged.appUpdate.checkUrl || defaultNetworkConfig.appUpdate.checkUrl,
      repoUrl: merged.appUpdate.repoUrl || defaultNetworkConfig.appUpdate.repoUrl,
      requestTimeout: merged.appUpdate.requestTimeout || defaultNetworkConfig.appUpdate.requestTimeout,
    },
    hotNews: {
      primaryUrl: merged.hotNews.primaryUrl || defaultNetworkConfig.hotNews.primaryUrl,
      fallbackUrl: merged.hotNews.fallbackUrl || defaultNetworkConfig.hotNews.fallbackUrl,
      requestTimeout: merged.hotNews.requestTimeout || defaultNetworkConfig.hotNews.requestTimeout,
    },
    pluginStore: {
      registryUrls: merged.pluginStore.registryUrls && merged.pluginStore.registryUrls.length
        ? merged.pluginStore.registryUrls
        : defaultNetworkConfig.pluginStore.registryUrls,
      githubRawMirrors: merged.pluginStore.githubRawMirrors && merged.pluginStore.githubRawMirrors.length
        ? merged.pluginStore.githubRawMirrors
        : defaultNetworkConfig.pluginStore.githubRawMirrors,
      githubApiMirrors: merged.pluginStore.githubApiMirrors && merged.pluginStore.githubApiMirrors.length
        ? merged.pluginStore.githubApiMirrors
        : defaultNetworkConfig.pluginStore.githubApiMirrors,
      requestTimeout: merged.pluginStore.requestTimeout || defaultNetworkConfig.pluginStore.requestTimeout,
    },
    iconCache: {
      ttl: merged.iconCache.ttl || defaultNetworkConfig.iconCache.ttl,
      maxItems: merged.iconCache.maxItems || defaultNetworkConfig.iconCache.maxItems,
      requestTimeout: merged.iconCache.requestTimeout || defaultNetworkConfig.iconCache.requestTimeout,
    },
  };
  return cachedNetworkConfig;
};

const invalidateNetworkConfigCache = () => { cachedNetworkConfig = null; };

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
  isFloatWindowEnabled: 0,
  isLockEnabled: 0,
  lockPassword: '',
  lockedAt: null,
  isAutoLockEnabled: 0,
  autoLockTimeout: 600,
  dbPath: '',
  networkConfig: defaultNetworkConfig,
  // Supabase 桌面端用户自定义配置（空字符串表示使用打包时的环境变量值）
  supabaseConfig: { url: '', anonKey: '' },
  // 加密密钥桌面端用户自定义配置（空字符串表示使用打包时的环境变量值）
  encryptionKey: '',
  // 悬浮球形象（float-img 中的图标名，空字符串表示使用默认 SVG 图标）
  floatBallAppearance: '',
};

const defaultFloatConfig = [
  { id: 1, type: 'nav', action: 'home', name: '主页', icon: 'Home', color: '#03a9f4' },
  { id: 2, type: 'nav', action: 'tools', name: '工具', icon: 'Tool', color: '#0462df' },
  { id: 3, type: 'nav', action: 'quick', name: '快捷启动', icon: 'Zap', color: '#1db954' },
  { id: 4, type: 'nav', action: 'bookmark', name: '收藏', icon: 'Star', color: '#8c9eff' },
  { id: 5, type: 'nav', action: 'todo', name: '待办', icon: 'Check', color: '#bd081c' },
  { id: 6, type: 'nav', action: 'search', name: '搜索', icon: 'Search', color: '#ea4c89' },
  { id: 7, type: 'nav', action: 'news', name: '热点', icon: 'Flame', color: '#333' },
  { id: 8, type: 'nav', action: 'settings', name: '设置', icon: 'Edit', color: '#ff4500' }
];

const defaultShortcuts = [
  { id: 1, tag: '退出软件', cmd: 'CommandOrControl+Q', isOpen: 1, isGlobal: 1, name: 'softwareExit' },
  { id: 2, tag: '软件窗口', cmd: 'CommandOrControl+H', isOpen: 1, isGlobal: 1, name: 'softwareWindowVisibilityController' },
  { id: 3, tag: '侧边导航', cmd: 'CommandOrControl+B', isOpen: 1, isGlobal: 0, name: 'isMenuVisible' },
  { id: 4, tag: '打开设置', cmd: 'CommandOrControl+S', isOpen: 1, isGlobal: 0, name: 'softwareSetting' },
  { id: 5, tag: '窗口置顶', cmd: 'CommandOrControl+T', isOpen: 1, isGlobal: 0, name: 'windowTopmostToggle' },
  { id: 6, tag: '恢复默认', cmd: 'CommandOrControl+O', isOpen: 1, isGlobal: 0, name: 'restoreDefaultWindow' },
  { id: 7, tag: '刷新页面', cmd: 'CommandOrControl+R', isOpen: 1, isGlobal: 0, name: 'currentPageRefresher' },
  { id: 8, tag: '最小化', cmd: 'CommandOrControl+[', isOpen: 1, isGlobal: 0, name: 'windowMinimize' },
  { id: 9, tag: '最大化', cmd: 'CommandOrControl+]', isOpen: 1, isGlobal: 0, name: 'windowMaximizer' },
  { id: 10, tag: '锁定/解锁', cmd: 'CommandOrControl+L', isOpen: 1, isGlobal: 1, name: 'lockToggle' },
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
      // 合并保存的快捷键和默认快捷键，确保新增的快捷键也被包含
      shortcutsCache = defaultShortcuts.map(defaultShortcut => {
        const savedShortcut = shortcuts.find(s => s.id === defaultShortcut.id);
        return savedShortcut ? { ...defaultShortcut, ...savedShortcut } : defaultShortcut;
      });
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
  // 使用 !== null 检查，避免空数组 []（truthy）被错误缓存后永远返回空
  if (floatConfigCache !== null) return floatConfigCache;
  try {
    if (fs.existsSync(floatConfigPath)) {
      const data = fs.readFileSync(floatConfigPath, 'utf-8');
      const config = JSON.parse(data);
      if (!Array.isArray(config)) {
        floatConfigCache = [...defaultFloatConfig];
        return floatConfigCache;
      }
      // 合并默认配置和用户自定义配置：先处理默认项，再追加用户自定义项
      const usedIds = new Set();
      const mergedConfig = defaultFloatConfig.map((defaultItem) => {
        const savedItem = config.find(c => c.id === defaultItem.id);
        usedIds.add(defaultItem.id);
        return savedItem ? { ...defaultItem, ...savedItem } : defaultItem;
      });
      // 追加用户自定义项（不在默认配置中的）
      config.forEach((item) => {
        if (item && !usedIds.has(item.id)) {
          mergedConfig.push(item);
        }
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
    // 防御性检查：如果传入的不是非空数组，使用默认配置
    const configToSave = (Array.isArray(config) && config.length > 0) ? config : [...defaultFloatConfig];
    floatConfigCache = configToSave;
    fs.writeFileSync(floatConfigPath, JSON.stringify(configToSave, null, 2));
  } catch (error) {
    console.error('Failed to save float config:', error);
  }
};

const ensureIconCacheDir = () => {
  if (!fs.existsSync(iconCacheDir)) {
    fs.mkdirSync(iconCacheDir, { recursive: true });
  }
};

const loadIconCacheIndex = () => {
  if (iconCacheIndex) return iconCacheIndex;
  try {
    ensureIconCacheDir();
    if (fs.existsSync(iconCacheIndexPath)) {
      const data = fs.readFileSync(iconCacheIndexPath, 'utf-8');
      iconCacheIndex = JSON.parse(data);
    } else {
      iconCacheIndex = { icons: {} };
    }
  } catch (error) {
    console.error('Failed to load icon cache index:', error);
    iconCacheIndex = { icons: {} };
  }
  return iconCacheIndex;
};

const saveIconCacheIndex = () => {
  try {
    ensureIconCacheDir();
    fs.writeFileSync(iconCacheIndexPath, JSON.stringify(iconCacheIndex, null, 2));
  } catch (error) {
    console.error('Failed to save icon cache index:', error);
  }
};

const generateIconHash = (url) => {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

const getCachedIconPath = (url) => {
  const index = loadIconCacheIndex();
  const entry = index.icons[url];
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > getNetworkConfig().iconCache.ttl) {
    delete index.icons[url];
    saveIconCacheIndex();
    return null;
  }
  
  const iconFilePath = path.join(iconCacheDir, entry.file);
  if (!fs.existsSync(iconFilePath)) {
    delete index.icons[url];
    saveIconCacheIndex();
    return null;
  }
  
  return iconFilePath;
};

const downloadIcon = (url) => {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(null);
      return;
    }
    
    const protocol = url.startsWith('https') ? https : http;

    const timeout = setTimeout(() => {
      resolve(null);
    }, getNetworkConfig().iconCache.requestTimeout);
    
    protocol.get(url, (response) => {
      clearTimeout(timeout);
      
      if (response.statusCode !== 200) {
        resolve(null);
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const hash = generateIconHash(url);
          const ext = path.extname(url.split('?')[0]) || '.png';
          const fileName = `${hash}${ext}`;
          const filePath = path.join(iconCacheDir, fileName);
          
          ensureIconCacheDir();
          fs.writeFileSync(filePath, buffer);
          
          const index = loadIconCacheIndex();
          index.icons[url] = {
            file: fileName,
            timestamp: Date.now(),
            contentType: response.headers['content-type'] || 'image/png'
          };
          saveIconCacheIndex();
          
          resolve(filePath);
        } catch (error) {
          console.error('Failed to save icon:', error);
          resolve(null);
        }
      });
      
      response.on('error', () => resolve(null));
    }).on('error', () => resolve(null)).on('timeout', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
};

const getIconDataUrl = (iconPath) => {
  try {
    if (!iconPath || !fs.existsSync(iconPath)) return null;
    const buffer = fs.readFileSync(iconPath);
    const ext = path.extname(iconPath).toLowerCase();
    const mimeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon'
    };
    const mime = mimeMap[ext] || 'image/png';
    const base64 = buffer.toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.error('Failed to read icon data:', error);
    return null;
  }
};

const loadFloatConfigWithIcons = async () => {
  const config = loadFloatConfig();
  
  const results = await Promise.all(
    config.map(async (item) => {
      if (item.type === 'plugin' && item.path && item.path.startsWith('http')) {
        const cachedPath = getCachedIconPath(item.path);
        
        let dataUrl = null;
        if (cachedPath) {
          dataUrl = getIconDataUrl(cachedPath);
        } else {
          const downloadedPath = await downloadIcon(item.path);
          if (downloadedPath) {
            dataUrl = getIconDataUrl(downloadedPath);
          }
        }
        
        if (dataUrl) {
          return { ...item, iconDataUrl: dataUrl };
        }
      }
      return item;
    })
  );
  
  return results;
};

const clearExpiredIconCache = () => {
  try {
    const index = loadIconCacheIndex();
    const now = Date.now();
    let cleared = 0;
    
    for (const [url, entry] of Object.entries(index.icons)) {
      if (now - entry.timestamp > getNetworkConfig().iconCache.ttl) {
        const filePath = path.join(iconCacheDir, entry.file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        delete index.icons[url];
        cleared++;
      }
    }
    
    if (cleared > 0) {
      saveIconCacheIndex();
      console.log(`Cleared ${cleared} expired icon cache entries`);
    }
  } catch (error) {
    console.error('Failed to clear expired icon cache:', error);
  }
};

const clearAllIconCache = () => {
  try {
    ensureIconCacheDir();
    const files = fs.readdirSync(iconCacheDir);
    for (const file of files) {
      if (file !== 'index.json') {
        fs.unlinkSync(path.join(iconCacheDir, file));
      }
    }
    iconCacheIndex = { icons: {} };
    saveIconCacheIndex();
    console.log('Cleared all icon cache');
  } catch (error) {
    console.error('Failed to clear icon cache:', error);
  }
};

module.exports = {
  loadSettings,
  saveSettings,
  loadShortcuts,
  saveShortcuts,
  loadFloatConfig,
  loadFloatConfigWithIcons,
  saveFloatConfig,
  clearExpiredIconCache,
  clearAllIconCache,
  defaultShortcuts,
  defaultFloatConfig,
  getNetworkConfig,
  invalidateNetworkConfigCache,
};