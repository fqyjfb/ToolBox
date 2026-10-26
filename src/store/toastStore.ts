import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const isErrorNotificationsEnabled = (): boolean => {
  const stored = localStorageService.getString(STORAGE_KEYS.NOTIFICATION_ERRORS);
  return stored !== 'false';
};

// 递增序号：仅用 Date.now() 会在同一毫秒内连续触发时撞 id，
// 导致先到的 Toast 被后到的移除逻辑「顺手」清掉。
let toastSeq = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    if (toast.type === 'error' && !isErrorNotificationsEnabled()) {
      return;
    }

    const id = `${Date.now()}-${++toastSeq}`;

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }]
    }));

    // 定时器放在 set() 之外：updater 应保持纯函数，副作用在 action 层执行。
    // duration === 0 表示常驻，不自动移除（与原实现一致）。
    if (toast.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter(t => t.id !== id)
        }));
      }, toast.duration || 3000);
    }
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(toast => toast.id !== id)
  }))
}));