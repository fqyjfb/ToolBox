// notesSidebarSectionsStore —— 侧边栏 4 个分组标题的折叠态（持久化到 NOTES_SIDEBAR_SECTIONS）。
// 默认：最近 / 对话整理折叠，固定目录 / 收藏展开。只提供 toggle（调用点都是「点标题切换」）。
// 不含文件树各目录节点的展开态——那是 useNotesTree 的 expandedFolders（切根目录即清空）。

import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

// 侧边栏可折叠分组
export type SidebarSectionKey = 'organize' | 'pinned' | 'favorites' | 'recents';

export type SidebarSectionsState = Record<SidebarSectionKey, boolean>;

const DEFAULTS: SidebarSectionsState = {
  organize: false,
  pinned: true,
  favorites: true,
  recents: false,
};

const SECTION_KEYS = Object.keys(DEFAULTS) as SidebarSectionKey[];
const STORAGE_KEY = STORAGE_KEYS.NOTES_SIDEBAR_SECTIONS;

// 清洗 localStorage 数据：只认 boolean，其余回落默认值（兼容旧值 / 手写脏数据）
function coerce(raw: unknown): SidebarSectionsState {
  const out: SidebarSectionsState = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const key of SECTION_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

function persist(next: SidebarSectionsState): void {
  localStorageService.set<SidebarSectionsState>(STORAGE_KEY, next);
}

export interface NotesSidebarSectionsStore {
  sections: SidebarSectionsState;
  toggleSection: (key: SidebarSectionKey) => void;
}

export const useNotesSidebarSectionsStore = create<NotesSidebarSectionsStore>((set, get) => ({
  sections: coerce(localStorageService.get<SidebarSectionsState>(STORAGE_KEY, DEFAULTS)),

  toggleSection: (key) => {
    const next: SidebarSectionsState = { ...get().sections, [key]: !get().sections[key] };
    set({ sections: next });
    persist(next);
  },
}));
