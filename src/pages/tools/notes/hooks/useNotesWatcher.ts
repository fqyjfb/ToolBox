// useNotesWatcher —— 外部文件变更监听 + 编辑冲突裁决：rootPath 变化时单实例重订阅，卸载时 stop。

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotesTabsStore } from '../../../../store/notesTabsStore';
import { isSelfWriteEcho } from '../utils/selfWriteTracker';
import type { FileTreeNode, NotesFsChangeEvent } from '../types';

const AGGREGATE_WINDOW_MS = 300;

export interface PendingExternalChange {
  path: string;
  name: string;
}

export interface UseNotesWatcherDeps {
  rootPath: string | null;
  hasRootPath: boolean;
  onExternalChange: (event: NotesFsChangeEvent) => void;
  selectedFile: FileTreeNode | null;
  fileContent: string;
  /** 派生脏态（内容与磁盘基线是否一致）：不再依赖界面的 dirtyMap，避免脏点被清后冲突静默 */
  isDirty: boolean;
  /** 采纳外部内容：同时推进内容与基线 */
  applyExternalContent: (path: string, content: string) => void;
  saveFile: (content: string, path?: string) => Promise<boolean>;
  /** 保存成功后清理该文件的草稿（草稿是兜底，文件已是最新就没必要留） */
  deleteDraft?: (path: string) => Promise<boolean>;
}

export interface UseNotesWatcherReturn {
  pendingExternalChange: PendingExternalChange | null;
  resolveExternalChange: (action: 'keep-mine' | 'take-external') => Promise<void>;
  dismiss: () => void;
}

interface AggregateBuffer {
  timer: number | null;
  changedPaths: Set<string>;
  lastEvent: NotesFsChangeEvent | null;
}

export function useNotesWatcher(deps: UseNotesWatcherDeps): UseNotesWatcherReturn {
  const { rootPath, hasRootPath, selectedFile } = deps;

  // 入参快照：回调 / selectedFile 的 identity 变化不允许触发订阅 effect 重跑，统一同步到 ref。
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  const [pending, setPending] = useState<PendingExternalChange | null>(null);
  const pendingRef = useRef<PendingExternalChange | null>(null);
  const applyPending = useCallback((next: PendingExternalChange | null): void => {
    pendingRef.current = next;
    setPending(next);
  }, []);
  const aggRef = useRef<AggregateBuffer>({ timer: null, changedPaths: new Set<string>(), lastEvent: null });

  // 聚合到点：先刷树，再判冲突。
  const flush = useCallback((): void => {
    const agg = aggRef.current;
    agg.timer = null;
    const lastEvent = agg.lastEvent;
    const changedPaths = agg.changedPaths;
    agg.lastEvent = null;
    agg.changedPaths = new Set<string>();
    if (!lastEvent) return;
    try {
      depsRef.current.onExternalChange(lastEvent);
    } catch (err) {
      console.warn('[useNotesWatcher] onExternalChange failed:', err);
    }
    const editing = depsRef.current.selectedFile;
    if (!editing || !changedPaths.has(editing.path)) return;
    // 自我写入回声：应用自身保存触发的 change 不算外部修改
    //（否则自动保存后继续输入 → dirty 复归 true → 误弹冲突窗）
    if (isSelfWriteEcho(editing.path)) return;
    // 脏态必须非响应式读：订阅会让监听反复 stop/start（depsRef 每次渲染同步，取到的仍是最新值）
    if (!depsRef.current.isDirty) return;
    if (pendingRef.current?.path === editing.path) return;
    applyPending({ path: editing.path, name: editing.name });
  }, [applyPending]);

  useEffect(() => {
    const notes = window.electron?.notes;
    if (!hasRootPath || !rootPath || !notes) return undefined;
    const agg = aggRef.current;
    let disposed = false;
    const unsubscribe = notes.onFsChanged((event) => {
      if (disposed) return;
      agg.lastEvent = event;
      if (event.type === 'change') agg.changedPaths.add(event.path);
      if (agg.timer !== null) window.clearTimeout(agg.timer);
      agg.timer = window.setTimeout(flush, AGGREGATE_WINDOW_MS);
    });
    void notes.startWatching(rootPath).catch(() => undefined);

    return () => {
      disposed = true;
      if (agg.timer !== null) { window.clearTimeout(agg.timer); agg.timer = null; }
      if (typeof unsubscribe === 'function') unsubscribe();
      void notes.stopWatching().catch(() => undefined);
    };
  }, [hasRootPath, rootPath, flush]);

  // 切走文件后旧 pending 无从裁决（也不能被误写到别的文件上）→ 清掉。
  const selectedPath = selectedFile?.path ?? null;
  useEffect(() => {
    const current = pendingRef.current;
    if (current && current.path !== selectedPath) applyPending(null);
  }, [selectedPath, applyPending]);

  const resolveExternalChange = useCallback(
    async (action: 'keep-mine' | 'take-external'): Promise<void> => {
      const current = pendingRef.current;
      const editingPath = depsRef.current.selectedFile?.path ?? null;
      // 护栏：pending 没了或已切走文件 → 只清 pending，绝不写到别的文件上。
      if (!current || editingPath !== current.path) {
        if (current) applyPending(null);
        return;
      }
      try {
        if (action === 'keep-mine') {
          const ok = await depsRef.current.saveFile(depsRef.current.fileContent, current.path);
          if (ok) {
            // 文件已是最新，兜底草稿没有存在意义（否则下次启动会用它把文件回滚）
            void depsRef.current.deleteDraft?.(current.path).catch(() => undefined);
            useNotesTabsStore.getState().setDirty(current.path, false);
            applyPending(null);
          }
          return;
        }
        // 竞态护栏：readFile 期间用户可能切走文件，灌内容前须重新确认仍是 pending 文件。
        const result = await window.electron?.notes.readFile(current.path);
        if (
          result?.success &&
          typeof result.content === 'string' &&
          depsRef.current.selectedFile?.path === current.path
        ) {
          // 同时推进内容与基线，否则采纳外部内容后仍显示"未保存"，再被自动保存写回去
          depsRef.current.applyExternalContent(current.path, result.content);
          useNotesTabsStore.getState().setDirty(current.path, false);
        }
        applyPending(null);
      } catch (err) {
        console.warn('[useNotesWatcher] resolveExternalChange failed:', err);
        // keep-mine 失败：内容还在编辑器，保留 pending 可重试；take-external 失败：留着无意义，必须清。
        if (action === 'take-external') applyPending(null);
      }
    },
    [applyPending]
  );

  const dismiss = useCallback((): void => applyPending(null), [applyPending]);

  return { pendingExternalChange: pending, resolveExternalChange, dismiss };
}
