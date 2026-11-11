import { create } from 'zustand';

/**
 * 应用锁共享状态：设置页（AppLockTab）与快启动右键菜单（QuickLaunch）订阅同一份配置，
 * 任一页面的增删都即时反映到另一页面（避免各自持本地副本导致的状态漂移）。
 * 仅收敛"配置数据"（masterEnabled / apps）；运行时状态徽标（getStatus 轮询）仍归设置页局部。
 */
interface AppLockStoreState {
  masterEnabled: boolean;
  apps: AppLockAppConfig[];
  loaded: boolean;
  /** 全量拉取配置（幂等，可重复调用） */
  load: () => Promise<void>;
  setMasterEnabled: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  addApp: (payload: { name?: string; exePath: string; icon?: string }) => Promise<{ success: boolean; error?: string }>;
  removeApp: (id: string) => Promise<{ success: boolean; error?: string }>;
  toggleApp: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>;
}

export const useAppLockStore = create<AppLockStoreState>((set, get) => ({
  masterEnabled: false,
  apps: [],
  loaded: false,

  load: async () => {
    try {
      const config = await window.electron?.appLock.getConfig();
      if (!config) return;
      set({ masterEnabled: config.masterEnabled, apps: config.apps, loaded: true });
    } catch {
      // 拉取失败保留现状，由调用方决定是否提示
    }
  },

  setMasterEnabled: async (enabled) => {
    const previous = get().masterEnabled;
    set({ masterEnabled: enabled }); // 乐观更新，失败回滚
    try {
      const result = await window.electron?.appLock.setMasterEnabled(enabled);
      if (result?.success) return { success: true };
      set({ masterEnabled: previous });
      return { success: false };
    } catch {
      set({ masterEnabled: previous });
      return { success: false };
    }
  },

  addApp: async (payload) => {
    try {
      const result = await window.electron?.appLock.addApp(payload);
      if (result?.success && result.app) {
        set((state) => (
          state.apps.some((app) => app.id === result.app!.id)
            ? state
            : { apps: [...state.apps, result.app!] }
        ));
        return { success: true };
      }
      return { success: false, error: result?.error };
    } catch {
      return { success: false };
    }
  },

  removeApp: async (id) => {
    try {
      const result = await window.electron?.appLock.removeApp(id);
      if (result?.success) {
        set((state) => ({ apps: state.apps.filter((app) => app.id !== id) }));
        return { success: true };
      }
      return { success: false, error: result?.error };
    } catch {
      return { success: false };
    }
  },

  toggleApp: async (id, enabled) => {
    const previous = get().apps;
    set({ apps: previous.map((app) => (app.id === id ? { ...app, enabled } : app)) }); // 乐观更新，失败回滚
    try {
      const result = await window.electron?.appLock.toggleApp(id, enabled);
      if (result?.success) return { success: true };
      set({ apps: previous });
      return { success: false, error: result?.error };
    } catch {
      set({ apps: previous });
      return { success: false };
    }
  },
}));
