import { create } from 'zustand';
import {
  loadApps,
  scanAndAddDesktopApps,
  scanAndAddInstalledApps,
} from '../utils/quickLaunch';
import { useToastStore } from './toastStore';

interface QuickLaunchScanStore {
  /** 桌面扫描进行中 */
  isScanningDesktop: boolean;
  /** 已安装应用扫描（开始菜单 + 快速启动栏）进行中 */
  isScanningInstalled: boolean;
  /** 扫描进度（0-100） */
  progress: number;
  /** 每次扫描完成（含失败）后递增，组件据此刷新列表 */
  scanVersion: number;
  scanDesktop: () => Promise<void>;
  scanInstalled: () => Promise<void>;
}

const toast = (type: 'success' | 'error' | 'info', message: string) =>
  useToastStore.getState().addToast({ type, message });

// 两个扫描入口统一的结果提示（同一结构，仅扫描源描述不同）
const notifyScanResult = (addedCount: number, skippedCount: number, source = '') => {
  if (addedCount > 0) {
    toast('success', `扫描完成，已添加 ${addedCount} 个应用`);
  } else if (skippedCount > 0) {
    toast('info', `扫描完成，${skippedCount} 个已存在，已跳过`);
  } else {
    toast('info', `${source}未发现可添加的应用`);
  }
};

export const useQuickLaunchScanStore = create<QuickLaunchScanStore>((set, get) => ({
  isScanningDesktop: false,
  isScanningInstalled: false,
  progress: 0,
  scanVersion: 0,

  scanDesktop: async () => {
    if (get().isScanningDesktop || get().isScanningInstalled) return;
    set({ isScanningDesktop: true, progress: 0 });
    toast('info', '正在扫描桌面应用...');
    try {
      const result = await scanAndAddDesktopApps(loadApps());
      set({ progress: 100 });
      notifyScanResult(result.addedCount, result.skippedCount, '桌面上');
    } catch (error) {
      toast('error', '扫描桌面应用失败，请重试');
      console.error('Error scanning desktop:', error);
    } finally {
      set({ isScanningDesktop: false, scanVersion: get().scanVersion + 1 });
    }
  },

  scanInstalled: async () => {
    if (get().isScanningInstalled || get().isScanningDesktop) return;
    set({ isScanningInstalled: true, progress: 0 });
    toast('info', '正在扫描已安装应用...');
    try {
      const result = await scanAndAddInstalledApps(loadApps());
      set({ progress: 100 });
      notifyScanResult(result.addedCount, result.skippedCount);
    } catch (error) {
      toast('error', '扫描已安装应用失败，请重试');
      console.error('Error scanning installed apps:', error);
    } finally {
      set({ isScanningInstalled: false, scanVersion: get().scanVersion + 1 });
    }
  },
}));

// 模块级订阅扫描进度（与组件生命周期解耦，页面切换不中断、不重复订阅）
if (typeof window !== 'undefined' && window.electron?.onScanInstalledAppsProgress) {
  window.electron.onScanInstalledAppsProgress((data) => {
    useQuickLaunchScanStore.setState({ progress: data.percent });
  });
}
