// useNotesTabs —— 封装 notesTabsStore：tabs / activePath / dirtyMap + openTab / closeTab / reorderTab。
// setDirty 不在此导出：唯一写入方 NotesEditor 用 getState().setDirty() 非响应式写入，避免重渲染。

import { useCallback } from 'react';
import { useNotesTabsStore } from '../../../../store/notesTabsStore';

export interface UseNotesTabsReturn {
  tabs: string[];
  activePath: string | null;
  dirtyMap: Record<string, boolean>;
  openTab: (file: { path: string; name?: string }) => void;
  closeTab: (path: string) => void;
  reorderTab: (from: number, to: number) => void;
}

export function useNotesTabs(): UseNotesTabsReturn {
  const tabs = useNotesTabsStore((s) => s.tabs);
  const activePath = useNotesTabsStore((s) => s.activePath);
  const dirtyMap = useNotesTabsStore((s) => s.dirtyMap);
  const openTab = useNotesTabsStore((s) => s.openTab);
  const closeTab = useNotesTabsStore((s) => s.closeTab);
  const reorderTab = useNotesTabsStore((s) => s.reorderTab);

  // 适配渲染层的 { path, name } 入参（store 只存路径）
  const openTabFromFile = useCallback(
    (file: { path: string; name?: string }) => {
      openTab(file.path);
    },
    [openTab]
  );

  return {
    tabs,
    activePath,
    dirtyMap,
    openTab: openTabFromFile,
    closeTab,
    reorderTab,
  };
}
