import { logError } from './loggerService';

export const STORAGE_KEYS = {
  USER: 'user',
  ADMIN: 'admin',
  AUTH: 'auth',
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
  HOME_FAVORITES: 'homeFavorites',
  HOME_TOOLS: 'homeTools',
  HOME_QUICK_LAUNCH: 'homeQuickLaunchApps',
  
  LAST_OPENED_FILE: 'toolbox_last_opened_file',
  NOTES_LAST_OPENED_FILE: 'notes_last_opened_file',
  
  ACCOUNT_COLUMNS: 'account_columns_visible',
  PLATFORM_VISIBILITY: 'account_platform_visibility',
  PLATFORM_ORDER: 'account_platform_order',
  WEBSITE_ACCOUNT_CATEGORY_ORDER: 'websiteAccountCategoryOrder',
  
  AGNES_PREFIX: 'agnes_',
  
  MARKDOWN_WECHAT_CONTENT: 'markdown-wechat-content',
  OCR_SETTINGS: 'ocr_settings',
  
  NOTES_SIDEBAR_VISIBLE: 'notes_sidebar_visible',
  OCR_HISTORY: 'ocr_history',
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