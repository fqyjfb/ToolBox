// 固定目录 + 当前查看路径；暴露 setter / ref 供其他 hook 跨模块同步
// 注：switchToFolder 在 useNotesTree 内（它会触树状态）

import { useState, useCallback, useRef } from 'react';
import localStorageService, { STORAGE_KEYS } from '../../../../services/localStorageService';
import type { PinnedFolder } from '../types';

export interface UseNotesPinnedReturn {
  pinnedFolders: PinnedFolder[];
  currentViewPath: string | null;
  addPinnedFolder: () => Promise<boolean>;
  addPinnedFolderByPath: (folderPath: string) => boolean;
  removePinnedFolder: (folderPath: string) => void;
  reorderPinnedFolder: (fromIndex: number, toIndex: number) => void;
  // 暴露给 useNotesTree / useNotesOperations 同步
  setPinnedFolders: React.Dispatch<React.SetStateAction<PinnedFolder[]>>;
  setCurrentViewPath: (path: string | null) => void;
  // 只读 ref：供"无须触发重渲染"的位置读取，避免依赖循环
  currentViewPathRef: React.RefObject<string | null>;
}

export function useNotesPinned(): UseNotesPinnedReturn {
  const [pinnedFolders, setPinnedFolders] = useState<PinnedFolder[]>(() => {
    const stored = localStorageService.get<PinnedFolder[] | string[]>(STORAGE_KEYS.NOTES_PINNED_FOLDERS, []);
    if (stored.length > 0 && typeof stored[0] === 'string') {
      return (stored as string[]).map((p) => ({ path: p, name: p.split(/[/\\]/).pop() || p }));
    }
    return stored as PinnedFolder[];
  });
  const [currentViewPath, setCurrentViewPathState] = useState<string | null>(() => {
    return localStorageService.getString(STORAGE_KEYS.NOTES_CURRENT_VIEW_PATH) || null;
  });
  const currentViewPathRef = useRef<string | null>(null);
  currentViewPathRef.current = currentViewPath;

  // 当前查看目录落盘：切换导航 / 重启后按此恢复固定目录视图（null = 未配置固定目录）
  const setCurrentViewPath = useCallback((path: string | null) => {
    setCurrentViewPathState(path);
    if (path) {
      localStorageService.setString(STORAGE_KEYS.NOTES_CURRENT_VIEW_PATH, path);
    } else {
      localStorageService.remove(STORAGE_KEYS.NOTES_CURRENT_VIEW_PATH);
    }
  }, []);

  const addPinnedFolder = useCallback(async (): Promise<boolean> => {
    if (!window.electron) return false;
    try {
      const result = await window.electron.notes.selectFolder();
      if (result.canceled || result.filePaths.length === 0) return false;

      const folderPath = result.filePaths[0];
      const folderName = folderPath.split(/[/\\]/).pop() || folderPath;

      setPinnedFolders((prev) => {
        if (prev.some((p) => p.path === folderPath)) return prev;
        const next = [...prev, { path: folderPath, name: folderName }];
        localStorageService.set(STORAGE_KEYS.NOTES_PINNED_FOLDERS, next);
        return next;
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const addPinnedFolderByPath = useCallback((folderPath: string): boolean => {
    if (!folderPath) return false;
    const folderName = folderPath.split(/[/\\]/).pop() || folderPath;

    setPinnedFolders((prev) => {
      if (prev.some((p) => p.path === folderPath)) return prev;
      const next = [...prev, { path: folderPath, name: folderName }];
      localStorageService.set(STORAGE_KEYS.NOTES_PINNED_FOLDERS, next);
      return next;
    });
    return true;
  }, []);

  const removePinnedFolder = useCallback((folderPath: string) => {
    setPinnedFolders((prev) => {
      const next = prev.filter((p) => p.path !== folderPath);
      localStorageService.set(STORAGE_KEYS.NOTES_PINNED_FOLDERS, next);
      return next;
    });
  }, []);

  const reorderPinnedFolder = useCallback((fromIndex: number, toIndex: number) => {
    setPinnedFolders((prev) => {
      if (fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      localStorageService.set(STORAGE_KEYS.NOTES_PINNED_FOLDERS, next);
      return next;
    });
  }, []);

  return {
    pinnedFolders,
    currentViewPath,
    addPinnedFolder,
    addPinnedFolderByPath,
    removePinnedFolder,
    reorderPinnedFolder,
    setPinnedFolders,
    setCurrentViewPath,
    currentViewPathRef,
  };
}