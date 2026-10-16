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
  // P0 扩展（可选，向后兼容）
  alias?: string;            // 自定义别名（用于搜索）
  keywords?: string;         // 空格分隔关键词
  launchCount?: number;      // 启动次数
  lastLaunchedAt?: number;   // 最近启动时间戳
  // P1 扩展（可选，向后兼容）
  args?: string;             // 启动参数
  workingDir?: string;       // 工作目录
  runAsAdmin?: boolean;      // 以管理员身份运行
  windowMode?: 'normal' | 'minimized' | 'maximized'; // 窗口模式
  // P2 扩展（可选，向后兼容）
  hotkey?: string;           // 全局快捷键，如 "Alt+Shift+1"
}

export type QuickLaunchSortMode = 'custom' | 'name' | 'addedAt' | 'launchCount' | 'lastLaunchedAt';
export type QuickLaunchVirtualCategory = 'all' | 'frequent' | 'recent' | string;

// ---------- 桌面磁贴排序（文件夹 cat:<id> / 应用 app:<id> 混合排列） ----------

export const toFolderKey = (categoryId: string): string => `cat:${categoryId}`;
export const toAppKey = (appId: string): string => `app:${appId}`;

export const loadDesktopOrder = (): string[] =>
  localStorageService.get<string[]>(STORAGE_KEYS.QUICK_LAUNCH_DESKTOP_ORDER, []);

export const saveDesktopOrder = (order: string[]): void => {
  localStorageService.set(STORAGE_KEYS.QUICK_LAUNCH_DESKTOP_ORDER, order);
};

/**
 * 顺序对账（幂等）：丢弃已失效键、去重，并补齐新增项（分类在前、应用在后）。
 * 新增 / 删除 / 扫描 / 导入导出都不需要维护顺序数组，渲染前对账即可。
 */
export const reconcileDesktopOrder = (
  order: string[],
  categories: QuickLaunchCategory[],
  apps: QuickLaunchItem[]
): string[] => {
  const valid = new Set<string>([
    ...categories.map((c) => toFolderKey(c.id)),
    ...apps.map((a) => toAppKey(a.id)),
  ]);

  const kept: string[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    if (valid.has(key) && !seen.has(key)) {
      kept.push(key);
      seen.add(key);
    }
  }

  const missing = [
    ...categories.map((c) => toFolderKey(c.id)),
    ...apps.map((a) => toAppKey(a.id)),
  ].filter((key) => !seen.has(key));

  return [...kept, ...missing];
};

/**
 * 只重排 subsetIds 这个子集的落位，其余元素保持原位。
 * 用于桌面未分类应用排序与文件夹内应用排序（避免把非目标应用挤到末尾）。
 */
export const applySubsetOrder = (
  all: QuickLaunchItem[],
  subsetIds: string[]
): QuickLaunchItem[] => {
  const byId = new Map(all.map((a) => [a.id, a]));
  const inSubset = new Set(subsetIds);
  let cursor = 0;
  return all.map((item) => (inSubset.has(item.id) ? byId.get(subsetIds[cursor++])! : item));
};

/** 按排序模式排序（custom 由调用方按用户拖拽顺序处理） */
export const sortAppsByMode = (
  list: QuickLaunchItem[],
  mode: Exclude<QuickLaunchSortMode, 'custom'>
): QuickLaunchItem[] => {
  const sorted = [...list];
  switch (mode) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      break;
    case 'addedAt':
      sorted.sort((a, b) => a.addedAt - b.addedAt);
      break;
    case 'launchCount':
      sorted.sort((a, b) => (b.launchCount ?? 0) - (a.launchCount ?? 0));
      break;
    case 'lastLaunchedAt':
      sorted.sort((a, b) => (b.lastLaunchedAt ?? 0) - (a.lastLaunchedAt ?? 0));
      break;
  }
  return sorted;
};

export const getAppName = (path: string): string => {
  const name = path.split(/[\\/]/).pop() || path;
  return name.replace(/\.(exe|bat|cmd|lnk)$/i, '');
};

let appIdSeq = 0;
// 唯一 ID：时间戳+序列+随机数，避免批量添加时 Date.now() 重复导致 React key 冲突
export const generateAppId = (): string =>
  `${Date.now().toString(36)}-${(appIdSeq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

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
        // 图标缓存失败不影响主流程
      }
    }
  }
};

export const saveApps = (apps: QuickLaunchItem[]): void => {
  localStorageService.set(STORAGE_KEYS.QUICK_LAUNCH_APPS, apps);
};

export const addAppIfNotExists = async (
  existingApps: QuickLaunchItem[],
  path: string,
  displayName?: string,
  args?: string
): Promise<{ added: boolean; app?: QuickLaunchItem; merged?: boolean }> => {
  const lowerPath = path.toLowerCase();
  const exists = existingApps.some(app => app.path.toLowerCase() === lowerPath);

  if (exists) {
    return { added: false };
  }

  // 历史数据修复：早期扫描添加过 .lnk 路径条目（解析失败回退的产物），现解析为 exe 目标后
  // 路径不匹配会被当作新应用重复添加（表现为"分类被重置"）。同名 .lnk 条目合并：更新路径与
  // 启动参数，保留原分类与使用统计，避免重复添加。
  if (!lowerPath.endsWith('.lnk')) {
    const legacyName = displayName || getAppName(path);
    const legacy = existingApps.find(app => app.path.toLowerCase().endsWith('.lnk') && app.name === legacyName);
    if (legacy) {
      legacy.path = path;
      legacy.args = args || legacy.args;
      return { added: false, merged: true };
    }
  }

  const icon = await window.electron?.getFileIcon(path) || undefined;

  if (icon) {
    const dataUrl = `data:image/png;base64,${icon}`;
    iconCacheService.setFromDataUrl(path, dataUrl, 'app').catch(() => {});
  }

  const newApp: QuickLaunchItem = {
    id: generateAppId(),
    // 命名以快捷方式名称为主，无快捷方式名时回退目标文件名
    name: displayName || getAppName(path),
    path,
    icon,
    // 保留快捷方式的启动参数（如钉钉 /run:desktop），保证按原方式启动
    args: args || undefined,
    // 扫描添加的应用默认无分类，仅在"全部"下显示，由用户自由归类
    categoryId: '',
    addedAt: Date.now(),
  };

  return { added: true, app: newApp };
};

// 扫描添加共享实现（桌面扫描与已安装应用扫描逻辑一致，仅数据源不同）
const scanAndAdd = async (
  scan: () => Promise<Array<{ name: string; path: string; args?: string }>> | undefined,
  existingApps: QuickLaunchItem[]
): Promise<{ addedCount: number; skippedCount: number }> => {
  const scanned = (await scan()) || [];
  let addedCount = 0;
  let skippedCount = 0;
  let mergedCount = 0;
  const updatedApps = [...existingApps];

  for (const app of scanned) {
    const result = await addAppIfNotExists(updatedApps, app.path, app.name, app.args);
    if (result.added && result.app) {
      updatedApps.push(result.app);
      addedCount++;
    } else {
      if (result.merged) mergedCount++;
      skippedCount++;
    }
  }

  // 新增或历史条目合并（路径更新）时才持久化
  if (addedCount > 0 || mergedCount > 0) {
    saveApps(updatedApps);
  }

  return { addedCount, skippedCount };
};

export const scanAndAddDesktopApps = (existingApps: QuickLaunchItem[]) =>
  scanAndAdd(() => window.electron?.scanDesktopApps(), existingApps);

// 扫描已安装应用（开始菜单 + 快速启动栏），与 scanAndAddDesktopApps 并存（桌面扫描）
export const scanAndAddInstalledApps = (existingApps: QuickLaunchItem[]) =>
  scanAndAdd(() => window.electron?.scanInstalledApps(), existingApps);

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