const { app, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const { https, http } = require('follow-redirects');
const { getTargetIconData, getLegacyIconData } = require('./icon-data.cjs');
const { hasLocalPluginIcon } = require('./pluginLocalIcons.cjs');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
// 自定义主题配色快照：锁屏等独立窗口读不到渲染层的 localStorage，靠这份快照上色
const themeSnapshotPath = path.join(app.getPath('userData'), 'theme.json');
const shortcutsPath = path.join(app.getPath('userData'), 'shortcuts.json');
const floatConfigPath = path.join(app.getPath('userData'), 'floatConfig.json');
const lockPasswordPath = path.join(app.getPath('userData'), 'lockPassword.json');
const iconCacheDir = path.join(app.getPath('userData'), 'icon-cache');
const iconCacheIndexPath = path.join(iconCacheDir, 'index.json');

const ICON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

// 同时下载的图标数上限：批量解析时防止几十张卡片瞬间打出几十个连接
const ICON_MAX_CONCURRENCY = 6;
// 单批解析的最长等待：超时尚未完成的返回 null 由后台继续下载，避免个别慢图标拖住整批
const ICON_BATCH_BUDGET = 2500;

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
    // raw.fastgit.org 已停服，留在清单里只会白白等满超时
    githubRawMirrors: [
      'https://raw.githubusercontent.com',
      'https://raw.gitmirror.com',
      'https://raw.kgithub.com',
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
  windowMode: 'large', // 窗口模式：'large' 大窗（默认） | 'compact' 小窗
  // 上次退出时的边缘吸附状态 { mode, edge, bounds } | null：null 表示未吸附，下次按默认方式启动
  windowDockState: null,
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
  // 悬浮球形象（'' 无装饰 / ears 猫耳 / hat 帽子 / scarf 围巾）
  floatBallAppearance: '',
};

// 默认项与 NAV_ACTIONS 的有效目标保持一致；图标字段留空，加载时按类型+目标自动解析。
// id 保持稳定：旧版 id 6 指向已下线的 search 目标，不再作为默认项。
const defaultFloatConfig = [
  { id: 1, type: 'nav', action: 'home', name: '主页', color: '#03a9f4' },
  { id: 2, type: 'nav', action: 'tools', name: '工具中心', color: '#0462df' },
  { id: 3, type: 'nav', action: 'quick', name: '快捷启动', color: '#1db954' },
  { id: 4, type: 'nav', action: 'bookmark', name: '收藏', color: '#8c9eff' },
  { id: 5, type: 'nav', action: 'todo', name: '待办', color: '#bd081c' },
  { id: 7, type: 'nav', action: 'news', name: '热点', color: '#333333' },
  { id: 8, type: 'nav', action: 'settings', name: '设置', color: '#ff4500' }
];

// 将图标字段统一解析为可直接渲染的 data URI：
// nav/tool/system 按类型+目标复用功能原有图标；旧版自定义图标名走兼容映射；
// 应用的原始 base64 与插件的 plugin: 标识保持原样
const resolveFloatIcon = (item) => {
  const icon = item.icon;
  if (typeof icon !== 'string' || icon.length === 0) {
    return getTargetIconData(item.type, item.action);
  }
  if (icon.startsWith('data:image/') || icon.startsWith('plugin:')) return icon;
  if (icon.length > 100 && !icon.includes(' ')) return icon;
  return getTargetIconData(item.type, item.action) || getLegacyIconData(icon) || icon;
};

const withResolvedIcon = (item) => ({ ...item, icon: resolveFloatIcon(item) });

// 重置场景使用：返回图标已解析、可直接渲染与落盘的默认配置
const getDefaultFloatConfig = () => defaultFloatConfig.map(withResolvedIcon);

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

/**
 * 应用当前明暗：`systemTheme` 为 'system' 或未读写过设置时跟随系统。
 * 独立窗口（锁屏）与实际显示冲突时以这里为准，避免各自重复解析。
 */
const isDarkTheme = () => {
  const themeSource = loadSettings().systemTheme || 'system';
  return themeSource === 'dark' || (themeSource !== 'light' && nativeTheme.shouldUseDarkColors);
};

/** 读取渲染层同步下来的自定义主题配色；未使用自定义主题时为 null */
const loadThemeSnapshot = () => {
  try {
    if (fs.existsSync(themeSnapshotPath)) {
      return JSON.parse(fs.readFileSync(themeSnapshotPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Failed to load theme snapshot:', error);
  }
  return null;
};

/** 写入 / 清除自定义主题配色快照（传 null 即删除文件） */
const saveThemeSnapshot = (snapshot) => {
  try {
    if (snapshot && typeof snapshot === 'object') {
      fs.writeFileSync(themeSnapshotPath, JSON.stringify(snapshot));
    } else if (fs.existsSync(themeSnapshotPath)) {
      fs.unlinkSync(themeSnapshotPath);
    }
  } catch (error) {
    console.error('Failed to save theme snapshot:', error);
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
        floatConfigCache = defaultFloatConfig.map(withResolvedIcon);
        return floatConfigCache;
      }
      // 合并默认配置和用户自定义配置：先处理默认项，再追加用户自定义项
      const usedIds = new Set();
      const mergedConfig = defaultFloatConfig.map((defaultItem) => {
        const savedItem = config.find(c => c.id === defaultItem.id);
        usedIds.add(defaultItem.id);
        return withResolvedIcon(savedItem ? { ...defaultItem, ...savedItem } : defaultItem);
      });
      // 追加用户自定义项（不在默认配置中的）
      config.forEach((item) => {
        if (item && !usedIds.has(item.id)) {
          mergedConfig.push(withResolvedIcon(item));
        }
      });
      floatConfigCache = mergedConfig;
      return mergedConfig;
    }
  } catch (error) {
    console.error('Failed to load float config:', error);
  }
  floatConfigCache = defaultFloatConfig.map(withResolvedIcon);
  return floatConfigCache;
};

const saveFloatConfig = (config) => {
  try {
    // 防御性检查：如果传入的不是非空数组，落盘已解析图标的默认配置
    const configToSave = (Array.isArray(config) && config.length > 0)
      ? config
      : defaultFloatConfig.map(withResolvedIcon);
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
      // 兼容旧索引：无 type 字段的条目默认归为 general，避免按类型清理时漏掉
      let needsSave = false;
      for (const entry of Object.values(iconCacheIndex.icons)) {
        if (!entry.type) { entry.type = 'general'; needsSave = true; }
      }
      if (needsSave) saveIconCacheIndex();
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

// 图标真实类型按内容判定：既不信任 URL 后缀（无后缀的链接会被当成 .png），
// 也不信任 Content-Type（GitHub raw 对无后缀文件返回 text/plain，会误杀 SVG）。
// 判错会让落盘扩展名与内容不符，local-media 按扩展名返回 MIME 时破图。
const IMAGE_MAGIC = [
  {
    ext: '.png',
    mime: 'image/png',
    test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    ext: '.jpg',
    mime: 'image/jpeg',
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: '.gif',
    mime: 'image/gif',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8',
  },
  {
    ext: '.webp',
    mime: 'image/webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  {
    ext: '.ico',
    mime: 'image/x-icon',
    test: (b) => b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00,
  },
  {
    ext: '.svg',
    mime: 'image/svg+xml',
    test: (b) => /^\s*(<\?xml|<!--|<svg)/i.test(b.subarray(0, 512).toString('utf8')),
  },
];

// HTML 错误页（<!DOCTYPE html>）不在表内 → 与空响应一样被拒，不会写进缓存
const sniffImage = (buffer) => IMAGE_MAGIC.find((m) => m.test(buffer)) || null;

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

// 删除索引条目指向的缓存文件，供内容类型变化时替换旧文件（避免留下孤儿文件）
const removeIconFile = (fileName) => {
  try {
    if (!fileName) return;
    const filePath = path.join(iconCacheDir, fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* 文件已被清理时不重试 */ }
};

// 按 timestamp 升序淘汰最旧条目，让设置页「最大条目」配置真正生效
const enforceIconCacheLimits = () => {
  const maxItems = getNetworkConfig().iconCache.maxItems;
  if (!maxItems || maxItems <= 0) return;

  const index = loadIconCacheIndex();
  const entries = Object.entries(index.icons);
  if (entries.length <= maxItems) return;

  entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
  for (let i = 0; i < entries.length - maxItems; i++) {
    removeIconFile(entries[i][1].file);
    delete index.icons[entries[i][0]];
  }
  saveIconCacheIndex();
};

// 扫描并清理过期条目（TTL 平时只在读取时懒淘汰，长期不被访问的图标会一直留在盘上）
const pruneExpiredIcons = () => {
  try {
    const index = loadIconCacheIndex();
    const ttl = getNetworkConfig().iconCache.ttl;
    const now = Date.now();
    let removed = 0;
    for (const [url, entry] of Object.entries(index.icons)) {
      if (now - (entry.timestamp || 0) <= ttl) continue;
      removeIconFile(entry.file);
      delete index.icons[url];
      removed++;
    }
    if (removed > 0) saveIconCacheIndex();
  } catch (error) {
    console.error('Failed to prune expired icons:', error);
  }
};

// cacheKey：写入缓存索引时使用的键。同一图标的多个镜像地址可共用同一个键，
// 避免渲染层切换镜像后缓存反复失效。不传则与 url 一致（保持原有行为）。
// type：图标分类（general/plugin/app），用于磁盘缓存按类型清理。
// onRequest：拿到请求句柄，供外层在竞速落败时真正销毁连接（而非让它挂到超时）。
const downloadIcon = (url, cacheKey, type = 'general', onRequest) => {
  return new Promise((resolve) => {
    if (!url || !url.startsWith('http')) {
      resolve(null);
      return;
    }

    const indexKey = cacheKey || url;
    const protocol = url.startsWith('https') ? https : http;

    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };

    let req = null;

    const timeout = setTimeout(() => {
      // 外层竞速已负责 destroy，这里只收口，避免 Promise 悬到连接自然超时
      if (req) { try { req.destroy(); } catch { /* 已销毁 */ } }
      settle(null);
    }, getNetworkConfig().iconCache.requestTimeout);

    const onResponse = (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        settle(null);
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        clearTimeout(timeout);
        try {
          const buffer = Buffer.concat(chunks);
          // 按内容判定类型：空响应、HTML 错误页、非图片一律不落盘
          const kind = sniffImage(buffer);
          if (!kind) {
            settle(null);
            return;
          }

          const hash = generateIconHash(indexKey);
          const fileName = `${hash}${kind.ext}`;
          const filePath = path.join(iconCacheDir, fileName);

          ensureIconCacheDir();
          fs.writeFileSync(filePath, buffer);

          const index = loadIconCacheIndex();
          // 同一图标的实际类型可能与上次不同（换了格式），先清掉旧文件
          const previous = index.icons[indexKey];
          if (previous && previous.file !== fileName) removeIconFile(previous.file);

          index.icons[indexKey] = {
            file: fileName,
            timestamp: Date.now(),
            contentType: kind.mime,
            type,
          };
          saveIconCacheIndex();
          enforceIconCacheLimits();

          settle(filePath);
        } catch (error) {
          console.error('Failed to save icon:', error);
          settle(null);
        }
      });

      response.on('error', () => settle(null));
    };

    try {
      req = protocol.get(url, onResponse);
    } catch {
      // 非法 URL 等同步抛错直接判定失败，不让 Promise 转为 reject
      clearTimeout(timeout);
      settle(null);
      return;
    }

    if (typeof onRequest === 'function') onRequest(req);

    req.on('error', () => settle(null));
    req.on('timeout', () => {
      try { req.destroy(); } catch { /* 已销毁 */ }
      settle(null);
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

// ---------------------------------------------------------------------------
// 远程图标统一解析：把 http(s) 图标地址解析成可直接用于 <img> 的 local-media:// 地址。
// 渲染层不再直连远程图标（国内网络下会破图），统一走这里 + 本地磁盘缓存。
// ---------------------------------------------------------------------------

// 解析失败的图标在一段时间内不再重试，避免每次打开界面都白等一轮网络超时
const ICON_FAILURE_TTL = 30 * 60 * 1000;
const iconFailures = new Map();
const iconResolveTasks = new Map();

// 与 NotesEditor 保持一致：local-media 处理器会 slice(1) + decodeURIComponent
const toLocalMediaUrl = (filePath) => {
  if (!filePath) return null;
  return `local-media://host/${encodeURIComponent(filePath.replace(/\\/g, '/'))}`;
};

// 把镜像地址还原成规范地址，作为缓存索引键（复用已有的镜像配置，不新增配置项）
const toCanonicalIconUrl = (url) => {
  if (typeof url !== 'string' || !url.startsWith('http')) return '';
  const mirrors = getNetworkConfig().pluginStore.githubRawMirrors || [];
  for (const mirror of mirrors) {
    if (mirror && url.startsWith(mirror)) {
      return `https://raw.githubusercontent.com${url.slice(mirror.length)}`;
    }
  }
  return url;
};

// 原始地址优先（渲染层可能已按网络状况挑过镜像），其后依次尝试其余镜像
const buildIconUrlCandidates = (canonicalUrl) => {
  if (!canonicalUrl.startsWith('https://raw.githubusercontent.com')) {
    return [canonicalUrl];
  }
  const candidates = [canonicalUrl];
  const mirrors = [...(getNetworkConfig().pluginStore.githubRawMirrors || []), 'https://raw.githubusercontent.com'];
  for (const mirror of mirrors) {
    const candidate = canonicalUrl.replace('https://raw.githubusercontent.com', mirror);
    if (!candidates.includes(candidate)) candidates.push(candidate);
  }
  return candidates;
};

const getUrlOrigin = (url) => {
  try { return new URL(url).origin; } catch { return ''; }
};

// 上次成功下载过的源排在前面：国内用户冷启动竞速过一次后，后续直奔可用镜像。
// 仅进程内记忆，重开回到并发竞速（一次竞速的代价远小于一次串行超时）。
const iconSourceHits = new Map();

const rankCandidates = (candidates) => {
  if (candidates.length <= 1) return candidates;
  return [...candidates].sort(
    (a, b) => (iconSourceHits.get(getUrlOrigin(b)) || 0) - (iconSourceHits.get(getUrlOrigin(a)) || 0)
  );
};

// 候选源全部并发，首个拿到有效图片的胜出，其余立即销毁连接。
// 串行逐个重试时，国内最坏要等满 N × requestTimeout 才判定失败。
const downloadIconWithMirrors = (canonicalUrl, type = 'general') => {
  const candidates = rankCandidates(buildIconUrlCandidates(canonicalUrl));
  if (candidates.length === 0) return Promise.resolve(null);

  return new Promise((resolve) => {
    const inflight = new Map();
    let settled = false;
    let remaining = candidates.length;

    const finish = (filePath) => {
      if (settled) return;
      settled = true;
      clearTimeout(budget);
      for (const req of inflight.values()) {
        try { req.destroy(); } catch { /* 已结束 */ }
      }
      inflight.clear();
      resolve(filePath);
    };

    const budget = setTimeout(() => finish(null), getNetworkConfig().iconCache.requestTimeout);

    for (const candidate of candidates) {
      downloadIcon(candidate, canonicalUrl, type, (req) => inflight.set(candidate, req))
        .then((filePath) => {
          inflight.delete(candidate);
          remaining -= 1;
          if (filePath) {
            const origin = getUrlOrigin(candidate);
            if (origin) iconSourceHits.set(origin, Date.now());
            finish(filePath);
          } else if (remaining === 0) {
            finish(null);
          }
        });
    }
  });
};

const resolveSingleIcon = (canonicalUrl, type = 'general') => {
  const cachedPath = getCachedIconPath(canonicalUrl);
  if (cachedPath) return Promise.resolve(toLocalMediaUrl(cachedPath));

  const failedAt = iconFailures.get(canonicalUrl);
  if (failedAt && Date.now() - failedAt < ICON_FAILURE_TTL) {
    return Promise.resolve(null);
  }

  if (iconResolveTasks.has(canonicalUrl)) return iconResolveTasks.get(canonicalUrl);

  const task = downloadIconWithMirrors(canonicalUrl, type)
    .then((filePath) => {
      if (filePath) return toLocalMediaUrl(filePath);
      iconFailures.set(canonicalUrl, Date.now());
      return null;
    })
    .catch(() => {
      iconFailures.set(canonicalUrl, Date.now());
      return null;
    })
    .finally(() => iconResolveTasks.delete(canonicalUrl));

  iconResolveTasks.set(canonicalUrl, task);
  return task;
};

// 受并发上限约束的遍历，避免几十张卡片同时打出几十个连接
const mapWithConcurrency = async (items, limit, worker) => {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      await worker(items[cursor++]);
    }
  });
  await Promise.all(runners);
};

// 批量解析：{ 原始url: local-media 地址 | null }。缓存命中时零网络请求。
// type 透传至每条下载路径，使落盘索引携带分类信息，供按类型清理使用。
const resolveIconUrls = async (urls, type = 'general') => {
  const result = {};
  if (!Array.isArray(urls)) return result;

  const rawByCanonical = new Map();
  for (const raw of urls) {
    if (typeof raw !== 'string' || !raw.startsWith('http')) continue;
    result[raw] = null;
    const canonical = toCanonicalIconUrl(raw);
    const bucket = rawByCanonical.get(canonical);
    if (bucket) bucket.push(raw);
    else rawByCanonical.set(canonical, [raw]);
  }

  // 已落盘的同步返回：这些条目不受下面的批量等待预算影响，必定带回地址
  const pending = [];
  for (const [canonical, raws] of rawByCanonical.entries()) {
    const cachedPath = getCachedIconPath(canonical);
    if (cachedPath) {
      const localUrl = toLocalMediaUrl(cachedPath);
      for (const raw of raws) result[raw] = localUrl;
    } else {
      pending.push({ canonical, raws });
    }
  }
  if (pending.length === 0) return result;

  // 未落盘的并发下载，整批最多等 ICON_BATCH_BUDGET：
  // 超时的那些本次返回 null（不写负缓存），后台任务继续下载落盘，下次命中。
  await Promise.race([
    mapWithConcurrency(pending, ICON_MAX_CONCURRENCY, async ({ canonical, raws }) => {
      const localUrl = await resolveSingleIcon(canonical, type);
      if (localUrl) {
        for (const raw of raws) result[raw] = localUrl;
      }
    }),
    new Promise((resolve) => setTimeout(resolve, ICON_BATCH_BUDGET)),
  ]);

  return result;
};

// 安装插件后调用：趁联网把图标落盘，保证已安装插件的图标展示不再依赖网络。
// best-effort —— 失败不影响安装结果。
const cachePluginIcon = async (pluginDir) => {
  try {
    const manifestPath = path.join(pluginDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    // 已有随包本地图标的插件不再联网预取：显示时用不到，落盘只会占缓存统计
    const pluginId = manifest?.id || path.basename(pluginDir);
    if (manifest && typeof manifest.iconUrl === 'string' && !hasLocalPluginIcon(pluginId, manifest.iconUrl)) {
      await resolveIconUrls([manifest.iconUrl], 'plugin');
    }
  } catch {
    // 图标缓存失败不影响插件安装
  }
};

const loadFloatConfigWithIcons = async () => {
  const config = loadFloatConfig();
  
  const results = await Promise.all(
    config.map(async (item) => {
      if (item.type === 'plugin' && item.path && item.path.startsWith('http')) {
        // 与 resolveIconUrls 共用同一份缓存键：插件安装时落盘的图标这里可直接命中
        const canonical = toCanonicalIconUrl(item.path);
        const iconPath = getCachedIconPath(canonical) || await downloadIconWithMirrors(canonical, 'plugin');
        const dataUrl = iconPath ? getIconDataUrl(iconPath) : null;
        
        if (dataUrl) {
          return { ...item, iconDataUrl: dataUrl };
        }
      }
      return item;
    })
  );
  
  return results;
};

const clearIconCacheByType = (type) => {
  try {
    const index = loadIconCacheIndex();
    const urlsToDelete = [];
    for (const [url, entry] of Object.entries(index.icons)) {
      if (entry.type === type) {
        const filePath = path.join(iconCacheDir, entry.file);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        urlsToDelete.push(url);
      }
    }
    // 桌面应用提取的图标没有索引条目（按"未被索引引用"识别），归入 app 分类，
    // 清理应用缓存时一并删除，否则这一层只能靠「清空全部」才能清掉
    let extractedDeleted = 0;
    if (type === 'app') {
      const referencedFiles = new Set(Object.values(index.icons).map(e => e.file));
      for (const file of fs.readdirSync(iconCacheDir)) {
        if (file === 'index.json' || referencedFiles.has(file)) continue;
        try {
          fs.unlinkSync(path.join(iconCacheDir, file));
          extractedDeleted++;
        } catch { /* ignore */ }
      }
    }
    for (const url of urlsToDelete) delete index.icons[url];
    if (urlsToDelete.length > 0) {
      saveIconCacheIndex();
    }
    if (urlsToDelete.length > 0 || extractedDeleted > 0) {
      // 负缓存以 URL 为键（不含类型信息），只能整体清除，否则清完仍无法重新解析
      iconFailures.clear();
      console.log(`Cleared ${urlsToDelete.length} indexed + ${extractedDeleted} extracted icon cache entries of type: ${type}`);
    }
  } catch (error) {
    console.error('Failed to clear icon cache by type:', error);
  }
};

const emptyIconCacheTypeStats = () => ({
  general: { count: 0, size: 0 },
  plugin: { count: 0, size: 0 },
  app: { count: 0, size: 0 },
});

/**
 * 统计磁盘远程图标缓存（index.json 条目，按 type 分类）与桌面应用提取图标（sha1.png，不在索引中）。
 * byType 供设置页按「通用 / 插件 / 应用」展示与清理 —— 桌面端远程图标只落这一层，
 * 不进浏览器 Cache API，缺少 byType 时分类卡片在 Electron 下会恒为 0。
 */
const getIconCacheStats = () => {
  try {
    // 顺带清理过期条目：TTL 平时只在读取时懒淘汰，复用这次索引遍历，不额外增加 IO
    pruneExpiredIcons();
    const index = loadIconCacheIndex();
    const byType = emptyIconCacheTypeStats();
    let remoteCount = 0;
    let remoteSize = 0;
    for (const entry of Object.values(index.icons)) {
      remoteCount++;
      const bucket = byType[entry.type] || byType.general;
      bucket.count++;
      const filePath = path.join(iconCacheDir, entry.file);
      if (fs.existsSync(filePath)) {
        try {
          const fileSize = fs.statSync(filePath).size;
          remoteSize += fileSize;
          bucket.size += fileSize;
        } catch { /* ignore */ }
      }
    }
    let extractedCount = 0;
    let extractedSize = 0;
    const referencedFiles = new Set(Object.values(index.icons).map(e => e.file));
    const allFiles = fs.readdirSync(iconCacheDir).filter(f => f !== 'index.json');
    for (const file of allFiles) {
      if (!referencedFiles.has(file)) {
        extractedCount++;
        const filePath = path.join(iconCacheDir, file);
        try { extractedSize += fs.statSync(filePath).size; } catch { /* ignore */ }
      }
    }
    // 桌面应用提取的图标无索引条目，按用途归入 app 分类，使其可被统计与清理
    byType.app.count += extractedCount;
    byType.app.size += extractedSize;
    return { count: remoteCount, size: remoteSize, extractedCount, extractedSize, byType };
  } catch (error) {
    console.error('Failed to get icon cache stats:', error);
    return { count: 0, size: 0, extractedCount: 0, extractedSize: 0, byType: emptyIconCacheTypeStats() };
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
    iconFailures.clear();
    saveIconCacheIndex();
    console.log('Cleared all icon cache');
  } catch (error) {
    console.error('Failed to clear icon cache:', error);
  }
};

module.exports = {
  loadSettings,
  saveSettings,
  isDarkTheme,
  loadThemeSnapshot,
  saveThemeSnapshot,
  loadShortcuts,
  saveShortcuts,
  loadFloatConfig,
  loadFloatConfigWithIcons,
  saveFloatConfig,
  clearIconCacheByType,
  clearAllIconCache,
  resolveIconUrls,
  cachePluginIcon,
  getIconCacheStats,
  defaultShortcuts,
  getDefaultFloatConfig,
  getNetworkConfig,
  invalidateNetworkConfigCache,
};