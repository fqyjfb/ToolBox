import { create } from 'zustand';

const STORAGE_KEY = 'sidebar-storage-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        pinnedToolIds: parsed.pinnedToolIds || [],
        recentToolIds: parsed.recentToolIds || [],
        isCollapsed: parsed.isCollapsed ?? true,
      };
    }
  } catch { /* ignore */ }
  return {};
}

function saveState(state: Partial<SidebarStore>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    pinnedToolIds: state.pinnedToolIds,
    recentToolIds: state.recentToolIds,
    isCollapsed: state.isCollapsed,
  }));
}

const initial = loadState();

interface SidebarStore {
  isCollapsed: boolean;
  isVisible: boolean;
  position: 'left' | 'right';
  pinnedToolIds: string[];
  recentToolIds: string[];

  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setVisible: (visible: boolean) => void;
  setPosition: (position: 'left' | 'right') => void;

  addPinnedTool: (toolId: string) => void;
  removePinnedTool: (toolId: string) => void;
  reorderPinnedTools: (ids: string[]) => void;

  addRecentTool: (toolId: string) => void;
  clearRecentTools: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: initial.isCollapsed ?? true,
  isVisible: true,
  position: 'left',
  pinnedToolIds: initial.pinnedToolIds || [],
  recentToolIds: initial.recentToolIds || [],

  toggleSidebar: () => set((state) => {
    const next = { isCollapsed: !state.isCollapsed };
    saveState({ ...state, ...next });
    return next;
  }),

  setCollapsed: (collapsed) => set((state) => {
    saveState({ ...state, isCollapsed: collapsed });
    return { isCollapsed: collapsed };
  }),

  setVisible: (visible) => set({ isVisible: visible }),
  setPosition: (position) => set({ position }),

  addPinnedTool: (toolId) => set((state) => {
    const next = { pinnedToolIds: [...new Set([...state.pinnedToolIds, toolId])] };
    saveState({ ...state, ...next });
    return next;
  }),

  removePinnedTool: (toolId) => set((state) => {
    const next = { pinnedToolIds: state.pinnedToolIds.filter((id) => id !== toolId) };
    saveState({ ...state, ...next });
    return next;
  }),

  reorderPinnedTools: (ids) => set((state) => {
    saveState({ ...state, pinnedToolIds: ids });
    return { pinnedToolIds: ids };
  }),

  addRecentTool: (toolId) => set((state) => {
    const filtered = state.recentToolIds.filter((id) => id !== toolId);
    const next = { recentToolIds: [toolId, ...filtered].slice(0, 10) };
    saveState({ ...state, ...next });
    return next;
  }),

  clearRecentTools: () => set((state) => {
    saveState({ ...state, recentToolIds: [] });
    return { recentToolIds: [] };
  }),
}));