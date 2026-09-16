// useNotesRecents —— 封装 notesRecentsStore：recents / pushRecent / removeRecent / clearRecents。

import { useCallback } from 'react';
import { useNotesRecentsStore } from '../../../../store/notesRecentsStore';

// pushRecent 入参从宽（与 RecentPusher 一致）：openedAt 由 hook 兜底，mtime 可选。
export interface UseNotesRecentsReturn {
  recents: import('../types').NotesRecentItem[];
  pushRecent: (file: { path: string; name: string; mtime?: number }) => void;
  removeRecent: (path: string) => void;
  clearRecents: () => void;
}

export function useNotesRecents(): UseNotesRecentsReturn {
  const recents = useNotesRecentsStore((s) => s.recents);
  const pushRecent = useNotesRecentsStore((s) => s.pushRecent);
  const removeRecent = useNotesRecentsStore((s) => s.removeRecent);
  const clearRecents = useNotesRecentsStore((s) => s.clearRecents);

  // 把文件节点转成 store 需要的 NotesRecentItem（补齐 mtime / openedAt）
  const pushRecentFromFile = useCallback(
    (file: { path: string; name: string; mtime?: number }) => {
      pushRecent({
        path: file.path,
        name: file.name,
        mtime: typeof file.mtime === 'number' ? file.mtime : Date.now(),
        openedAt: Date.now(),
      });
    },
    [pushRecent]
  );

  return {
    recents,
    pushRecent: pushRecentFromFile,
    removeRecent,
    clearRecents,
  };
}
