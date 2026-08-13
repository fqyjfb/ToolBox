import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';
import { iconCacheService } from '../services/iconCacheService';

export interface QuickLaunchCategory {
  id: string;
  name: string;
  color: string;
}

export interface QuickLaunchItem {
  id: string;
  name: string;
  path: string;
  icon?: string;
  categoryId: string;
  addedAt: number;
}

export const getAppName = (path: string): string => {
  const name = path.split(/[\\/]/).pop() || path;
  return name.replace(/\.(exe|bat|cmd|lnk)$/i, '');
};

export const loadApps = (): QuickLaunchItem[] => {
  return localStorageService.get<QuickLaunchItem[]>(STORAGE_KEYS.QUICK_LAUNCH_APPS, []);
};

export const ensureAppIconsCached = async (apps: QuickLaunchItem[]): Promise<void> => {
  for (const app of apps) {
    if (app.icon) {
      const dataUrl = `data:image/png;base64,${app.icon}`;
      try {
        await iconCacheService.setFromDataUrl(app.path, dataUrl, 'app');
      } catch {
      }
    }
  }
};

export const saveApps = (apps: QuickLaunchItem[]): void => {
  localStorageService.set(STORAGE_KEYS.QUICK_LAUNCH_APPS, apps);
};

export const loadCategories = (): QuickLaunchCategory[] => {
  return localStorageService.get<QuickLaunchCategory[]>(STORAGE_KEYS.QUICK_LAUNCH_CATEGORIES, []);
};

export const getDefaultCategoryId = (categories: QuickLaunchCategory[]): string => {
  return categories[0]?.id || '';
};

export const addAppIfNotExists = async (
  existingApps: QuickLaunchItem[],
  path: string,
  categoryId: string
): Promise<{ added: boolean; app?: QuickLaunchItem }> => {
  const lowerPath = path.toLowerCase();
  const exists = existingApps.some(app => app.path.toLowerCase() === lowerPath);
  
  if (exists) {
    return { added: false };
  }
  
  const icon = await window.electron?.getFileIcon(path) || undefined;
  
  if (icon) {
    const dataUrl = `data:image/png;base64,${icon}`;
    iconCacheService.setFromDataUrl(path, dataUrl, 'app').catch(() => {});
  }
  
  const newApp: QuickLaunchItem = {
    id: Date.now().toString(),
    name: getAppName(path),
    path,
    icon,
    categoryId,
    addedAt: Date.now(),
  };
  
  return { added: true, app: newApp };
};

export const scanAndAddDesktopApps = async (
  existingApps: QuickLaunchItem[],
  defaultCategoryId: string
): Promise<{ addedCount: number; skippedCount: number }> => {
  const desktopApps = await window.electron?.scanDesktopApps() || [];
  let addedCount = 0;
  let skippedCount = 0;
  
  const updatedApps = [...existingApps];
  
  for (const app of desktopApps) {
    const result = await addAppIfNotExists(updatedApps, app.path, defaultCategoryId);
    if (result.added && result.app) {
      updatedApps.push(result.app);
      addedCount++;
    } else {
      skippedCount++;
    }
  }
  
  if (addedCount > 0) {
    saveApps(updatedApps);
  }
  
  return { addedCount, skippedCount };
};

export const loadHomeQuickLaunchApps = (): QuickLaunchItem[] => {
  return localStorageService.get<QuickLaunchItem[]>(STORAGE_KEYS.HOME_QUICK_LAUNCH, []);
};

export const saveHomeQuickLaunchApps = (apps: QuickLaunchItem[]): void => {
  localStorageService.set(STORAGE_KEYS.HOME_QUICK_LAUNCH, apps);
};

export const addHomeQuickLaunchApp = (app: QuickLaunchItem): boolean => {
  const existingApps = loadHomeQuickLaunchApps();
  const exists = existingApps.some(a => a.path.toLowerCase() === app.path.toLowerCase());
  
  if (exists) {
    return false;
  }
  
  existingApps.push(app);
  saveHomeQuickLaunchApps(existingApps);
  
  if (app.icon) {
    const dataUrl = `data:image/png;base64,${app.icon}`;
    iconCacheService.setFromDataUrl(app.path, dataUrl, 'app').catch(() => {});
  }
  
  return true;
};

export const removeHomeQuickLaunchApp = (appId: string): void => {
  const existingApps = loadHomeQuickLaunchApps();
  const filteredApps = existingApps.filter(app => app.id !== appId);
  saveHomeQuickLaunchApps(filteredApps);
};

export const isAppInHomeQuickLaunch = (path: string): boolean => {
  const apps = loadHomeQuickLaunchApps();
  return apps.some(a => a.path.toLowerCase() === path.toLowerCase());
};