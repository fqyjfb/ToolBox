// notesRecentsStore —— 最近打开笔记列表：容量 20、按 openedAt 倒序，持久化到 NOTES_RECENTS
//（手动 setItem，不引入 persist 中间件）。同一文件去重置顶；监听 storage 事件做跨窗口合并。
// 仅维护 UI 缓存态，不与主进程交互（与 favorites 不同）；pushRecent 由组合根注入。

import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import type { NotesRecentItem } from '../pages/tools/notes/types';

const MAX_RECENTS = 20;
const STORAGE_KEY = STORAGE_KEYS.NOTES_RECENTS;

// 校验 / 清洗 localStorage 数据：必须为数组且元素含 path，其余字段缺失时填默认值
function coerce(raw: unknown): NotesRecentItem[] {
  if (!Array.isArray(raw)) return [];
  const out: NotesRecentItem[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const path = (item as { path?: unknown }).path;
    if (typeof path !== 'string' || !path) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    const nameRaw = (item as { name?: unknown }).name;
    const mtimeRaw = (item as { mtime?: unknown }).mtime;
    const openedAtRaw = (item as { openedAt?: unknown }).openedAt;
    out.push({
      path,
      name: typeof nameRaw === 'string' ? nameRaw : path.split(/[\\/]/).pop() || path,
      mtime: typeof mtimeRaw === 'number' ? mtimeRaw : 0,
      openedAt: typeof openedAtRaw === 'number' ? openedAtRaw : Date.now(),
    });
  }
  return capToMax(out);
}

// 按 openedAt 倒序后截断到 MAX_RECENTS（超出部分即最久未打开者）。
// 所有写回 / 读回路径都必须过这一刀，否则列表会无声膨胀。
function capToMax(items: NotesRecentItem[]): NotesRecentItem[] {
  const sorted = items.slice().sort((a, b) => b.openedAt - a.openedAt);
  return sorted.length > MAX_RECENTS ? sorted.slice(0, MAX_RECENTS) : sorted;
}

function persist(items: NotesRecentItem[]): void {
  localStorageService.set<NotesRecentItem[]>(STORAGE_KEY, items);
}

export interface NotesRecentsStore {
  recents: NotesRecentItem[];
  pushRecent: (file: NotesRecentItem) => void;
  removeRecent: (path: string) => void;
  clearRecents: () => void;
  /** 用外部数据（如 mount 时从 localStorage 重新读取）替换整个列表 */
  hydrate: (items: NotesRecentItem[]) => void;
}

export const useNotesRecentsStore = create<NotesRecentsStore>((set, get) => {
  // 把传入 item 合并进当前列表：去重 + 置顶 + 容量截断 + 按 openedAt 倒序
  const mergeOne = (current: NotesRecentItem[], item: NotesRecentItem): NotesRecentItem[] => {
    const filtered = current.filter((r) => r.path !== item.path);
    return capToMax([item, ...filtered]);
  };

  return {
    recents: coerce(localStorageService.get<NotesRecentItem[]>(STORAGE_KEY, [])),

    pushRecent: (file) => {
      const next = mergeOne(get().recents, file);
      set({ recents: next });
      persist(next);
    },

    removeRecent: (path) => {
      const next = get().recents.filter((r) => r.path !== path);
      set({ recents: next });
      persist(next);
    },

    clearRecents: () => {
      set({ recents: [] });
      persist([]);
    },

    hydrate: (items) => {
      const next = coerce(items);
      set({ recents: next });
      persist(next);
    },
  };
});

// 监听 storage 事件并合并其它标签 / 窗口的修改；只需在组合根 mount 时挂一次
export function bindNotesRecentsStorageSync(): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    let parsed: unknown = null;
    try {
      parsed = e.newValue ? JSON.parse(e.newValue) : null;
    } catch {
      parsed = null;
    }
    useNotesRecentsStore.getState().hydrate(Array.isArray(parsed) ? parsed : []);
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
