// useNotesDrafts —— 防抖草稿写入：1s 防抖落盘 / 立即 flush / 保存后清理；只与主进程草稿服务打交道。

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { logError } from '../../../../services/loggerService';
import { DRAFT_DEBOUNCE_MS, DRAFT_MAX_WAIT_MS } from '../constants/limits';

export interface UseNotesDraftsReturn {
  scheduleDraft: (path: string, content: string) => void;
  flushNow: (path: string, content?: string) => Promise<boolean>;
  deleteDraftNow: (path: string) => Promise<boolean>;
}

export function useNotesDrafts(): UseNotesDraftsReturn {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingContentRef = useRef<Map<string, string>>(new Map());
  // 首次变脏时刻：用于"最长等待"，否则连续输入会把防抖无限重置、草稿永远写不出来
  const pendingSinceRef = useRef<Map<string, number>>(new Map());
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
    pendingSinceRef.current.delete(path);
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
          pendingSinceRef.current.delete(path);
          return true;
        }
        return false;
      } catch (err) {
        logError('立即写入草稿失败', 'useNotesDrafts', err as Error);
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

      const now = Date.now();
      if (!pendingSinceRef.current.has(path)) pendingSinceRef.current.set(path, now);
      const elapsed = now - (pendingSinceRef.current.get(path) ?? now);
      // 防抖 + 最长等待：连续输入 10s 也必须落一次草稿
      const delay = Math.max(0, Math.min(DRAFT_DEBOUNCE_MS, DRAFT_MAX_WAIT_MS - elapsed));

      const existing = timersRef.current.get(path);
      if (existing) clearTimeout(existing);
      const handle = setTimeout(() => {
        timersRef.current.delete(path);
        if (flushingRef.current.has(path)) return;
        // 取"此刻"的内容而非排期时的内容：最长等待触发时排期内容可能已过期
        const body = pendingContentRef.current.get(path);
        if (body === undefined) return;
        window.electron?.notes
          ?.writeDraft?.(path, body)
          .then((result) => {
            if (result && result.success) {
              if (pendingContentRef.current.get(path) === body) {
                pendingContentRef.current.delete(path);
                pendingSinceRef.current.delete(path);
              }
            }
          })
          .catch((err) => {
            logError('写入草稿失败', 'useNotesDrafts', err as Error);
          });
      }, delay);
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

  // identity 必须稳定：NotesEditor 的自动保存 effect 依赖整个对象，
  // 每次渲染返回新字面量会让 2s 定时器被无限重排，自动保存时机不可预期。
  return useMemo(
    () => ({ scheduleDraft, flushNow, deleteDraftNow }),
    [scheduleDraft, flushNow, deleteDraftNow]
  );
}