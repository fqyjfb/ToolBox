import { create } from 'zustand';

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
  try {
    const stored = localStorage.getItem('toolbox_notification_errors');
    return stored !== 'false';
  } catch {
    return true;
  }
};

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    if (toast.type === 'error' && !isErrorNotificationsEnabled()) {
      return;
    }

    const id = Date.now().toString();
    
    set((state) => {
      const newToast = { ...toast, id };
      
      if (toast.duration !== 0) {
        setTimeout(() => {
          set((state) => ({
            toasts: state.toasts.filter(t => t.id !== id)
          }));
        }, toast.duration || 3000);
      }
      
      return {
        toasts: [...state.toasts, newToast]
      };
    });
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter(toast => toast.id !== id)
  }))
}));