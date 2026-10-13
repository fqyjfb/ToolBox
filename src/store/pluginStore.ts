import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import { PluginInfo, InstalledPlugin } from '../types/plugin';

// 清洗 localStorage 数据：字段类型不对就回落空数组（兼容旧值与手写脏数据）。
// 读写一律走 localStorageService 的泛型 get/set —— 它已封装序列化与异常，
// 不再手写 JSON.parse / JSON.stringify + try-catch。
function coerce(raw: unknown): InstalledPlugin[] {
  if (!raw || typeof raw !== 'object') return [];
  const installedPlugins = (raw as Record<string, unknown>).installedPlugins;
  return Array.isArray(installedPlugins) ? (installedPlugins as InstalledPlugin[]) : [];
}

function persist(installedPlugins: InstalledPlugin[]): void {
  localStorageService.set(STORAGE_KEYS.PLUGINS, { installedPlugins });
}

const initial = coerce(localStorageService.get<unknown>(STORAGE_KEYS.PLUGINS, null));

interface PluginStore {
  availablePlugins: PluginInfo[];
  installedPlugins: InstalledPlugin[];
  isLoading: boolean;
  installingPluginId: string | null;

  setAvailablePlugins: (plugins: PluginInfo[]) => void;
  setInstalledPlugins: (plugins: InstalledPlugin[]) => void;
  togglePluginPinned: (pluginId: string, pinned: boolean) => void;

  setIsLoading: (loading: boolean) => void;
  setInstallingPluginId: (id: string | null) => void;
}

export const usePluginStore = create<PluginStore>((set) => ({
  availablePlugins: [],
  installedPlugins: initial,
  isLoading: false,
  installingPluginId: null,

  setAvailablePlugins: (plugins) => set({ availablePlugins: plugins }),

  setInstalledPlugins: (plugins) => {
    persist(plugins);
    set({ installedPlugins: plugins });
  },

  togglePluginPinned: (pluginId, pinned) => set((state) => {
    const installedPlugins = state.installedPlugins.map(p =>
      p.id === pluginId ? { ...p, isPinned: pinned } : p
    );
    persist(installedPlugins);
    return { installedPlugins };
  }),

  setIsLoading: (loading) => set({ isLoading: loading }),
  setInstallingPluginId: (id) => set({ installingPluginId: id }),
}));
