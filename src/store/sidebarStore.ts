import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

type PersistedState = {
  pinnedToolIds: string[];
  isCollapsed: boolean;
};

const DEFAULTS: PersistedState = {
  pinnedToolIds: [],
  isCollapsed: true,
};

// 清洗 localStorage 数据：字段类型不对就回落默认值（兼容旧值与手写脏数据）。
// 读写一律走 localStorageService 的泛型 get/set —— 它已封装序列化与异常，
// 不再手写 JSON.parse / JSON.stringify + try-catch。
function coerce(raw: unknown): PersistedState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const parsed = raw as Record<string, unknown>;
  return {
    pinnedToolIds: Array.isArray(parsed.pinnedToolIds) ? (parsed.pinnedToolIds as string[]) : DEFAULTS.pinnedToolIds,
    isCollapsed: typeof parsed.isCollapsed === 'boolean' ? parsed.isCollapsed : DEFAULTS.isCollapsed,
  };
}

function persist(next: PersistedState): void {
  localStorageService.set<PersistedState>(STORAGE_KEYS.SIDEBAR, next);
}

const initial = coerce(localStorageService.get<unknown>(STORAGE_KEYS.SIDEBAR, null));

interface SidebarStore {
  isCollapsed: boolean;
  isVisible: boolean;
  position: 'left' | 'right';
  pinnedToolIds: string[];

  toggleSidebar: () => void;
  setVisible: (visible: boolean) => void;
  setPosition: (position: 'left' | 'right') => void;

  addPinnedTool: (toolId: string) => void;
  removePinnedTool: (toolId: string) => void;
  reorderPinnedTools: (ids: string[]) => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isCollapsed: initial.isCollapsed,
  isVisible: true,
  position: 'left',
  pinnedToolIds: initial.pinnedToolIds,

  toggleSidebar: () => set((state) => {
    const isCollapsed = !state.isCollapsed;
    persist({ pinnedToolIds: state.pinnedToolIds, isCollapsed });
    return { isCollapsed };
  }),

  setVisible: (visible) => set({ isVisible: visible }),
  setPosition: (position) => set({ position }),

  addPinnedTool: (toolId) => set((state) => {
    const pinnedToolIds = [...new Set([...state.pinnedToolIds, toolId])];
    persist({ pinnedToolIds, isCollapsed: state.isCollapsed });
    return { pinnedToolIds };
  }),

  removePinnedTool: (toolId) => set((state) => {
    const pinnedToolIds = state.pinnedToolIds.filter((id) => id !== toolId);
    persist({ pinnedToolIds, isCollapsed: state.isCollapsed });
    return { pinnedToolIds };
  }),

  reorderPinnedTools: (ids) => set((state) => {
    persist({ pinnedToolIds: ids, isCollapsed: state.isCollapsed });
    return { pinnedToolIds: ids };
  }),
}));
