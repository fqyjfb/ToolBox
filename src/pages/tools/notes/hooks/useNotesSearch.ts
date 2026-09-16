// useNotesSearch —— 全文搜索交互：query/results/open/loading 状态 + 200ms 防抖搜索 + 命中跳转事件。

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  FileTreeNode,
  NotesFileType,
  NotesSearchResultItem,
} from '../types';
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_DEFAULT_MAX_RESULTS,
  SEARCH_MAX_FILE_BYTES,
} from '../constants/limits';

export interface SearchMatchRef {
  line: number;
  snippet: string;
}

export interface UseNotesSearchReturn {
  query: string;
  results: NotesSearchResultItem[];
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  scanned: number;
  elapsedMs: number;
  truncated: boolean;

  setQuery: (q: string) => void;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  search: (
    rootPath: string | null,
    options?: {
      fileTypes?: NotesFileType[];
      maxResults?: number;
      caseSensitive?: boolean;
      maxFileBytes?: number;
    }
  ) => Promise<void>;
  clearResults: () => void;
  navigateToMatch: (
    file: FileTreeNode | NotesSearchResultItem,
    match: SearchMatchRef
  ) => Promise<void>;
  bindSelectFile: (selectFile: (file: FileTreeNode) => Promise<void>) => void;
}

// NotesEditor 监听该事件做跳行，detail = { path, line, snippet }
export const NOTES_NAVIGATE_EVENT = 'notes:navigate-to-match';

export interface NavigateToMatchDetail {
  path: string;
  line: number;
  snippet: string;
}

export function useNotesSearch(): UseNotesSearchReturn {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<NotesSearchResultItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [truncated, setTruncated] = useState(false);

  const requestTokenRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // query 的同步镜像：调用方习惯「setQuery(q) 后立刻 search()」，读闭包 query 会慢一拍，故 search 一律读 ref。
  const queryRef = useRef('');
  const selectFileRef = useRef<((file: FileTreeNode) => Promise<void>) | null>(
    null
  );

  const openPalette = useCallback(() => setIsOpen(true), []);
  const closePalette = useCallback(() => setIsOpen(false), []);
  const togglePalette = useCallback(() => setIsOpen((v) => !v), []);

  // 卸载时清 timer 和结果，但不改 isOpen（关闭面板会闪烁）。
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      setResults([]);
      setError(null);
    };
  }, []);

  const setQuery = useCallback((q: string) => {
    queryRef.current = q;
    setQueryState(q);
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
    setScanned(0);
    setElapsedMs(0);
    setTruncated(false);
  }, []);

  const runSearchNow = useCallback(
    async (
      rootPath: string,
      options: {
        fileTypes?: NotesFileType[];
        maxResults?: number;
        caseSensitive?: boolean;
        maxFileBytes?: number;
      },
      q: string
    ) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setError(null);
        setLoading(false);
        setScanned(0);
        setElapsedMs(0);
        setTruncated(false);
        return;
      }
      if (!window.electron?.notes?.searchNotes) {
        setError('搜索功能不可用（preload 未注入 searchNotes）');
        setLoading(false);
        return;
      }
      const myToken = ++requestTokenRef.current;
      setLoading(true);
      setError(null);
      try {
        const res = await window.electron.notes.searchNotes({
          rootPath,
          query: trimmed,
          fileTypes: options.fileTypes,
          maxResults: options.maxResults ?? SEARCH_DEFAULT_MAX_RESULTS,
          caseSensitive: options.caseSensitive,
          maxFileBytes: options.maxFileBytes ?? SEARCH_MAX_FILE_BYTES,
        });
        if (myToken !== requestTokenRef.current) return;
        if (!res || res.success === false) {
          setError(res?.error || '搜索失败');
          setResults([]);
          setScanned(res?.scanned ?? 0);
          setElapsedMs(res?.elapsedMs ?? 0);
          setTruncated(false);
        } else {
          setResults(Array.isArray(res.results) ? res.results : []);
          setScanned(res.scanned ?? 0);
          setElapsedMs(res.elapsedMs ?? 0);
          setTruncated(!!res.truncated);
          setError(null);
        }
      } catch (err) {
        if (myToken !== requestTokenRef.current) return;
        setError(err instanceof Error ? err.message : '搜索失败');
        setResults([]);
      } finally {
        if (myToken === requestTokenRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  const search = useCallback(
    async (
      rootPath: string | null,
      options?: {
        fileTypes?: NotesFileType[];
        maxResults?: number;
        caseSensitive?: boolean;
        maxFileBytes?: number;
      }
    ) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const opts = options || {};
      const trimmed = queryRef.current.trim();
      if (!trimmed || !rootPath) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runSearchNow(rootPath, opts, trimmed);
      }, SEARCH_DEBOUNCE_MS);
    },
    [runSearchNow]
  );

  const bindSelectFile = useCallback(
    (selectFile: (file: FileTreeNode) => Promise<void>) => {
      selectFileRef.current = selectFile;
    },
    []
  );

  const navigateToMatch = useCallback(
    async (
      file: FileTreeNode | NotesSearchResultItem,
      match: SearchMatchRef
    ) => {
      setIsOpen(false);

      const node: FileTreeNode =
        'fileType' in file || 'name' in file
          ? ({
              id: (file as NotesSearchResultItem).path,
              name: (file as NotesSearchResultItem).name,
              type: 'file',
              path: (file as NotesSearchResultItem).path,
              fileType: (file as NotesSearchResultItem).fileType,
            } as FileTreeNode)
          : (file as FileTreeNode);

      if (selectFileRef.current) {
        try {
          await selectFileRef.current(node);
        } catch (err) {
          console.warn('[useNotesSearch] selectFile failed:', err);
        }
      } else {
        console.warn(
          '[useNotesSearch] selectFile 未注入，跳过文件选中，仅派发跳转事件'
        );
      }

      if (typeof window !== 'undefined') {
        const detail: NavigateToMatchDetail = {
          path: node.path,
          line: match.line,
          snippet: match.snippet,
        };
        window.dispatchEvent(
          new CustomEvent<NavigateToMatchDetail>(NOTES_NAVIGATE_EVENT, {
            detail,
          })
        );
      }
    },
    []
  );

  return {
    query,
    results,
    isOpen,
    loading,
    error,
    scanned,
    elapsedMs,
    truncated,
    setQuery,
    openPalette,
    closePalette,
    togglePalette,
    search,
    clearResults,
    navigateToMatch,
    bindSelectFile,
  };
}
