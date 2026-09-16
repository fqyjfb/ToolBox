// useNotesTree —— 文件树/根目录/加载/错误；跨 hook 依赖由参数注入，避免循环依赖。

import { useState, useCallback, useEffect, useRef } from 'react';
import { logError } from '../../../../services/loggerService';
import type { FileTreeNode } from '../types';

export interface UseNotesTreeDeps {
  currentViewPath: string | null;
  setCurrentViewPath: (path: string | null) => void;
  chatPath: string | null;
  loadChatOrganizeTree: (basePath: string | null) => Promise<void>;
}

export interface UseNotesTreeReturn {
  hasRootPath: boolean;
  rootPath: string | null;
  fileTree: FileTreeNode[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  selectRootFolder: () => Promise<boolean>;
  setRootPath: (path: string) => Promise<void>;
  refreshFileTree: () => Promise<void>;
  toggleFolderExpand: (folderPath: string) => void;
  switchToFolder: (folderPath: string) => Promise<void>;
  rebuildIndex: () => Promise<void>;
  clearError: () => void;
  scanFolderAsync: (rootPath: string) => Promise<{ success: boolean; fileCount: number; folderCount: number; tree: FileTreeNode[]; error?: string }>;
  getFileTreeAsync: (rootPath: string) => Promise<FileTreeNode[]>;
  init: () => Promise<void>;
  findFileInTree: (filePath: string, nodes: FileTreeNode[]) => FileTreeNode | null;
  getParentFolders: (filePath: string, rootPath: string) => string[];
  expandTree: (nodes: FileTreeNode[]) => FileTreeNode[];
  setHasRootPath: (v: boolean) => void;
  setRootPathState: (v: string | null) => void;
  setFileTree: (v: FileTreeNode[]) => void;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
}

export function useNotesTree(deps: UseNotesTreeDeps): UseNotesTreeReturn {
  const [hasRootPath, setHasRootPath] = useState(false);
  const [rootPath, setRootPathState] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentViewPathRef = useRef<string | null>(null);
  currentViewPathRef.current = deps.currentViewPath;

  const findFileInTreeRef = useRef<((filePath: string, nodes: FileTreeNode[]) => FileTreeNode | null) | null>(null);
  findFileInTreeRef.current = (filePath: string, nodes: FileTreeNode[]): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.path === filePath && node.type === 'file') {
        return node;
      }
      if (node.children) {
        const found = findFileInTreeRef.current!(filePath, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  const findFileInTree = useCallback(
    (filePath: string, nodes: FileTreeNode[]): FileTreeNode | null => {
      return findFileInTreeRef.current!(filePath, nodes);
    },
    []
  );

  const getParentFolders = useCallback(
    (filePath: string, rootPath: string): string[] => {
      const parents: string[] = [];
      let currentPath = filePath;

      while (currentPath !== rootPath) {
        const lastSep = Math.max(currentPath.lastIndexOf('/'), currentPath.lastIndexOf('\\'));
        if (lastSep === -1) break;

        currentPath = currentPath.substring(0, lastSep);
        if (currentPath && currentPath !== rootPath) {
          parents.push(currentPath);
        }
      }

      return parents;
    },
    []
  );

  const updateTreeExpandStateRef = useRef<((nodes: FileTreeNode[]) => FileTreeNode[]) | null>(null);
  updateTreeExpandStateRef.current = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.map((node) => ({
      ...node,
      expanded: expandedFolders.has(node.path),
      children: node.children ? updateTreeExpandStateRef.current!(node.children) : undefined,
    }));
  };

  const expandTree = useCallback(
    (nodes: FileTreeNode[]): FileTreeNode[] => {
      return updateTreeExpandStateRef.current!(nodes);
    },
    []
  );

  // 初始加载；「还原上次打开文件」由组合根在 initialized=true 后处理。
  const init = useCallback(async () => {
    if (initialized) return;
    if (!window.electron?.notes) return;

    try {
      const hasRoot = await window.electron.notes.hasRootPath();
      setHasRootPath(hasRoot);

      if (hasRoot) {
        const { default: localStorageService, STORAGE_KEYS } = await import(
          '../../../../services/localStorageService'
        );

        const savedRoot = localStorageService.getString(STORAGE_KEYS.NOTES_ROOT_PATH);
        const root = savedRoot || (await window.electron.notes.getRootPath());
        if (savedRoot) {
          await window.electron.notes.setRootPath(savedRoot);
        }
        setRootPathState(root);

        if (root) {
          await window.electron.notes.scanFolder(root);
          const tree = await window.electron.notes.getFileTree();
          setFileTree(tree);

          const savedChatPath = localStorageService.getString(STORAGE_KEYS.NOTES_CHAT_PATH);
          const chatBasePath = savedChatPath || root;
          if (chatBasePath && chatBasePath !== root) {
            await deps.loadChatOrganizeTree(chatBasePath);
            await window.electron.notes.setRootPath(root);
            await window.electron.notes.scanFolder(root);
          }
        }
      }
      setInitialized(true);
    } catch {
      setError('初始化笔记模块失败');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectRootFolder = useCallback(async (): Promise<boolean> => {
    if (!window.electron?.notes) return false;

    try {
      setLoading(true);
      setError(null);

      const result = await window.electron.notes.selectFolder();
      if (result.canceled || result.filePaths.length === 0) {
        setLoading(false);
        return false;
      }

      const selectedPath = result.filePaths[0];
      const validation = await window.electron.notes.validateFolder(selectedPath);
      if (!validation.valid) {
        setError(validation.error || '文件夹验证失败');
        setLoading(false);
        return false;
      }

      const { default: localStorageService, STORAGE_KEYS } = await import(
        '../../../../services/localStorageService'
      );
      await window.electron.notes.setRootPath(selectedPath);
      localStorageService.setString(STORAGE_KEYS.NOTES_ROOT_PATH, selectedPath);
      setRootPathState(selectedPath);
      setHasRootPath(true);

      const scanResult = await window.electron.notes.scanFolder(selectedPath);
      if (!scanResult.success) {
        setError(scanResult.error || '扫描文件夹失败');
        setLoading(false);
        return false;
      }

      const tree = await window.electron.notes.getFileTree();
      setFileTree(tree);
      setLoading(false);
      return true;
    } catch {
      setError('选择根目录失败');
      setLoading(false);
      return false;
    }
  }, []);

  const setRootPath = useCallback(async (path: string) => {
    if (!window.electron) return;
    await window.electron.notes.setRootPath(path);
    setRootPathState(path);
    setHasRootPath(true);

    await window.electron.notes.scanFolder(path);
    const tree = await window.electron.notes.getFileTree();
    setFileTree(tree);
  }, []);

  const refreshFileTree = useCallback(async () => {
    const scanPath = currentViewPathRef.current || rootPath;
    if (!scanPath || !window.electron) return;

    try {
      setLoading(true);
      setError(null);

      const chatBasePath = deps.chatPath || rootPath;

      await window.electron.notes.setRootPath(scanPath);
      await window.electron.notes.scanFolder(scanPath);
      const tree = await window.electron.notes.getFileTree();
      setFileTree(tree);

      if (chatBasePath && chatBasePath !== scanPath) {
        await deps.loadChatOrganizeTree(chatBasePath);
        await window.electron.notes.setRootPath(scanPath);
      } else if (chatBasePath && chatBasePath === scanPath) {
        await deps.loadChatOrganizeTree(chatBasePath);
      }

      setLoading(false);
    } catch (err) {
      logError('刷新文件树失败', 'useNotes', err as Error);
      setError('刷新文件树失败');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath]);

  const toggleFolderExpand = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const switchToFolder = useCallback(
    async (folderPath: string) => {
      if (!window.electron) return;
      try {
        setLoading(true);
        deps.setCurrentViewPath(folderPath);

        const chatBasePath = deps.chatPath || rootPath;

        await window.electron.notes.setRootPath(folderPath);
        const tree = await window.electron.notes.getFileTree();
        setFileTree(tree);

        if (chatBasePath && chatBasePath !== folderPath) {
          await deps.loadChatOrganizeTree(chatBasePath);
          await window.electron.notes.setRootPath(folderPath);
        } else if (chatBasePath && chatBasePath === folderPath) {
          await deps.loadChatOrganizeTree(chatBasePath);
        }

        setExpandedFolders(new Set());
        setLoading(false);
      } catch (err) {
        logError('切换目录失败', 'useNotes', err as Error);
        setError('切换目录失败');
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deps.chatPath, deps.loadChatOrganizeTree, deps.setCurrentViewPath, rootPath]
  );

  const rebuildIndex = useCallback(async () => {
    if (!rootPath || !window.electron) return;
    try {
      setLoading(true);
      await window.electron.notes.indexAll(rootPath);
    } catch (err) {
      logError('重建索引失败', 'useNotes', err as Error);
      setError('重建索引失败');
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  // 异步扫描并直接返回 tree，调用方可 setFileTree(...) 替换。
  const scanFolderAsync = useCallback(
    async (scanPath: string) => {
      if (!window.electron?.notes || !scanPath) {
        return { success: false, fileCount: 0, folderCount: 0, tree: [] as FileTreeNode[] };
      }
      try {
        const result = await window.electron.notes.scanFolderAsync(scanPath);
        return {
          success: !!result.success,
          fileCount: result.fileCount ?? 0,
          folderCount: result.folderCount ?? 0,
          tree: (result.tree ?? []) as FileTreeNode[],
        };
      } catch (err) {
        logError('异步扫描失败', 'useNotes', err as Error);
        return { success: false, fileCount: 0, folderCount: 0, tree: [] as FileTreeNode[] };
      }
    },
    []
  );

  // 异步 build tree（不写 last_scan_at，仅返回结构）。
  const getFileTreeAsync = useCallback(
    async (scanPath: string): Promise<FileTreeNode[]> => {
      if (!window.electron?.notes || !scanPath) {
        return [];
      }
      try {
        const tree = await window.electron.notes.getFileTreeAsync(scanPath);
        return (tree ?? []) as FileTreeNode[];
      } catch (err) {
        logError('异步 build tree 失败', 'useNotes', err as Error);
        return [];
      }
    },
    []
  );

  return {
    hasRootPath,
    rootPath,
    fileTree,
    loading,
    error,
    initialized,
    selectRootFolder,
    setRootPath,
    refreshFileTree,
    toggleFolderExpand,
    switchToFolder,
    rebuildIndex,
    clearError,
    scanFolderAsync,
    getFileTreeAsync,
    init,
    findFileInTree,
    getParentFolders,
    expandTree,
    setHasRootPath,
    setRootPathState,
    setFileTree,
    setExpandedFolders,
    setLoading,
    setError,
  };
}