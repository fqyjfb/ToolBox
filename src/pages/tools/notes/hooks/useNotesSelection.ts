// useNotesSelection —— 选中文件 / 内容 / 预览；最近列表、收藏、标签页走延迟注入避免循环依赖。

import { useState, useCallback, useRef } from 'react';
import { logError } from '../../../../services/loggerService';
import localStorageService, { STORAGE_KEYS } from '../../../../services/localStorageService';
import { markSelfWrite } from '../utils/selfWriteTracker';
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
  /** 磁盘基线：与 fileContent 比较即得脏态；只在读取成功 / 落盘成功后变化 */
  savedContent: string;
  /** 派生值，不要写入（写入会形成第三份脏态真源） */
  isDirty: boolean;
  fileMetadata: FileMetadata | null;
  filePreviewUrl: string | null;
  selectFile: (file: FileTreeNode) => Promise<void>;
  updateFileContent: (content: string) => void;
  /** 落盘；path 显式传入即可写入非当前文件（结果只回灌给对应文件） */
  saveFile: (content: string, path?: string) => Promise<boolean>;
  /** 内容已与磁盘一致（外部覆盖 / 草稿恢复后调用）：同步内容与基线 */
  markSaved: (path: string, content: string) => void;
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
  // 磁盘基线：脏态 = fileContent !== savedContent，不再由调用方手工维护
  const [savedContent, setSavedContent] = useState('');
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // 当前文件快照：异步回调（保存 / 外部覆盖）里判断"是否还是同一个文件"
  const selectedFileRef = useRef<FileTreeNode | null>(null);
  selectedFileRef.current = selectedFile;
  // 选择序号：快速连切时只允许最后一次读取提交，杜绝旧结果覆盖新文件
  const requestSeqRef = useRef(0);

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

      // 快速连切：只允许最后一次请求提交结果，避免旧读取覆盖新文件
      const seq = ++requestSeqRef.current;
      try {
        deps.setLoading(true);

        const fileType = file.fileType;
        let nextContent = '';
        let nextPreview: { base64: string; mimeType: string } | null = null;

        if (fileType === 'md' || fileType === 'txt' || fileType === 'html' || fileType === 'json') {
          const result = await window.electron.notes.readFile(file.path);
          if (seq !== requestSeqRef.current) return;
          if (result.success && result.content !== undefined) {
            nextContent = result.content;
          } else {
            deps.setError(result.error || '读取文件失败');
          }
        } else if (fileType === 'image' || fileType === 'pdf' || fileType === 'docx' || fileType === 'xlsx') {
          const result = await window.electron.notes.readFileAsBuffer(file.path);
          if (seq !== requestSeqRef.current) return;
          if (result.success && result.base64) {
            nextPreview = {
              base64: result.base64,
              mimeType: result.mimeType || 'application/octet-stream',
            };
          } else {
            deps.setError(result.error || '读取文件失败');
          }
        }

        if (seq !== requestSeqRef.current) return;

        // 读成功后一次性提交：内容与基线同时写入，打开即 clean，不产生中间脏态
        setSelectedFile(file);
        setFileContent(nextContent);
        setSavedContent(nextContent);
        setFileMetadata({ filePath: file.path, fileType: fileType || 'md' });
        clearPreviewUrl();
        if (nextPreview) {
          setFilePreviewUrl(base64ToBlobUrl(nextPreview.base64, nextPreview.mimeType));
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
        if (seq !== requestSeqRef.current) return; // 已被更新的请求接管，不再干扰 loading / error
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
    async (content: string, path?: string): Promise<boolean> => {
      const target = path ?? selectedFileRef.current?.path;
      if (!target || !window.electron) return false;

      try {
        const result = await window.electron.notes.saveFile(target, content);

        if (!result.success) {
          deps.setError(result.error || '保存文件失败');
          return false;
        }
        // 记录自我写入：随后 fs watcher 回推的 change 事件不判为外部修改
        markSelfWrite(target);
        // 只回灌"当前打开的那个文件"：保存 A 期间切到 B 时，不能把 A 的内容灌进 B 的编辑器
        //（否则 B 会显示 A 的正文，下一次自动保存再把 A 的内容写进 B）。
        if (target === selectedFileRef.current?.path) {
          setFileContent(content);
          setSavedContent(content);
        }
        return true;
      } catch (err) {
        logError('保存文件失败', 'useNotes', err as Error);
        deps.setError('保存文件失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** 内容已与磁盘一致（外部覆盖 / 草稿恢复后调用）：内容与基线一起推进，避免恢复完又显示"未保存" */
  const markSaved = useCallback((path: string, content: string) => {
    if (path !== selectedFileRef.current?.path) return;
    setFileContent(content);
    setSavedContent(content);
  }, []);

  const clearSelection = useCallback(() => {
    requestSeqRef.current += 1; // 作废进行中的读取，避免清空后又被旧结果填回来
    setSelectedFile(null);
    setFileContent('');
    setSavedContent('');
    setFileMetadata(null);
    clearPreviewUrl();
    // 作废读取后 loading 不会有人来复位，这里兜底，避免停在"加载中"
    deps.setLoading(false);
    localStorageService.remove(STORAGE_KEYS.NOTES_LAST_OPENED_FILE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    selectedFile,
    fileContent,
    savedContent,
    isDirty: fileContent !== savedContent,
    fileMetadata,
    filePreviewUrl,
    selectFile,
    updateFileContent,
    saveFile,
    markSaved,
    clearPreviewUrl,
    clearSelection,
    setSelectedFile,
    setRecentPusher,
    setFavoriteToggler,
    setTabPusher,
  };
}