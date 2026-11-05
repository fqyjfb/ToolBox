import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import { PluginInfo, InstalledPlugin } from '../types/plugin';

// --- 已安装插件：localStorage 持久化 ---
function coerce(raw: unknown): InstalledPlugin[] {
  if (!raw || typeof raw !== 'object') return [];
  const installedPlugins = (raw as Record<string, unknown>).installedPlugins;
  return Array.isArray(installedPlugins) ? (installedPlugins as InstalledPlugin[]) : [];
}
function persistInstalled(installedPlugins: InstalledPlugin[]): void {
  localStorageService.set(STORAGE_KEYS.PLUGINS, { installedPlugins });
}
const initialInstalled = coerce(localStorageService.get<unknown>(STORAGE_KEYS.PLUGINS, null));

// --- 可用插件注册表：localStorage 缓存（TTL=1h，离线优先） ---
const AVAILABLE_CACHE_KEY = STORAGE_KEYS.PLUGINS_AVAILABLE_CACHE;
const AVAILABLE_CACHE_TTL = 3600000;

interface AvailableCache {
  plugins: PluginInfo[];
  timestamp: number;
}

function getCachedAvailable(): { plugins: PluginInfo[]; fresh: boolean } {
  try {
    const raw = localStorage.getItem(AVAILABLE_CACHE_KEY);
    if (!raw) return { plugins: [], fresh: false };
    const cache: AvailableCache = JSON.parse(raw);
    if (!Array.isArray(cache.plugins)) return { plugins: [], fresh: false };
    const fresh = Date.now() - (cache.timestamp || 0) < AVAILABLE_CACHE_TTL;
    return { plugins: cache.plugins, fresh };
  } catch {
    return { plugins: [], fresh: false };
  }
}

function persistAvailable(plugins: PluginInfo[]): void {
  try {
    localStorage.setItem(AVAILABLE_CACHE_KEY, JSON.stringify({
      plugins,
      timestamp: Date.now(),
    }));
  } catch { /* quota 等静默忽略 */ }
}

const initialAvailableCache = getCachedAvailable();

interface PluginStore {
  availablePlugins: PluginInfo[];
  installedPlugins: InstalledPlugin[];
  /** 是否已有未过期的 availablePlugins（缓存或网络真值），页面据此决定是否跳过网络请求 */
  availableLoaded: boolean;
  isLoading: boolean;
  installingPluginId: string | null;

  setAvailablePlugins: (plugins: PluginInfo[]) => void;
  setInstalledPlugins: (plugins: InstalledPlugin[]) => void;
  togglePluginPinned: (pluginId: string, pinned: boolean) => void;

  setIsLoading: (loading: boolean) => void;
  setInstallingPluginId: (id: string | null) => void;
}

export const usePluginStore = create<PluginStore>((set) => ({
  availablePlugins: initialAvailableCache.plugins,
  installedPlugins: initialInstalled,
  availableLoaded: initialAvailableCache.fresh,
  isLoading: false,
  installingPluginId: null,

  setAvailablePlugins: (plugins) => {
    persistAvailable(plugins);
    set({ availablePlugins: plugins, availableLoaded: true });
  },

  setInstalledPlugins: (plugins) => {
    persistInstalled(plugins);
    set({ installedPlugins: plugins });
  },

  togglePluginPinned: (pluginId, pinned) => set((state) => {
    const installedPlugins = state.installedPlugins.map(p =>
      p.id === pluginId ? { ...p, isPinned: pinned } : p
    );
    persistInstalled(installedPlugins);
    return { installedPlugins };
  }),

  setIsLoading: (loading) => set({ isLoading: loading }),
  setInstallingPluginId: (id) => set({ installingPluginId: id }),
}));
