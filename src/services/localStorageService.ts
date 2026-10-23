import { logError } from './loggerService';

export const STORAGE_KEYS = {
  USER: 'user',
  ADMIN: 'admin',
  USERNAME: 'toolbox_username',
  PASSWORD: 'toolbox_password',
  LAST_LOGIN_TIME: 'toolbox_last_login_time',

  THEME: 'toolbox_theme',
  BROWSER_MODE: 'toolbox_browser_mode',
  WEATHER_CITY: 'weatherCity',
  NOTIFICATION_ERRORS: 'toolbox_notification_errors',
  SIDEBAR: 'sidebar-storage-v1',

  QUICK_LAUNCH_APPS: 'quickLaunchApps',
  QUICK_LAUNCH_CATEGORIES: 'quickLaunchCategories',
  QUICK_LAUNCH_ICON_SIZE: 'quickLaunchIconSize',
  QUICK_LAUNCH_SHOW_TEXT: 'quickLaunchShowText',
  QUICK_LAUNCH_SORT_MODE: 'quickLaunchSortMode',
  QUICK_LAUNCH_SINGLE_CLICK: 'quickLaunchSingleClick',
  // 桌面磁贴排列顺序（文件夹 + 未分类应用混合排序）
  QUICK_LAUNCH_DESKTOP_ORDER: 'quickLaunchDesktopOrder',
  HOME_FAVORITES: 'homeFavorites',
  HOME_TOOLS: 'homeTools',
  // 天气卡已并入首页工具列表（老数据补一次即不再回填）
  HOME_TOOLS_WEATHER_SEEDED: 'homeToolsWeatherSeeded',
  HOME_QUICK_LAUNCH: 'homeQuickLaunchApps',
  // 首页混合网格的卡片排列顺序（工具/快启动/网址收藏/网页收藏/新闻/摸鱼统一排序）
  // 已升级为坐标布局（HOME_CARD_LAYOUT），此键仅作为老数据的迁移输入
  HOME_CARD_ORDER: 'homeCardOrder',
  // 首页混合网格的卡片坐标布局（cardId -> 左上角单元格），自由排布的唯一真值
  HOME_CARD_LAYOUT: 'homeCardLayout',

  NOTES_LAST_OPENED_FILE: 'notes_last_opened_file',

  ACCOUNT_COLUMNS: 'account_columns_visible',
  PLATFORM_VISIBILITY: 'account_platform_visibility',
  PLATFORM_ORDER: 'account_platform_order',
  WEBSITE_ACCOUNT_CATEGORY_ORDER: 'websiteAccountCategoryOrder',

  MARKDOWN_WECHAT_CONTENT: 'markdown-wechat-content',

  NOTES_SIDEBAR_VISIBLE: 'notes_sidebar_visible',
  NOTES_PINNED_FOLDERS: 'notes_pinned_folders',
  NOTES_CHAT_PATH: 'notes_chat_path',
  NOTES_ROOT_PATH: 'notes_root_path',
  // 当前查看的固定目录（null = 未配置 / 未选中固定目录）；切导航 / 重启后按此恢复视图
  NOTES_CURRENT_VIEW_PATH: 'notes_current_view_path',
  // T04 / Phase 2：最近打开（U3 最近列表，渲染层 store，localStorage 持久化）
  NOTES_RECENTS: 'notes_recents',
  // T08 / Phase 4：打开的标签页（仅 tabs + activePath，dirtyMap 不落盘）
  NOTES_TABS: 'notes_tabs',
  // 侧边栏各分组（对话整理 / 固定目录 / 收藏 / 最近）的折叠·展开状态
  NOTES_SIDEBAR_SECTIONS: 'notes_sidebar_sections',

  PLUGINS: 'toolbox_plugins',
  // 自定义主题配置（含背景图 data URI）；与 THEME='custom' 联用，缓存清理时需保留
  CUSTOM_THEME: 'toolbox_custom_theme',
  // 自定义主题背景图片库（多图管理）；缓存清理时需保留
  CUSTOM_BG_IMAGES: 'toolbox_custom_bg_images',
  // AI 模型配置（含 API 密钥）；缓存清理时需保留
  AI_CONFIG: 'toolbox_ai_config',
};

export const localStorageService = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      logError(`localStorage.get failed for key "${key}"`, 'localStorageService', error as Error);
      return defaultValue;
    }
  },

  getString(key: string, defaultValue?: string): string | undefined {
    try {
      const item = localStorage.getItem(key);
      return item ?? defaultValue;
    } catch (error) {
      logError(`localStorage.getString failed for key "${key}"`, 'localStorageService', error as Error);
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      logError(`localStorage.set failed for key "${key}"`, 'localStorageService', error as Error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, consider clearing old data');
      }
      return false;
    }
  },

  setString(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      logError(`localStorage.setString failed for key "${key}"`, 'localStorageService', error as Error);
      return false;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logError(`localStorage.remove failed for key "${key}"`, 'localStorageService', error as Error);
    }
  },

  isAvailable(): boolean {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  },

  clearAllExcept(keepKeys: string[]): void {
    try {
      const keepData: Record<string, string> = {};
      keepKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) {
          keepData[key] = value;
        }
      });
      localStorage.clear();
      Object.entries(keepData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    } catch (error) {
      logError('localStorage.clearAllExcept failed', 'localStorageService', error as Error);
    }
  },
};

export default localStorageService;