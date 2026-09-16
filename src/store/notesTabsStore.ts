// notesTabsStore —— 打开的笔记标签页。标签只记路径，同一时刻仍只挂载一个编辑器
//（切标签 = selectFile），故不存在「多 Vditor 实例泄漏」。容量 20，超出淘汰最久未激活者
//（LRU 时刻表仅运行时维护，不落盘）。persist 到 NOTES_TABS，恢复发生在模块初始化
//（`initial = coerce(...)`），因此没有独立 hydrate()：store 一被 import 就是恢复后的状态。
// dirtyMap 不落盘；不引入 zustand persist 中间件。

import { create } from 'zustand';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import type { NotesTabsSnapshot } from '../pages/tools/notes/types';

const MAX_TABS = 20;
const STORAGE_KEY = STORAGE_KEYS.NOTES_TABS;

// 最近激活时刻（LRU 淘汰依据；仅运行时，不进 state、不落盘）
const lastActiveAt = new Map<string, number>();

// 清洗 / 校验从 localStorage 读出的快照：去重、截断到 20、修正 activePath
function coerce(raw: unknown): NotesTabsSnapshot {
  if (!raw || typeof raw !== 'object') return { tabs: [], activePath: null };
  const obj = raw as { tabs?: unknown; activePath?: unknown };
  const list = Array.isArray(obj.tabs) ? obj.tabs : [];
  const seen = new Set<string>();
  const tabs: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string' || !item || seen.has(item)) continue;
    seen.add(item);
    tabs.push(item);
    if (tabs.length >= MAX_TABS) break;
  }
  const rawActive = typeof obj.activePath === 'string' ? obj.activePath : null;
  const activePath = rawActive && tabs.includes(rawActive) ? rawActive : (tabs[0] ?? null);
  return { tabs, activePath };
}

export interface NotesTabsStore {
  tabs: string[];
  activePath: string | null;
  /** 运行时脏态：path → 是否有未保存修改（重启不恢复） */
  dirtyMap: Record<string, boolean>;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  /** 文件重命名后同步标签路径（否则标签会指向已不存在的旧路径） */
  renameTab: (oldPath: string, newPath: string) => void;
  reorderTab: (from: number, to: number) => void;
  setDirty: (path: string, dirty: boolean) => void;
}

export const useNotesTabsStore = create<NotesTabsStore>((set, get) => {
  // 统一写入口：剪掉已关闭标签的脏态 + 落盘（dirtyMap 不写入磁盘）
  const commit = (tabs: string[], activePath: string | null): void => {
    const kept = new Set(tabs);
    const dirtyMap: Record<string, boolean> = {};
    for (const [path, dirty] of Object.entries(get().dirtyMap)) {
      if (kept.has(path)) dirtyMap[path] = dirty;
    }
    set({ tabs, activePath, dirtyMap });
    localStorageService.set<NotesTabsSnapshot>(STORAGE_KEY, { tabs, activePath });
  };

  // 超出容量时淘汰最久未激活的标签（当前激活标签永不淘汰）
  const evict = (tabs: string[], activePath: string | null): string[] => {
    if (tabs.length <= MAX_TABS) return tabs;
    let victim = -1;
    let oldest = Number.POSITIVE_INFINITY;
    tabs.forEach((path, index) => {
      if (path === activePath) return;
      const at = lastActiveAt.get(path) ?? 0;
      if (at < oldest) {
        oldest = at;
        victim = index;
      }
    });
    // 走到这里说明 tabs.length > MAX_TABS，其中最多 1 个是 activePath，
    // 故必有 ≥MAX_TABS 个非激活候选，victim 一定被赋值（无 -1 兜底分支）
    const next = tabs.slice();
    lastActiveAt.delete(next.splice(victim, 1)[0]);
    return next;
  };

  // 关掉单个标签（closeTab 与 renameTab 的冲突兜底共用）
  const closeTabLocal = (path: string): void => {
    const { tabs, activePath } = get();
    const index = tabs.indexOf(path);
    if (index === -1) return;
    lastActiveAt.delete(path);
    const rest = tabs.filter((item) => item !== path);
    const nextActive = activePath === path ? (rest[Math.min(index, rest.length - 1)] ?? null) : activePath;
    commit(rest, nextActive);
  };

  // 模块初始化即完成持久化恢复（重启后标签仍在，靠这一行）
  const initial = coerce(
    localStorageService.get<NotesTabsSnapshot>(STORAGE_KEY, { tabs: [], activePath: null })
  );
  initial.tabs.forEach((path) => lastActiveAt.set(path, Date.now()));

  return {
    ...initial,
    dirtyMap: {},

    openTab: (path) => {
      const { tabs, activePath } = get();
      lastActiveAt.set(path, Date.now());
      if (tabs.includes(path)) {
        if (activePath !== path) commit(tabs, path);
        return;
      }
      commit(evict([...tabs, path], path), path);
    },

    closeTab: closeTabLocal,

    // 重命名后把标签里的旧路径换成新路径（激活位、LRU 时刻一并迁移），只改路径不改顺序
    renameTab: (oldPath, newPath) => {
      const { tabs, activePath } = get();
      const index = tabs.indexOf(oldPath);
      if (index === -1 || newPath === oldPath) return;
      if (tabs.includes(newPath)) {
        // 极端情况：新路径已经是另一个标签（理论上被 renameItem 的「名称已存在」挡住）
        closeTabLocal(oldPath);
        return;
      }
      const next = tabs.slice();
      next[index] = newPath;
      lastActiveAt.set(newPath, lastActiveAt.get(oldPath) ?? Date.now());
      lastActiveAt.delete(oldPath);
      // 脏态跟着路径走：重命名不等于保存，否则「未保存」小圆点会凭空消失
      // （commit 会按新标签列表裁剪 dirtyMap，故必须**先**迁移再 commit）
      const dirty = get().dirtyMap;
      if (dirty[oldPath]) {
        const nextDirty = { ...dirty };
        delete nextDirty[oldPath];
        nextDirty[newPath] = true;
        set({ dirtyMap: nextDirty });
      }
      commit(next, activePath === oldPath ? newPath : activePath);
    },

    reorderTab: (from, to) => {
      const { tabs, activePath } = get();
      if (from === to || from < 0 || to < 0 || from >= tabs.length || to >= tabs.length) return;
      const next = tabs.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      commit(next, activePath);
    },

    setDirty: (path, dirty) => {
      const current = get().dirtyMap;
      // 同值短路：不产生新对象，订阅者（标签条）就不会无谓重渲染
      if (!!current[path] === dirty) return;
      set({ dirtyMap: { ...current, [path]: dirty } });
    },
  };
});
