// useNotesDraftRecovery —— 启动时草稿清点 / 恢复 / 丢弃（与只负责写的 useNotesDrafts 解耦）。
// 红线：recover 任一步失败都返回 null 且绝不删草稿，避免未提交内容丢失。

import { useCallback, useState } from 'react';

export interface DraftInfo {
  hash: string;
  filePath: string;
  absolutePath: string;
  size: number;
  mtime: number;
}

export interface UseNotesDraftRecoveryReturn {
  drafts: DraftInfo[];
  loading: boolean;
  scan: () => Promise<void>;
  recover: (draft: DraftInfo) => Promise<string | null>;
  discard: (draft: DraftInfo) => Promise<boolean>;
  clear: () => void;
}

export function useNotesDraftRecovery(): UseNotesDraftRecoveryReturn {
  const [drafts, setDrafts] = useState<DraftInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const scan = useCallback(async (): Promise<void> => {
    if (!window.electron?.notes?.listDrafts) return;
    setLoading(true);
    try {
      const result = await window.electron.notes.listDrafts();
      const list = (result?.drafts ?? []).filter(
        (draft) => typeof draft.absolutePath === 'string' && draft.absolutePath.length > 0
      );
      setDrafts(list);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const recover = useCallback(async (draft: DraftInfo): Promise<string | null> => {
    const api = window.electron?.notes;
    if (!api?.readDraft || !api?.saveFile || !api?.deleteDraft) return null;
    const target = draft.absolutePath;
    if (!target) return null;
    try {
      const read = await api.readDraft(target);
      if (!read?.success || typeof read.content !== 'string') return null;
      const saved = await api.saveFile(target, read.content);
      if (!saved?.success) return null;
      // 写回成功后才删草稿；删除失败只 warn（内容已安全落盘，草稿残留只是下次再提示一次）。
      try {
        const removed = await api.deleteDraft(target);
        if (!removed?.success) {
          console.warn('[useNotesDraftRecovery] deleteDraft failed after recover, draft kept:', target);
        }
      } catch (removeErr) {
        console.warn('[useNotesDraftRecovery] deleteDraft threw after recover, draft kept:', removeErr);
      }
      return read.content;
    } catch (err) {
      console.warn('[useNotesDraftRecovery] recover failed:', err);
      return null;
    }
  }, []);

  const discard = useCallback(async (draft: DraftInfo): Promise<boolean> => {
    if (!window.electron?.notes?.deleteDraft) return false;
    if (!draft.absolutePath) return false;
    try {
      const result = await window.electron.notes.deleteDraft(draft.absolutePath);
      return !!(result && result.success);
    } catch (err) {
      console.warn('[useNotesDraftRecovery] discard failed:', err);
      return false;
    }
  }, []);

  const clear = useCallback(() => {
    setDrafts([]);
  }, []);

  return { drafts, loading, scan, recover, discard, clear };
}
