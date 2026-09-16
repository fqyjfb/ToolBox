import { create } from 'zustand';
import { SyncModuleKey, SyncModule, ConflictItem, StorageLocation, TableDataCount } from '../types/offline';

export interface TableSyncStatus {
  tableName: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  syncedCount: number;
}

export interface SyncSummary {
  pulledCount: number;
  addedCount: number;
  conflictCount: number;
  duration: number;
  timestamp: string;
}

interface SyncStore {
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
  syncOnStartupEnabled: boolean;
  currentSyncTable: string | null;
  tableSyncStatuses: TableSyncStatus[];
  totalSyncedCount: number;
  lastSyncSummary: SyncSummary | null;
  isOnline: boolean;
  isSwitching: boolean;
  showConflictModal: boolean;
  tableDataCounts: TableDataCount[];
  totalDataCount: number;

  setSyncEnabled: (enabled: boolean) => void;
  setSyncModules: (modules: SyncModule[]) => void;
  toggleModuleSync: (key: SyncModuleKey) => void;
  setIsSyncing: (syncing: boolean) => void;
  setSyncProgress: (progress: number) => void;
  setLastSyncTime: (time: string | null) => void;
  setPendingOperationsCount: (count: number) => void;
  setConflicts: (conflicts: ConflictItem[] | ((prev: ConflictItem[]) => ConflictItem[])) => void;
  setStorageInfo: (used: number, quota: number) => void;
  setStorageLocation: (location: StorageLocation) => void;
  setSyncOnStartupEnabled: (enabled: boolean) => void;
  setCurrentSyncTable: (tableName: string | null) => void;
  setTableSyncStatuses: (statuses: TableSyncStatus[]) => void;
  updateTableSyncStatus: (tableName: string, status: Partial<TableSyncStatus>) => void;
  setTotalSyncedCount: (count: number | ((prev: number) => number)) => void;
  setLastSyncSummary: (summary: SyncSummary | null) => void;
  setIsOnline: (online: boolean) => void;
  setIsSwitching: (switching: boolean) => void;
  setShowConflictModal: (show: boolean) => void;
  setTableDataCounts: (counts: TableDataCount[]) => void;
  setTotalDataCount: (count: number) => void;
  resetSyncState: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  syncEnabled: false,
  syncModules: [
    { key: 'account', name: '账号管理', enabled: true },
    { key: 'todo', name: '待办事项', enabled: true },
    { key: 'quickReply', name: '快捷回复', enabled: true },
    { key: 'clipboard', name: '云剪贴板', enabled: false },
    { key: 'memo', name: '备忘录', enabled: true },
  ],
  isSyncing: false,
  syncProgress: 0,
  lastSyncTime: null,
  pendingOperationsCount: 0,
  conflicts: [],
  storageUsed: 0,
  storageQuota: 0,
  storageLocation: 'cloud',
  syncOnStartupEnabled: true,
  currentSyncTable: null,
  tableSyncStatuses: [],
  totalSyncedCount: 0,
  lastSyncSummary: null,
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  isSwitching: false,
  showConflictModal: false,
  tableDataCounts: [],
  totalDataCount: 0,

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
  setConflicts: (conflicts) => set((state) => ({
    conflicts: typeof conflicts === 'function' ? conflicts(state.conflicts) : conflicts
  })),
  setStorageInfo: (used, quota) => set({ storageUsed: used, storageQuota: quota }),
  setStorageLocation: (location) => set({ storageLocation: location }),
  setSyncOnStartupEnabled: (enabled) => set({ syncOnStartupEnabled: enabled }),
  setCurrentSyncTable: (tableName) => set({ currentSyncTable: tableName }),
  setTableSyncStatuses: (statuses) => set({ tableSyncStatuses: statuses }),
  updateTableSyncStatus: (tableName, status) => set((state) => ({
    tableSyncStatuses: state.tableSyncStatuses.map(s =>
      s.tableName === tableName ? { ...s, ...status } : s
    )
  })),
  setTotalSyncedCount: (count) => set((state) => ({
    totalSyncedCount: typeof count === 'function' ? count(state.totalSyncedCount) : count
  })),
  setLastSyncSummary: (summary) => set({ lastSyncSummary: summary }),
  setIsOnline: (online) => set({ isOnline: online }),
  setIsSwitching: (switching) => set({ isSwitching: switching }),
  setShowConflictModal: (show) => set({ showConflictModal: show }),
  setTableDataCounts: (counts) => set({ tableDataCounts: counts }),
  setTotalDataCount: (count) => set({ totalDataCount: count }),
  resetSyncState: () => set({
    syncEnabled: false,
    isSyncing: false,
    syncProgress: 0,
    lastSyncTime: null,
    pendingOperationsCount: 0,
    conflicts: [],
    currentSyncTable: null,
    tableSyncStatuses: [],
    totalSyncedCount: 0,
    lastSyncSummary: null,
    showConflictModal: false,
  }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useSyncStore.getState().setIsOnline(true);
  });
  window.addEventListener('offline', () => {
    useSyncStore.getState().setIsOnline(false);
  });
}
