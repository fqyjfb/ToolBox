// useNotesSelection —— 选中文件 / 内容 / 预览；最近列表、收藏、标签页走延迟注入避免循环依赖。

import { useState, useCallback, useRef } from 'react';
import { logError } from '../../../../services/loggerService';
import localStorageService, { STORAGE_KEYS } from '../../../../services/localStorageService';
import type { FileTreeNode, FileMetadata } from '../types';

export type RecentPusher = (file: { path: string; name: string; mtime?: number }) => void;

export type FavoriteToggler = (absolutePath: string) => Promise<boolean> | boolean;

export type TabPusher = (file: { path: string; name: string }) => void;

export interface UseNotesSelectionDeps {
  setError: (e: string | null) => void;
  setLoading: (v: boolean) => void;
}

export interface UseNotesSelectionReturn {
  selectedFile: FileTreeNode | null;
  fileContent: string;
  fileMetadata: FileMetadata | null;
  filePreviewUrl: string | null;
  selectFile: (file: FileTreeNode) => Promise<void>;
  updateFileContent: (content: string) => void;
  saveFile: (content: string) => Promise<boolean>;
  clearPreviewUrl: () => void;
  clearSelection: () => void;
  setSelectedFile: React.Dispatch<React.SetStateAction<FileTreeNode | null>>;
  setRecentPusher: (pusher: RecentPusher | null) => void;
  setFavoriteToggler: (toggler: FavoriteToggler | null) => void;
  setTabPusher: (pusher: TabPusher | null) => void;
}

export function useNotesSelection(deps: UseNotesSelectionDeps): UseNotesSelectionReturn {
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // 注入句柄用 ref 保持稳定，避免 selectFile 因依赖变化而重建；null = 组合根未注入。
  const recentPusherRef = useRef<RecentPusher | null>(null);
  const favoriteTogglerRef = useRef<FavoriteToggler | null>(null);
  const tabPusherRef = useRef<TabPusher | null>(null);

  const base64ToBlobUrl = useCallback((base64: string, mimeType: string): string => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    objectUrlRef.current = url;
    return url;
  }, []);

  const clearPreviewUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setFilePreviewUrl(null);
  }, []);

  const selectFile = useCallback(
    async (file: FileTreeNode) => {
      if (file.type !== 'file' || !window.electron) return;

      try {
        deps.setLoading(true);

        const fileType = file.fileType;
        setSelectedFile(file);
        setFileContent('');
        setFileMetadata({ filePath: file.path, fileType: fileType || 'md' });
        clearPreviewUrl();

        if (fileType === 'md' || fileType === 'txt' || fileType === 'html' || fileType === 'json') {
          const result = await window.electron.notes.readFile(file.path);
          if (result.success && result.content !== undefined) {
            setFileContent(result.content);
          } else {
            deps.setError(result.error || '读取文件失败');
          }
        } else if (fileType === 'image' || fileType === 'pdf' || fileType === 'docx' || fileType === 'xlsx') {
          const result = await window.electron.notes.readFileAsBuffer(file.path);
          if (result.success && result.base64) {
            setFilePreviewUrl(base64ToBlobUrl(result.base64, result.mimeType || 'application/octet-stream'));
          } else {
            deps.setError(result.error || '读取文件失败');
          }
        }

        localStorageService.setString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE, file.path);
        deps.setLoading(false);

        // 推到「最近打开」（FileTreeNode 无 mtime，用打开时刻兜底）；静默失败。
        const pusher = recentPusherRef.current;
        if (pusher) {
          try {
            pusher({ path: file.path, name: file.name, mtime: Date.now() });
          } catch (err) {
            logError('写入最近列表失败', 'useNotesSelection', err as Error);
          }
        }
        // 登记到标签页（只存路径，切标签 = 再次 selectFile）；静默失败。
        const tabPusher = tabPusherRef.current;
        if (tabPusher) {
          try {
            tabPusher({ path: file.path, name: file.name });
          } catch (err) {
            logError('写入标签页失败', 'useNotesSelection', err as Error);
          }
        }
      } catch (err) {
        logError('读取文件失败', 'useNotes', err as Error);
        deps.setError('读取文件失败');
        deps.setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const setRecentPusher = useCallback((pusher: RecentPusher | null) => {
    recentPusherRef.current = pusher;
  }, []);

  const setFavoriteToggler = useCallback((toggler: FavoriteToggler | null) => {
    favoriteTogglerRef.current = toggler;
  }, []);

  const setTabPusher = useCallback((pusher: TabPusher | null) => {
    tabPusherRef.current = pusher;
  }, []);

  const updateFileContent = useCallback((content: string) => {
    setFileContent(content);
  }, []);

  const saveFile = useCallback(
    async (content: string): Promise<boolean> => {
      if (!selectedFile || !window.electron) return false;

      try {
        const result = await window.electron.notes.saveFile(selectedFile.path, content);

        if (result.success) {
          setFileContent(content);
          return true;
        } else {
          deps.setError(result.error || '保存文件失败');
          return false;
        }
      } catch (err) {
        logError('保存文件失败', 'useNotes', err as Error);
        deps.setError('保存文件失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFile]
  );

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setFileContent('');
    setFileMetadata(null);
    clearPreviewUrl();
    localStorageService.remove(STORAGE_KEYS.NOTES_LAST_OPENED_FILE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    selectedFile,
    fileContent,
    fileMetadata,
    filePreviewUrl,
    selectFile,
    updateFileContent,
    saveFile,
    clearPreviewUrl,
    clearSelection,
    setSelectedFile,
    setRecentPusher,
    setFavoriteToggler,
    setTabPusher,
  };
}