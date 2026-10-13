import { useState, useEffect, useCallback } from 'react';
import {
  QuickLaunchItem,
  loadHomeQuickLaunchApps,
  removeHomeQuickLaunchApp,
  saveHomeQuickLaunchApps,
  ensureAppIconsCached,
} from '../utils/quickLaunch';

// 首页快启动数据共享：加载/启动/删除/排序
// （大窗首页左侧栏与小窗标题栏下方个人信息区共用，避免两处重复实现）
export const useHomeQuickLaunch = () => {
  const [apps, setApps] = useState<QuickLaunchItem[]>([]);

  useEffect(() => {
    const loaded = loadHomeQuickLaunchApps();
    setApps(loaded);
    if (loaded.length > 0) {
      ensureAppIconsCached(loaded).catch(() => {});
    }
  }, []);

  const launchApp = useCallback((path: string) => {
    window.electron?.openFile(path);
  }, []);

  const removeApp = useCallback((appId: string) => {
    removeHomeQuickLaunchApp(appId);
    setApps(prev => prev.filter(app => app.id !== appId));
  }, []);

  const reorderApps = useCallback((reordered: QuickLaunchItem[]) => {
    setApps(reordered);
    saveHomeQuickLaunchApps(reordered);
  }, []);

  return { apps, launchApp, removeApp, reorderApps };
};
