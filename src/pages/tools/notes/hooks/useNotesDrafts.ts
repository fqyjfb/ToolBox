// useNotesDrafts —— 防抖草稿写入：1s 防抖落盘 / 立即 flush / 保存后清理；只与主进程草稿服务打交道。

import { useCallback, useEffect, useRef } from 'react';
import { DRAFT_DEBOUNCE_MS } from '../constants/limits';

export interface UseNotesDraftsReturn {
  scheduleDraft: (path: string, content: string) => void;
  flushNow: (path: string, content?: string) => Promise<boolean>;
  deleteDraftNow: (path: string) => Promise<boolean>;
}

export function useNotesDrafts(): UseNotesDraftsReturn {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingContentRef = useRef<Map<string, string>>(new Map());
  const flushingRef = useRef<Set<string>>(new Set());

  // 卸载兜底：把所有待触发的写 flush 一次。
  useEffect(() => {
    const timers = timersRef.current;
    const pendingContent = pendingContentRef.current;
    const flushing = flushingRef.current;
    return () => {
      timers.forEach((handle, path) => {
        clearTimeout(handle);
        const content = pendingContent.get(path);
        if (content !== undefined) {
          try {
            window.electron?.notes.writeDraft(path, content);
          } catch {
            /* ignore — page is unloading */
          }
        }
      });
      timers.clear();
      pendingContent.clear();
      flushing.clear();
    };
  }, []);

  const cancelDraft = useCallback((path: string) => {
    const handle = timersRef.current.get(path);
    if (handle) {
      clearTimeout(handle);
      timersRef.current.delete(path);
    }
    pendingContentRef.current.delete(path);
  }, []);

  const flushNow = useCallback(
    async (path: string, content?: string): Promise<boolean> => {
      if (!window.electron?.notes?.writeDraft) return false;
      const handle = timersRef.current.get(path);
      if (handle) {
        clearTimeout(handle);
        timersRef.current.delete(path);
      }
      const body = content !== undefined ? content : pendingContentRef.current.get(path);
      if (body === undefined) return false;
      flushingRef.current.add(path);
      try {
        const result = await window.electron.notes.writeDraft(path, body);
        if (result && result.success) {
          pendingContentRef.current.delete(path);
          return true;
        }
        return false;
      } catch (err) {
        console.warn('[useNotesDrafts] flushNow failed:', err);
        return false;
      } finally {
        flushingRef.current.delete(path);
      }
    },
    []
  );

  const scheduleDraft = useCallback(
    (path: string, content: string) => {
      if (!path) return;
      pendingContentRef.current.set(path, content);
      const existing = timersRef.current.get(path);
      if (existing) clearTimeout(existing);
      const handle = setTimeout(() => {
        timersRef.current.delete(path);
        if (flushingRef.current.has(path)) return;
        window.electron?.notes
          ?.writeDraft?.(path, content)
          .then((result) => {
            if (result && result.success) {
              if (pendingContentRef.current.get(path) === content) {
                pendingContentRef.current.delete(path);
              }
            }
          })
          .catch((err) => {
            console.warn('[useNotesDrafts] scheduleDraft write failed:', err);
          });
      }, DRAFT_DEBOUNCE_MS);
      timersRef.current.set(path, handle);
    },
    []
  );

  const deleteDraftNow = useCallback(
    async (path: string): Promise<boolean> => {
      cancelDraft(path);
      try {
        const result = await window.electron?.notes?.deleteDraft?.(path);
        return !!(result && result.success);
      } catch {
        return false;
      }
    },
    [cancelDraft]
  );

  return {
    scheduleDraft,
    flushNow,
    deleteDraftNow,
  };
}