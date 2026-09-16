import { create } from 'zustand';
import { offlineStorage } from '../services/offlineStorage';

export interface StorageStats {
  websites: number;
  shops: number;
  social: number;
  emails: number;
  phones: number;
  companies: number;
  credentials: number;
  generalAccounts: number;
  todo: number;
  quickReply: number;
  clipboard: number;
  total: number;
}

interface StorageStore {
  storageUsed: number;
  storageQuota: number;
  isLoading: boolean;
  stats: StorageStats;
  isStatsLoading: boolean;
  setStorageInfo: (used: number, quota: number) => void;
  refreshStorageInfo: () => Promise<void>;
  refreshStorageStats: (userId: string) => Promise<void>;
}

export const useStorageStore = create<StorageStore>((set) => ({
  storageUsed: 0,
  storageQuota: 0,
  isLoading: false,
  stats: {
    websites: 0,
    shops: 0,
    social: 0,
    emails: 0,
    phones: 0,
    companies: 0,
    credentials: 0,
    generalAccounts: 0,
    todo: 0,
    quickReply: 0,
    clipboard: 0,
    total: 0,
  },
  isStatsLoading: false,

  setStorageInfo: (used, quota) => set({ storageUsed: used, storageQuota: quota }),

  refreshStorageInfo: async () => {
    set({ isLoading: true });
    try {
      const info = await offlineStorage.getStorageSize();
      set({ storageUsed: info.used, storageQuota: info.quota });
    } catch (error) {
      console.error('Failed to refresh storage info:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshStorageStats: async (userId: string) => {
    set({ isStatsLoading: true });
    try {
      const stats = await offlineStorage.getStorageStats(userId);
      set({ stats });
    } catch (error) {
      console.error('Failed to refresh storage stats:', error);
      set({
        stats: {
          websites: 0,
          shops: 0,
          social: 0,
          emails: 0,
          phones: 0,
          companies: 0,
          credentials: 0,
          generalAccounts: 0,
          todo: 0,
          quickReply: 0,
          clipboard: 0,
          total: 0,
        },
      });
    } finally {
      set({ isStatsLoading: false });
    }
  },
}));