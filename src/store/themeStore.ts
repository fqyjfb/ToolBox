import { create } from 'zustand';
import { SyncModuleKey, SyncModule, ConflictItem, StorageLocation } from '../types/offline';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (dark: boolean | 'light' | 'dark') => void;
  
  syncEnabled: boolean;
  syncModules: SyncModule[];
  isSyncing: boolean;
  syncProgress: number;
  lastSyncTime: string | null;
  pendingOperationsCount: number;
  conflicts: ConflictItem[];
  storageUsed: number;
  storageQuota: number;
  storageLocation: StorageLocation;
  
  setSyncEnabled: (enabled: boolean) => void;
  setSyncModules: (modules: SyncModule[]) => void;
  toggleModuleSync: (key: SyncModuleKey) => void;
  setIsSyncing: (syncing: boolean) => void;
  setSyncProgress: (progress: number) => void;
  setLastSyncTime: (time: string | null) => void;
  setPendingOperationsCount: (count: number) => void;
  setConflicts: (conflicts: ConflictItem[]) => void;
  setStorageInfo: (used: number, quota: number) => void;
  setStorageLocation: (location: StorageLocation) => void;
  resetSyncState: () => void;
}

const getInitialTheme = (): boolean => {
  try {
    const storedTheme = localStorage.getItem('toolbox_theme');
    if (storedTheme === 'dark') {
      return true;
    }
    const legacyTheme = localStorage.getItem('theme-isDark');
    return legacyTheme ? JSON.parse(legacyTheme) : false;
  } catch (error) {
    console.error('Error reading theme from localStorage:', error);
    return false;
  }
};

const applyTheme = (isDark: boolean) => {
  try {
    localStorage.setItem('toolbox_theme', isDark ? 'dark' : 'light');
  } catch (error) {
    console.error('Error saving theme to localStorage:', error);
  }
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeStore>((set) => ({
  isDark: getInitialTheme(),
  toggleTheme: () => set((state) => {
    const newTheme = !state.isDark;
    applyTheme(newTheme);
    return { isDark: newTheme };
  }),
  setTheme: (dark) => {
    const isDark = typeof dark === 'boolean' ? dark : dark === 'dark';
    applyTheme(isDark);
    set({ isDark });
  },
  
  syncEnabled: false,
  syncModules: [
    { key: 'account', name: '账号管理', enabled: true },
    { key: 'todo', name: '待办事项', enabled: true },
    { key: 'quickReply', name: '快捷回复', enabled: true },
    { key: 'clipboard', name: '云剪贴板', enabled: false },
  ],
  isSyncing: false,
  syncProgress: 0,
  lastSyncTime: null,
  pendingOperationsCount: 0,
  conflicts: [],
  storageUsed: 0,
  storageQuota: 0,
  storageLocation: 'cloud',
  
  setSyncEnabled: (enabled) => set({ syncEnabled: enabled }),
  setSyncModules: (modules) => set({ syncModules: modules }),
  toggleModuleSync: (key) => set((state) => ({
    syncModules: state.syncModules.map(m => 
      m.key === key ? { ...m, enabled: !m.enabled } : m
    )
  })),
  setIsSyncing: (syncing) => set({ isSyncing: syncing }),
  setSyncProgress: (progress) => set({ syncProgress: progress }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),
  setPendingOperationsCount: (count) => set({ pendingOperationsCount: count }),
  setConflicts: (conflicts) => set({ conflicts }),
  setStorageInfo: (used, quota) => set({ storageUsed: used, storageQuota: quota }),
  setStorageLocation: (location) => set({ storageLocation: location }),
  resetSyncState: () => set({
    syncEnabled: false,
    isSyncing: false,
    syncProgress: 0,
    lastSyncTime: null,
    pendingOperationsCount: 0,
    conflicts: [],
  }),
}));
