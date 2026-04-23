import { create } from 'zustand';

interface SidebarStore {
  isCollapsed: boolean;
  isVisible: boolean;
  position: 'left' | 'right';
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setVisible: (visible: boolean) => void;
  setPosition: (position: 'left' | 'right') => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: false,
  isVisible: true,
  position: 'left',
  toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
  setVisible: (visible) => set({ isVisible: visible }),
  setPosition: (position) => set({ position: position }),
}));
