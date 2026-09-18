// 文件增删改移；跨 hook 状态更新所需 setter 全部由 deps 注入

import { useCallback, useRef } from 'react';
import path from 'path';
import { logError } from '../../../../services/loggerService';
import localStorageService, { STORAGE_KEYS } from '../../../../services/localStorageService';
import { useNotesTabsStore } from '../../../../store/notesTabsStore';
import type { FileTreeNode, PinnedFolder } from '../types';

export interface UseNotesOperationsDeps {
  setError: (e: string | null) => void;
  refreshFileTree: () => Promise<void>;
  selectFile: (file: FileTreeNode) => Promise<void>;
  clearSelection: () => void;
  selectedFile: FileTreeNode | null;
  setSelectedFile: (file: FileTreeNode | null) => void;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  setPinnedFolders: React.Dispatch<React.SetStateAction<PinnedFolder[]>>;
  rootPath: string | null;
  currentViewPathRef: React.RefObject<string | null>;
}

export interface UseNotesOperationsReturn {
  createFolder: (
    parentPath: string | null,
    name: string
  ) => Promise<{ success: boolean; exists?: boolean }>;
  createFolderForce: (
    parentPath: string | null,
    name: string,
    mode: 'overwrite' | 'copy'
  ) => Promise<boolean>;
  createNote: (
    parentPath: string | null,
    name: string,
    content?: string
  ) => Promise<{ success: boolean; exists?: boolean }>;
  createNoteForce: (
    parentPath: string | null,
    name: string,
    mode: 'overwrite' | 'copy',
    content?: string
  ) => Promise<boolean>;
  renameItem: (oldPath: string, newName: string) => Promise<boolean>;
  deleteItem: (itemPath: string) => Promise<boolean>;
  moveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  copyItem: (sourcePath: string) => Promise<boolean>;
  importDroppedFiles: (
    filePaths: string[],
    targetFolderPath?: string
  ) => Promise<{ success: boolean; imported?: string[]; errors?: string[] }>;
}

export function useNotesOperations(deps: UseNotesOperationsDeps): UseNotesOperationsReturn {
  // 下方回调均为 [] 依赖，deps.rootPath 会停在首次渲染的快照（null），必须用 ref 读最新值
  const rootPathRef = useRef(deps.rootPath);
  rootPathRef.current = deps.rootPath;

  const createFolder = useCallback(
    async (parentPath: string | null, name: string): Promise<{ success: boolean; exists?: boolean }> => {
      if (!window.electron) return { success: false };
      try {
        const result = await window.electron.notes.createFolder(parentPath, name);

        if (result.success) {
          await deps.refreshFileTree();
          return { success: true };
        } else {
          deps.setError(result.error || '创建文件夹失败');
          return { success: false, exists: result.exists };
        }
      } catch (err) {
        logError('创建文件夹失败', 'useNotes', err as Error);
        deps.setError('创建文件夹失败');
        return { success: false };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const createFolderForce = useCallback(
    async (parentPath: string | null, name: string, mode: 'overwrite' | 'copy'): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.createFolderForce(parentPath, name, mode);

        if (result.success) {
          await deps.refreshFileTree();
          return true;
        } else {
          deps.setError(result.error || '创建文件夹失败');
          return false;
        }
      } catch (err) {
        logError('强制创建文件夹失败', 'useNotes', err as Error);
        deps.setError('创建文件夹失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const createNote = useCallback(
    async (
      parentPath: string | null,
      name: string,
      content?: string
    ): Promise<{ success: boolean; exists?: boolean }> => {
      if (!window.electron) return { success: false };
      try {
        const result = await window.electron.notes.createNote(parentPath, name, content);

        if (result.success) {
          await deps.refreshFileTree();

          if (result.path) {
            const newNode: FileTreeNode = {
              id: result.path,
              name: name.endsWith('.md') ? name : `${name}.md`,
              type: 'file',
              path: result.path,
            };
            await deps.selectFile(newNode);
          }

          return { success: true };
        } else {
          deps.setError(result.error || '创建笔记失败');
          return { success: false, exists: result.exists };
        }
      } catch (err) {
        logError('创建笔记失败', 'useNotes', err as Error);
        deps.setError('创建笔记失败');
        return { success: false };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const createNoteForce = useCallback(
    async (
      parentPath: string | null,
      name: string,
      mode: 'overwrite' | 'copy',
      content?: string
    ): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.createNoteForce(parentPath, name, mode, content);

        if (result.success) {
          await deps.refreshFileTree();

          if (result.path) {
            const finalName = name.endsWith('.md') ? name : `${name}.md`;
            const newNode: FileTreeNode = {
              id: result.path,
              name: finalName,
              type: 'file',
              path: result.path,
            };
            await deps.selectFile(newNode);
          }

          return true;
        } else {
          deps.setError(result.error || '创建笔记失败');
          return false;
        }
      } catch (err) {
        logError('强制创建笔记失败', 'useNotes', err as Error);
        deps.setError('创建笔记失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const renameItem = useCallback(
    async (oldPath: string, newName: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.renameItem(oldPath, newName);

        if (result.success) {
          await deps.refreshFileTree();

          // 同步标签页路径：标签只存路径，不同步会指向已不存在的旧路径；newPath 由主进程返回。
          if (result.newPath) {
            useNotesTabsStore.getState().renameTab(oldPath, result.newPath);
          }

          deps.setExpandedFolders((prev) => {
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

          deps.setPinnedFolders((prev) => {
            const next = prev.map((pinned) => {
              if (pinned.path === oldPath) {
                const newName = result.newPath!.split(/[/\\]/).pop() || pinned.name;
                return { path: result.newPath!, name: newName };
              }
              if (pinned.path.startsWith(oldPath + '/') || pinned.path.startsWith(oldPath + '\\')) {
                return { ...pinned, path: pinned.path.replace(oldPath, result.newPath!) };
              }
              return pinned;
            });
            localStorageService.set(STORAGE_KEYS.NOTES_PINNED_FOLDERS, next);
            return next;
          });

          if (deps.selectedFile?.path === oldPath && result.newPath) {
            deps.setSelectedFile({
              ...deps.selectedFile,
              id: result.newPath,
              name: path.basename(result.newPath),
              path: result.newPath,
            });
          } else if (deps.selectedFile?.path && result.newPath) {
            const sep = oldPath.includes('/') ? '/' : '\\';
            if (deps.selectedFile.path.startsWith(oldPath + sep)) {
              const newFilePath = deps.selectedFile.path.replace(oldPath, result.newPath);
              deps.setSelectedFile({
                ...deps.selectedFile,
                id: newFilePath,
                path: newFilePath,
              });
              localStorageService.setString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE, newFilePath);
            }
          }

          return true;
        } else {
          deps.setError(result.error || '重命名失败');
          return false;
        }
      } catch (err) {
        logError('重命名失败', 'useNotes', err as Error);
        deps.setError('重命名失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const deleteItem = useCallback(
    async (itemPath: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.deleteItem(itemPath);

        if (result.success) {
          await deps.refreshFileTree();

          if (deps.selectedFile?.path === itemPath) {
            deps.clearSelection();
          }

          deps.setPinnedFolders((prev) => {
            const next = prev.filter((pinned) => {
              return (
                pinned.path !== itemPath &&
                !pinned.path.startsWith(itemPath + '/') &&
                !pinned.path.startsWith(itemPath + '\\')
              );
            });
            localStorageService.set(STORAGE_KEYS.NOTES_PINNED_FOLDERS, next);
            return next;
          });

          return true;
        } else {
          deps.setError(result.error || '删除失败');
          return false;
        }
      } catch (err) {
        logError('删除失败', 'useNotes', err as Error);
        deps.setError('删除失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const moveItem = useCallback(
    async (itemPath: string, targetFolderPath: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.moveItem(itemPath, targetFolderPath);

        if (result.success && result.newPath) {
          await deps.refreshFileTree();

          if (deps.selectedFile?.path === itemPath) {
            const newName = itemPath.split(/[/\\]/).pop();
            deps.setSelectedFile({
              ...deps.selectedFile,
              id: result.newPath,
              name: newName || deps.selectedFile.name,
              path: result.newPath,
            });
            localStorageService.setString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE, result.newPath);
          }

          deps.setPinnedFolders((prev) => {
            const next = prev.map((pinned) => {
              if (pinned.path === itemPath) {
                const newName = result.newPath!.split(/[/\\]/).pop() || pinned.name;
                return { path: result.newPath!, name: newName };
              }
              if (pinned.path.startsWith(itemPath + '/') || pinned.path.startsWith(itemPath + '\\')) {
                return { ...pinned, path: pinned.path.replace(itemPath, result.newPath!) };
              }
              return pinned;
            });
            localStorageService.set(STORAGE_KEYS.NOTES_PINNED_FOLDERS, next);
            return next;
          });

          return true;
        } else {
          deps.setError(result.error || '移动失败');
          return false;
        }
      } catch (err) {
        logError('移动失败', 'useNotes', err as Error);
        deps.setError('移动失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const copyItem = useCallback(
    async (sourcePath: string): Promise<boolean> => {
      if (!window.electron) return false;
      try {
        const result = await window.electron.notes.copyItem(sourcePath);
        if (!result.success) {
          deps.setError(result.error || '复制失败');
          return false;
        }
        return true;
      } catch (err) {
        logError('复制文件失败', 'useNotes', err as Error);
        deps.setError('复制失败');
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const importDroppedFiles = useCallback(
    async (
      filePaths: string[],
      targetFolderPath?: string
    ): Promise<{ success: boolean; imported?: string[]; errors?: string[] }> => {
      const currentRoot = rootPathRef.current;
      if (!window.electron || !currentRoot) return { success: false, errors: ['未设置根目录'] };
      try {
        const dest = targetFolderPath || deps.currentViewPathRef.current || currentRoot;
        const result = await window.electron.notes.importDroppedFiles(dest, filePaths);
        if (result.success) {
          await deps.refreshFileTree();
          return { success: true, imported: result.imported, errors: result.errors };
        } else {
          deps.setError(result.error || '导入失败');
          return { success: false, errors: result.error ? [result.error] : result.errors };
        }
      } catch (err) {
        logError('拖入文件导入失败', 'useNotes', err as Error);
        deps.setError('导入失败');
        return { success: false, errors: ['导入失败'] };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return {
    createFolder,
    createFolderForce,
    createNote,
    createNoteForce,
    renameItem,
    deleteItem,
    moveItem,
    copyItem,
    importDroppedFiles,
  };
}