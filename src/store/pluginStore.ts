import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import { PluginInfo, InstalledPlugin } from '../types/plugin';

function loadState() {
  try {
    const raw = localStorageService.getString(STORAGE_KEYS.PLUGINS);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        installedPlugins: parsed.installedPlugins || [],
      };
    }
  } catch { /* ignore */ }
  return {};
}

function saveState(state: { installedPlugins: InstalledPlugin[] }) {
  localStorageService.setString(STORAGE_KEYS.PLUGINS, JSON.stringify({
    installedPlugins: state.installedPlugins,
  }));
}

const initial = loadState();

interface PluginStore {
  availablePlugins: PluginInfo[];
  installedPlugins: InstalledPlugin[];
  isLoading: boolean;
  searchQuery: string;
  selectedCategories: string[];
  installingPluginId: string | null;
  installProgress: number;

  setAvailablePlugins: (plugins: PluginInfo[]) => void;
  setInstalledPlugins: (plugins: InstalledPlugin[]) => void;
  addInstalledPlugin: (plugin: InstalledPlugin) => void;
  removeInstalledPlugin: (pluginId: string) => void;
  togglePluginEnabled: (pluginId: string, enabled: boolean) => void;
  togglePluginPinned: (pluginId: string, pinned: boolean) => void;

  setSearchQuery: (query: string) => void;
  setSelectedCategories: (categories: string[]) => void;
  setIsLoading: (loading: boolean) => void;
  setInstallingPluginId: (id: string | null) => void;
  setInstallProgress: (progress: number) => void;
}

export const usePluginStore = create<PluginStore>((set) => ({
  availablePlugins: [],
  installedPlugins: initial.installedPlugins || [],
  isLoading: false,
  searchQuery: '',
  selectedCategories: [],
  installingPluginId: null,
  installProgress: 0,

  setAvailablePlugins: (plugins) => set({ availablePlugins: plugins }),

  setInstalledPlugins: (plugins) => set((state) => {
    const next = { installedPlugins: plugins };
    saveState({ ...state, ...next });
    return next;
  }),

  addInstalledPlugin: (plugin) => set((state) => {
    const existing = state.installedPlugins.find(p => p.id === plugin.id);
    const plugins = existing
      ? state.installedPlugins.map(p => p.id === plugin.id ? plugin : p)
      : [...state.installedPlugins, plugin];
    const next = { installedPlugins: plugins };
    saveState({ ...state, ...next });
    return next;
  }),

  removeInstalledPlugin: (pluginId) => set((state) => {
    const next = { installedPlugins: state.installedPlugins.filter(p => p.id !== pluginId) };
    saveState({ ...state, ...next });
    return next;
  }),

  togglePluginEnabled: (pluginId, enabled) => set((state) => {
    const next = {
      installedPlugins: state.installedPlugins.map(p =>
        p.id === pluginId ? { ...p, enabled } : p
      ),
    };
    saveState({ ...state, ...next });
    return next;
  }),

  togglePluginPinned: (pluginId, pinned) => set((state) => {
    const next = {
      installedPlugins: state.installedPlugins.map(p =>
        p.id === pluginId ? { ...p, isPinned: pinned } : p
      ),
    };
    saveState({ ...state, ...next });
    return next;
  }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategories: (categories) => set({ selectedCategories: categories }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setInstallingPluginId: (id) => set({ installingPluginId: id }),
  setInstallProgress: (progress) => set({ installProgress: progress }),
}));