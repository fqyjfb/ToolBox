// useNotesTags —— 标签读写 + 过滤；渲染层只缓存已知标签集与反向索引，持久化在主进程。

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FileTreeNode } from '../types';
import { useNotesTagStore } from '@/store/notesTagStore';

// 标签被重命名/删除后广播，避免其他实例（如 TagPicker）把旧标签又写回去。
export const NOTES_TAGS_CHANGED_EVENT = 'notes:tags-changed';

export interface UseNotesTagsReturn {
  tags: string[];
  source: 'frontmatter' | 'override' | 'none';
  index: Record<string, string[]>;
  knownTags: Array<{ tag: string; count: number; paths: string[] }>;
  tagFilter: string | null;
  loading: boolean;

  loadFileTags: (absolutePath: string) => Promise<{ tags: string[]; source: 'frontmatter' | 'override' | 'none' }>;
  setFileTags: (absolutePath: string, tags: string[]) => Promise<{ success: boolean; tags: string[]; mode?: 'frontmatter' | 'override'; error?: string }>;
  loadAllTags: (rootPath: string) => Promise<{ success: boolean; error?: string }>;
  setTagFilter: (tag: string | null) => void;
  filterTreeByTag: (tree: FileTreeNode[], tag: string | null) => FileTreeNode[];
  resetFileTags: () => void;
  renameTag: (rootPath: string, oldTag: string, newTag: string) => Promise<{ success: boolean; error?: string }>;
  deleteTag: (rootPath: string, tag: string) => Promise<{ success: boolean; error?: string }>;
}

type TagSource = 'frontmatter' | 'override' | 'none';

const EMPTY_SOURCE: TagSource = 'none';

export function useNotesTags(): UseNotesTagsReturn {
  const storeIndex = useNotesTagStore((s) => s.index);
  const storeKnownTags = useNotesTagStore((s) => s.knownTags);
  const storeLoading = useNotesTagStore((s) => s.loading);
  const storeTagFilter = useNotesTagStore((s) => s.tagFilter);
  const setStoreIndex = useNotesTagStore((s) => s.setIndex);
  const mergeTagsForFile = useNotesTagStore((s) => s.mergeTagsForFile);
  const setStoreTagFilter = useNotesTagStore((s) => s.setTagFilter);

  const [tags, setTags] = useState<string[]>([]);
  const [source, setSource] = useState<TagSource>(EMPTY_SOURCE);
  const [loading, setLoading] = useState(false);
  // 本实例最近一次读/写过的文件：标签被别处改名/删除时据此重新拉取
  const currentPathRef = useRef<string | null>(null);

  const loadFileTags = useCallback(async (absolutePath: string) => {
    if (!absolutePath || typeof absolutePath !== 'string') {
      return { tags: [], source: EMPTY_SOURCE };
    }
    currentPathRef.current = absolutePath;
    try {
      const res = await window.electron?.notes?.getFileTags?.(absolutePath);
      if (res && res.success) {
        const next = Array.isArray(res.tags) ? res.tags : [];
        const src = (res.source as TagSource) || EMPTY_SOURCE;
        setTags(next); setSource(src);
        return { tags: next, source: src };
      }
    } catch { /* ignore */ }
    setTags([]); setSource(EMPTY_SOURCE);
    return { tags: [], source: EMPTY_SOURCE };
  }, []);

  const setFileTags = useCallback(
    async (absolutePath: string, newTags: string[]) => {
      if (!absolutePath || typeof absolutePath !== 'string') {
        return { success: false, tags: [], error: '无效的文件路径' };
      }
      const tagArr = Array.isArray(newTags) ? newTags : [];
      setLoading(true);
      currentPathRef.current = absolutePath;
      try {
        const res = await window.electron?.notes?.setFileTags?.(absolutePath, tagArr);
        if (res && res.success) {
          const written = Array.isArray(res.tags) ? res.tags : tagArr;
          setTags(written);
          setSource(written.length > 0 ? (res.mode || 'frontmatter') : EMPTY_SOURCE);
          mergeTagsForFile(absolutePath, written);
          return { success: true, tags: written, mode: res.mode };
        }
        return { success: false, tags: tagArr, error: res?.error || '写入失败' };
      } catch (err) {
        return { success: false, tags: tagArr, error: err instanceof Error ? err.message : '写入失败' };
      } finally {
        setLoading(false);
      }
    },
    [mergeTagsForFile]
  );

  const loadAllTags = useCallback(
    async (rootPath: string) => {
      if (!rootPath || typeof rootPath !== 'string') return { success: false, error: '未提供 rootPath' };
      setLoading(true);
      try {
        const res = await window.electron?.notes?.getAllTags?.(rootPath);
        if (res && res.success) {
          const list = Array.isArray(res.tags) ? res.tags : [];
          const idx: Record<string, string[]> = {};
          for (const item of list) {
            if (!item || typeof item.tag !== 'string') continue;
            idx[item.tag] = Array.isArray(item.paths) ? item.paths : [];
          }
          setStoreIndex(idx, list);
          return { success: true };
        }
        return { success: false, error: res?.error || '扫描失败' };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : '扫描失败' };
      } finally {
        setLoading(false);
      }
    },
    [setStoreIndex]
  );

  const resetFileTags = useCallback(() => { setTags([]); setSource(EMPTY_SOURCE); }, []);

  // 重命名/删除标签的公共骨架：读索引 → 逐文件 read/改/write → 重建索引。串行即可。
  const applyTagChange = useCallback(
    async (rootPath: string, tag: string, mapTags: (tags: string[]) => string[]) => {
      const paths = storeIndex[tag] ?? [];
      const selfPath = currentPathRef.current;
      for (const filePath of paths) {
        const cur = await loadFileTags(filePath);
        if (!cur.tags.includes(tag)) continue;
        await setFileTags(filePath, mapTags(cur.tags));
      }
      // loadFileTags 会改写 currentPathRef，复位为本实例的文件以免广播时无谓刷新
      currentPathRef.current = selfPath;
      if (storeTagFilter === tag) setStoreTagFilter(null);
      await loadAllTags(rootPath);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NOTES_TAGS_CHANGED_EVENT));
      }
    },
    [storeIndex, loadFileTags, setFileTags, loadAllTags, storeTagFilter, setStoreTagFilter]
  );

  const renameTag = useCallback(
    async (rootPath: string, oldTag: string, newTagInput: string) => {
      const next = newTagInput.trim();
      if (!next) return { success: false, error: '标签名不能为空' };
      if (next === oldTag) return { success: false, error: '标签名未变化' };
      const followFilter = storeTagFilter === oldTag;
      await applyTagChange(rootPath, oldTag, (list) =>
        Array.from(new Set(list.map((t) => (t === oldTag ? next : t))))
      );
      if (followFilter) setStoreTagFilter(next);
      return { success: true };
    },
    [applyTagChange, storeTagFilter, setStoreTagFilter]
  );

  const deleteTag = useCallback(
    async (rootPath: string, tag: string) => {
      await applyTagChange(rootPath, tag, (list) => list.filter((t) => t !== tag));
      return { success: true };
    },
    [applyTagChange]
  );

  // 其他实例改了标签 → 重新拉当前文件，避免 chip 停在旧值后又写回。
  useEffect(() => {
    const onTagsChanged = () => {
      if (currentPathRef.current) void loadFileTags(currentPathRef.current);
    };
    window.addEventListener(NOTES_TAGS_CHANGED_EVENT, onTagsChanged);
    return () => window.removeEventListener(NOTES_TAGS_CHANGED_EVENT, onTagsChanged);
  }, [loadFileTags]);

  // 按 tag 过滤文件树：保留命中文件 + 其所有祖先目录。
  const filterTreeByTag = useCallback(
    (tree: FileTreeNode[], tag: string | null): FileTreeNode[] => {
      if (!tag) return tree;
      const targetPaths = storeIndex[tag];
      if (!Array.isArray(targetPaths) || targetPaths.length === 0) return [];
      const pathSet = new Set(targetPaths);
      const walk = (node: FileTreeNode): FileTreeNode | null => {
        if (node.type === 'file') return pathSet.has(node.path) ? node : null;
        const children = (node.children || [])
          .map(walk)
          .filter((c): c is FileTreeNode => c !== null);
        if (children.length === 0) return null;
        return { ...node, children };
      };
      const out: FileTreeNode[] = [];
      for (const root of tree) {
        const kept = walk(root);
        if (kept) out.push(kept);
      }
      return out;
    },
    [storeIndex]
  );

  // tagFilter 引用了不存在的 tag 时自动清空（防御性，避免旧状态卡住 UI）
  useEffect(() => {
    if (storeTagFilter && !storeIndex[storeTagFilter]) setStoreTagFilter(null);
  }, [storeTagFilter, storeIndex, setStoreTagFilter]);

  return {
    tags,
    source,
    index: storeIndex,
    knownTags: storeKnownTags,
    tagFilter: storeTagFilter,
    loading: loading || storeLoading,
    loadFileTags,
    setFileTags,
    loadAllTags,
    setTagFilter: setStoreTagFilter,
    filterTreeByTag,
    resetFileTags,
    renameTag,
    deleteTag,
  };
}