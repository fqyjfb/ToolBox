import { useState, useEffect, useCallback, useRef } from 'react';
import path from 'path';
import { logError } from '../services/loggerService';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  fileType?: 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf';
  children?: FileTreeNode[];
  expanded?: boolean;
  active?: boolean;
}

export interface FileMetadata {
  filePath: string;
  fileType: 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf';
  mimeType?: string;
}

export interface NotesState {
  hasRootPath: boolean;
  rootPath: string | null;
  fileTree: FileTreeNode[];
  selectedFile: FileTreeNode | null;
  fileContent: string;
  fileMetadata: FileMetadata | null;
  filePreviewUrl: string | null;
  loading: boolean;
  error: string | null;
}

export interface UseNotesReturn extends NotesState {
  selectRootFolder: () => Promise<boolean>;
  setRootPath: (path: string) => Promise<void>;
  changeFolder: () => Promise<boolean>;
  refreshFileTree: () => Promise<void>;
  selectFile: (file: FileTreeNode) => Promise<void>;
  updateFileContent: (content: string) => void;
  saveFile: (content: string) => Promise<boolean>;
  createFolder: (parentPath: string | null, name: string) => Promise<{ success: boolean; exists?: boolean }>;
  createFolderForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<boolean>;
  createNote: (parentPath: string | null, name: string, content?: string) => Promise<{ success: boolean; exists?: boolean }>;
  createNoteForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy', content?: string) => Promise<boolean>;
  renameItem: (oldPath: string, newName: string) => Promise<boolean>;
  deleteItem: (itemPath: string) => Promise<boolean>;
  moveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  copyItem: (sourcePath: string) => Promise<boolean>;
  importDroppedFiles: (filePaths: string[], targetFolderPath?: string) => Promise<{ success: boolean; imported?: string[]; errors?: string[] }>;
  toggleFolderExpand: (folderPath: string) => void;
  rebuildIndex: () => Promise<void>;
  clearError: () => void;
}

export function useNotes(): UseNotesReturn {
  const [hasRootPath, setHasRootPath] = useState(false);
  const [rootPath, setRootPathState] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

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

  useEffect(() => {
    const initNotes = async () => {
      if (initialized) return;
      if (!window.electron?.notes) return;

      try {
        const hasRoot = await window.electron.notes.hasRootPath();
        setHasRootPath(hasRoot);

        if (hasRoot) {
          const root = await window.electron.notes.getRootPath();
          setRootPathState(root);

          if (root) {
            await window.electron.notes.scanFolder(root);
            const tree = await window.electron.notes.getFileTree();
            setFileTree(tree);

            const lastOpenedFile = localStorageService.getString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE);
            if (lastOpenedFile) {
              const fileNode = findFileInTree(lastOpenedFile, tree);
              if (fileNode) {
                const fileType = fileNode.fileType;
                setSelectedFile(fileNode);
                setFileMetadata({ filePath: fileNode.path, fileType: fileType || 'md' });

                if (fileType === 'md' || fileType === 'txt' || fileType === 'html' || fileType === 'json') {
                  const result = await window.electron.notes.readFile(fileNode.path);
                  if (result.success && result.content !== undefined) {
                    setFileContent(result.content);
                  }
                } else if (fileType === 'image' || fileType === 'pdf' || fileType === 'docx' || fileType === 'xlsx') {
                  const result = await window.electron.notes.readFileAsBuffer(fileNode.path);
                  if (result.success && result.base64) {
                    setFilePreviewUrl(base64ToBlobUrl(result.base64, result.mimeType || 'application/octet-stream'));
                  }
                }

                const parentFolders = getParentFolders(fileNode.path, root);
                if (parentFolders.length > 0) {
                  setExpandedFolders((prev) => {
                    const newSet = new Set(prev);
                    parentFolders.forEach((folder) => newSet.add(folder));
                    return newSet;
                  });
                }
              } else {
                localStorageService.remove(STORAGE_KEYS.NOTES_LAST_OPENED_FILE);
              }
            }
          }
        }
        setInitialized(true);
      } catch {
        setError('初始化笔记模块失败');
      }
    };

    initNotes();
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

      await window.electron.notes.setRootPath(selectedPath);
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
    if (!rootPath || !window.electron) return;

    try {
      setLoading(true);
      await window.electron.notes.scanFolder(rootPath);
      const tree = await window.electron.notes.getFileTree();
      setFileTree(tree);
      setLoading(false);
    } catch (err) {
      logError('刷新文件树失败', 'useNotes', err as Error);
      setError('刷新文件树失败');
      setLoading(false);
    }
  }, [rootPath]);

  const selectFile = useCallback(async (file: FileTreeNode) => {
    if (file.type !== 'file' || !window.electron) return;

    try {
      setLoading(true);

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
          setError(result.error || '读取文件失败');
        }
      } else if (fileType === 'image' || fileType === 'pdf' || fileType === 'docx' || fileType === 'xlsx') {
        const result = await window.electron.notes.readFileAsBuffer(file.path);
        if (result.success && result.base64) {
          setFilePreviewUrl(base64ToBlobUrl(result.base64, result.mimeType || 'application/octet-stream'));
        } else {
          setError(result.error || '读取文件失败');
        }
      }

      localStorageService.setString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE, file.path);
      setLoading(false);
    } catch (err) {
      logError('读取文件失败', 'useNotes', err as Error);
      setError('读取文件失败');
      setLoading(false);
    }
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
          setError(result.error || '保存文件失败');
          return false;
        }
      } catch (err) {
        logError('保存文件失败', 'useNotes', err as Error);
        setError('保存文件失败');
        return false;
      }
    },
    [selectedFile]
  );

  const createFolder = useCallback(
    async (parentPath: string | null, name: string): Promise<{ success: boolean; exists?: boolean }> => {
      if (!window.electron) return { success: false };
      try {
        const result = await window.electron.notes.createFolder(parentPath, name);

        if (result.success) {
          await refreshFileTree();
          return { success: true };
        } else {
          setError(result.error || '创建文件夹失败');
          return { success: false, exists: result.exists };
        }
      } catch (err) {
        logError('创建文件夹失败', 'useNotes', err as Error);
        setError('创建文件夹失败');
        return { success: false };
      }
    },
    [refreshFileTree]
  );

  const createFolderForce = useCallback(
    async (parentPath: string | null, name: string, mode: 'overwrite' | 'copy'): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.createFolderForce(parentPath, name, mode);

        if (result.success) {
          await refreshFileTree();
          return true;
        } else {
          setError(result.error || '创建文件夹失败');
          return false;
        }
      } catch (err) {
        logError('强制创建文件夹失败', 'useNotes', err as Error);
        setError('创建文件夹失败');
        return false;
      }
    },
    [refreshFileTree]
  );

  const createNote = useCallback(
    async (parentPath: string | null, name: string, content?: string): Promise<{ success: boolean; exists?: boolean }> => {
      if (!window.electron) return { success: false };
      try {
        const result = await window.electron.notes.createNote(parentPath, name, content);

        if (result.success) {
          await refreshFileTree();

          if (result.path) {
            const newNode: FileTreeNode = {
              id: result.path,
              name: name.endsWith('.md') ? name : `${name}.md`,
              type: 'file',
              path: result.path,
            };
            await selectFile(newNode);
          }

          return { success: true };
        } else {
          setError(result.error || '创建笔记失败');
          return { success: false, exists: result.exists };
        }
      } catch (err) {
        logError('创建笔记失败', 'useNotes', err as Error);
        setError('创建笔记失败');
        return { success: false };
      }
    },
    [refreshFileTree, selectFile]
  );

  const createNoteForce = useCallback(
    async (parentPath: string | null, name: string, mode: 'overwrite' | 'copy', content?: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.createNoteForce(parentPath, name, mode, content);

        if (result.success) {
          await refreshFileTree();

          if (result.path) {
            const finalName = name.endsWith('.md') ? name : `${name}.md`;
            const newNode: FileTreeNode = {
              id: result.path,
              name: finalName,
              type: 'file',
              path: result.path,
            };
            await selectFile(newNode);
          }

          return true;
        } else {
          setError(result.error || '创建笔记失败');
          return false;
        }
      } catch (err) {
        logError('强制创建笔记失败', 'useNotes', err as Error);
        setError('创建笔记失败');
        return false;
      }
    },
    [refreshFileTree, selectFile]
  );

  const renameItem = useCallback(
    async (oldPath: string, newName: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.renameItem(oldPath, newName);

        if (result.success) {
          await refreshFileTree();

          setExpandedFolders((prev) => {
            const newSet = new Set<string>();
            prev.forEach((folderPath) => {
              if (folderPath === oldPath) {
                newSet.add(result.newPath!);
              } else if (folderPath.startsWith(oldPath + '/') || folderPath.startsWith(oldPath + '\\')) {
                newSet.add(folderPath.replace(oldPath, result.newPath!));
              } else {
                newSet.add(folderPath);
              }
            });
            return newSet;
          });

          if (selectedFile?.path === oldPath && result.newPath) {
            setSelectedFile({
              ...selectedFile,
              id: result.newPath,
              name: path.basename(result.newPath),
              path: result.newPath,
            });
          } else if (selectedFile?.path && result.newPath) {
            const sep = oldPath.includes('/') ? '/' : '\\';
            if (selectedFile.path.startsWith(oldPath + sep)) {
              const newFilePath = selectedFile.path.replace(oldPath, result.newPath);
              setSelectedFile({
                ...selectedFile,
                id: newFilePath,
                path: newFilePath,
              });
              localStorageService.setString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE, newFilePath);
            }
          }

          return true;
        } else {
          setError(result.error || '重命名失败');
          return false;
        }
      } catch (err) {
        logError('重命名失败', 'useNotes', err as Error);
        setError('重命名失败');
        return false;
      }
    },
    [refreshFileTree, selectedFile]
  );

  const deleteItem = useCallback(
    async (itemPath: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.deleteItem(itemPath);

        if (result.success) {
          await refreshFileTree();

          if (selectedFile?.path === itemPath) {
            setSelectedFile(null);
            setFileContent('');
            setFileMetadata(null);
            clearPreviewUrl();
            localStorageService.remove(STORAGE_KEYS.NOTES_LAST_OPENED_FILE);
          }

          return true;
        } else {
          setError(result.error || '删除失败');
          return false;
        }
      } catch (err) {
        logError('删除失败', 'useNotes', err as Error);
        setError('删除失败');
        return false;
      }
    },
    [refreshFileTree, selectedFile]
  );

  const moveItem = useCallback(
    async (itemPath: string, targetFolderPath: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.moveItem(itemPath, targetFolderPath);

        if (result.success && result.newPath) {
          await refreshFileTree();

          if (selectedFile?.path === itemPath) {
            const newName = itemPath.split(/[/\\]/).pop();
            setSelectedFile({
              ...selectedFile,
              id: result.newPath,
              name: newName || selectedFile.name,
              path: result.newPath,
            });
            localStorageService.setString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE, result.newPath);
          }

          return true;
        } else {
          setError(result.error || '移动失败');
          return false;
        }
      } catch (err) {
        logError('移动失败', 'useNotes', err as Error);
        setError('移动失败');
        return false;
      }
    },
    [refreshFileTree, selectedFile]
  );

  const copyItem = useCallback(
    async (sourcePath: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.copyItem(sourcePath);
        if (!result.success) {
          setError(result.error || '复制失败');
          return false;
        }
        return true;
      } catch (err) {
        logError('复制文件失败', 'useNotes', err as Error);
        setError('复制失败');
        return false;
      }
    },
    []
  );

  const importDroppedFiles = useCallback(
    async (filePaths: string[], targetFolderPath?: string): Promise<{ success: boolean; imported?: string[]; errors?: string[] }> => {
      if (!window.electron || !rootPath) return { success: false, errors: ['未设置根目录'] };
      try {
        const dest = targetFolderPath || rootPath;
        const result = await window.electron.notes.importDroppedFiles(dest, filePaths);
        if (result.success) {
          await refreshFileTree();
          return { success: true, imported: result.imported, errors: result.errors };
        } else {
          setError(result.error || '导入失败');
          return { success: false, errors: result.error ? [result.error] : result.errors };
        }
      } catch (err) {
        logError('拖入文件导入失败', 'useNotes', err as Error);
        setError('导入失败');
        return { success: false, errors: ['导入失败'] };
      }
    },
    [rootPath, refreshFileTree]
  );

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

  const changeFolder = useCallback(async (): Promise<boolean> => {
    if (!window.electron) return false;
    try {
      setLoading(true);
      setError(null);

      setSelectedFile(null);
      setFileContent('');
      setFileMetadata(null);
      clearPreviewUrl();
      localStorageService.remove(STORAGE_KEYS.NOTES_LAST_OPENED_FILE);

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

      await window.electron.notes.setRootPath(selectedPath);
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
      setExpandedFolders(new Set());

      setLoading(false);
      return true;
    } catch (err) {
      logError('切换目录失败', 'useNotes', err as Error);
      setError('切换目录失败');
      setLoading(false);
      return false;
    }
  }, []);

  const updateTreeExpandStateRef = useRef<((nodes: FileTreeNode[]) => FileTreeNode[]) | null>(null);
  updateTreeExpandStateRef.current = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.map((node) => ({
      ...node,
      expanded: expandedFolders.has(node.path),
      children: node.children ? updateTreeExpandStateRef.current!(node.children) : undefined,
    }));
  };

  const updateTreeExpandState = useCallback(
    (nodes: FileTreeNode[]): FileTreeNode[] => {
      return updateTreeExpandStateRef.current!(nodes);
    },
    []
  );

  return {
    hasRootPath,
    rootPath,
    fileTree: updateTreeExpandState(fileTree),
    selectedFile,
    fileContent,
    fileMetadata,
    filePreviewUrl,
    loading,
    error,
    selectRootFolder,
    setRootPath,
    changeFolder,
    refreshFileTree,
    selectFile,
    updateFileContent,
    saveFile,
    createFolder,
    createFolderForce,
    createNote,
    createNoteForce,
    renameItem,
    deleteItem,
    moveItem,
    copyItem,
    importDroppedFiles,
    toggleFolderExpand,
    rebuildIndex,
    clearError,
  };
}
