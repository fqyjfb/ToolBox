// notesTagStore —— 标签反向索引的会话内缓存（不落 localStorage：避免与主进程持久化双向不一致）。
// 持久化主体在主进程（front matter + notes_settings.json.tag_overrides）；store 只缓存
// tag → filePaths[] 反向索引与已知标签集，由 loadAllTags() 一次性拉取（不在 mount 自动调），
// 文件写入 / 删除后走 mergeTagsForFile / removeFile 局部更新。不混入 zustand persist 中间件。

import { create } from 'zustand';
import type { NotesTagIndex, NotesTagInfo } from '../pages/tools/notes/types';

interface NotesTagState {
  /** tag → filePaths[] 反向索引 */
  index: NotesTagIndex;
  /** 已知标签集（按字母序） */
  knownTags: NotesTagInfo[];
  /** 是否正在拉取（防止并发 loadAllTags 竞争） */
  loading: boolean;
  /** 当前过滤的 tag（null 表示不过滤）；放在 store 以便多组件共享 */
  tagFilter: string | null;

  /** 全量替换反向索引（loadAllTags 后用） */
  setIndex: (idx: NotesTagIndex, tags?: NotesTagInfo[]) => void;
  /** 仅替换 knownTags（外部已知索引但 knownTags 单独更新场景） */
  setKnownTags: (tags: NotesTagInfo[]) => void;
  // 局部更新某文件的标签：先从所有 tag 移除该 path，再把新 tags 加入
  mergeTagsForFile: (path: string, tags: string[]) => void;
  // 文件被删除 / 移动后清理反向索引中的引用，并同步 knownTags 计数
  removeFile: (path: string) => void;
  // 文件重命名 / 移动后迁移反向索引（path 变了但 tags 不变）
  renameFile: (oldPath: string, newPath: string, tags?: string[]) => void;
  /** 设置 / 清除当前过滤 tag（直接读写 store） */
  setTagFilter: (tag: string | null) => void;
  /** 清空整个缓存（rootPath 切换、退出登录等场景） */
  clear: () => void;
}

// 从反向索引移除 path 在所有 tag 中的出现（内部使用，避免外部组件手写循环）
function purgePathFromIndex(index: NotesTagIndex, path: string): NotesTagIndex {
  let changed = false;
  const next: NotesTagIndex = {};
  for (const tag of Object.keys(index)) {
    const arr = index[tag].filter((p) => p !== path);
    if (arr.length !== index[tag].length) changed = true;
    if (arr.length > 0) next[tag] = arr;
  }
  return changed ? next : index;
}

// 从反向索引重建 knownTags（带 count + paths），按 tag 名字母序
function buildKnownTags(index: NotesTagIndex): NotesTagInfo[] {
  return Object.keys(index)
    .sort((a, b) => a.localeCompare(b))
    .map((tag) => ({ tag, count: index[tag].length, paths: index[tag] }));
}

export const useNotesTagStore = create<NotesTagState>((set) => ({
  index: {},
  knownTags: [],
  loading: false,
  tagFilter: null,

  setIndex: (idx, tags) => {
    if (tags) {
      set({ index: idx, knownTags: tags });
    } else {
      set({ index: idx, knownTags: buildKnownTags(idx) });
    }
  },

  setKnownTags: (tags) => set({ knownTags: tags }),

  mergeTagsForFile: (path, tags) =>
    set((state) => {
      const cleaned = purgePathFromIndex(state.index, path);
      const next: NotesTagIndex = { ...cleaned };
      for (const tag of tags) {
        if (!next[tag]) next[tag] = [];
        if (!next[tag].includes(path)) next[tag].push(path);
      }
      return { index: next, knownTags: buildKnownTags(next) };
    }),

  removeFile: (path) =>
    set((state) => {
      const next = purgePathFromIndex(state.index, path);
      return next === state.index
        ? state
        : { index: next, knownTags: buildKnownTags(next) };
    }),

  renameFile: (oldPath, newPath, tags) =>
    set((state) => {
      const cleaned = purgePathFromIndex(state.index, oldPath);
      const next: NotesTagIndex = { ...cleaned };
      const effectiveTags = tags ?? nextTagsForPath(state.index, oldPath);
      for (const tag of effectiveTags) {
        if (!next[tag]) next[tag] = [];
        if (!next[tag].includes(newPath)) next[tag].push(newPath);
      }
      return { index: next, knownTags: buildKnownTags(next) };
    }),

  setTagFilter: (tag) => {
    if (tag === null) {
      set({ tagFilter: null });
      return;
    }
    set({ tagFilter: tag });
  },

  clear: () => set({ index: {}, knownTags: [], loading: false, tagFilter: null }),
}));

// 查找某 path 当前的标签集合（O(n)）：仅作 renameFile 未传 tags 时的兜底，调用频率低故不缓存
function nextTagsForPath(index: NotesTagIndex, path: string): string[] {
  const out: string[] = [];
  for (const tag of Object.keys(index)) {
    if (index[tag].includes(path)) out.push(tag);
  }
  return out;
}
