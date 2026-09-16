// NotesSidebar 交互编排：右键菜单 / 选中 / 拖拽 / 外部拖入与粘贴导入 / 对话框

import { useState, useEffect, useCallback } from 'react';
import { useToastStore } from '@/store/toastStore';
import { useNotesSidebarSectionsStore } from '@/store/notesSidebarSectionsStore';
import type { FileTreeNode } from '../types';
import type { NotesSidebarProps } from './sidebarTypes';

export type UseSidebarInteractionsParams = Pick<
  NotesSidebarProps,
  | 'rootPath'
  | 'selectedFile'
  | 'onCopyItem'
  | 'onMoveItem'
  | 'onImportDroppedFiles'
  | 'onCreateFolder'
  | 'onCreateFolderForce'
  | 'onCreateNote'
  | 'onCreateNoteForce'
  | 'onRenameItem'
  | 'onDeleteItem'
>;

export interface UseSidebarInteractionsReturn {
  contextMenu: { x: number; y: number; node?: FileTreeNode } | null;
  listSelection: string | null;
  isOrganizeExpanded: boolean;
  isDragOver: boolean;
  dragSourcePath: string | null;
  dragOverPath: string | null;
  pinnedDragIndex: number | null;
  pinnedDragOverIndex: number | null;
  pinnedContextMenu: { x: number; y: number; index: number } | null;
  createDialog: { type: 'folder' | 'note'; parentPath: string | null } | null;
  createName: string;
  existsDialog: { type: 'folder' | 'note'; name: string; parentPath: string | null } | null;
  renameDialog: { node: FileTreeNode } | null;
  renameName: string;
  deleteDialog: { node: FileTreeNode } | null;
  handleContextMenu: (e: React.MouseEvent, node?: FileTreeNode) => void;
  handleItemDragStart: (e: React.DragEvent, node: FileTreeNode) => void;
  handleItemDragOver: (e: React.DragEvent, node: FileTreeNode) => void;
  handleItemDrop: (e: React.DragEvent, node: FileTreeNode) => Promise<void>;
  handleItemDragEnd: () => void;
  handleAsideDragOver: (e: React.DragEvent) => void;
  handleAsideDragLeave: (e: React.DragEvent) => void;
  handleAsideDrop: (e: React.DragEvent) => Promise<void>;
  toggleOrganize: () => void;
  setListSelection: React.Dispatch<React.SetStateAction<string | null>>;
  setPinnedDragIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPinnedDragOverIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setPinnedContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; index: number } | null>>;
  openCreateDialog: (type: 'folder' | 'note', parentPath: string | null) => void;
  openRenameDialog: (node: FileTreeNode) => void;
  openDeleteDialog: (node: FileTreeNode) => void;
  closeContextMenu: () => void;
  handleCreateFolder: () => Promise<void>;
  handleCreateNote: () => Promise<void>;
  handleOverwriteFolder: () => Promise<void>;
  handleCreateFolderCopy: () => Promise<void>;
  handleOverwriteNote: () => Promise<void>;
  handleCreateNoteCopy: () => Promise<void>;
  handleRename: () => Promise<void>;
  handleConfirmDelete: () => Promise<void>;
  cancelCreateOrRename: () => void;
  cancelExists: () => void;
  cancelDelete: () => void;
  setCreateName: React.Dispatch<React.SetStateAction<string>>;
  setRenameName: React.Dispatch<React.SetStateAction<string>>;
}

export function useSidebarInteractions(
  params: UseSidebarInteractionsParams
): UseSidebarInteractionsReturn {
  const addToast = useToastStore((state) => state.addToast);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node?: FileTreeNode;
  } | null>(null);
  const [listSelection, setListSelection] = useState<string | null>(null);
  // 展开态持久化在 notesSidebarSectionsStore（与固定目录 / 收藏 / 最近一致）
  const isOrganizeExpanded = useNotesSidebarSectionsStore((state) => state.sections.organize);
  const toggleSection = useNotesSidebarSectionsStore((state) => state.toggleSection);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [pinnedDragIndex, setPinnedDragIndex] = useState<number | null>(null);
  const [pinnedDragOverIndex, setPinnedDragOverIndex] = useState<number | null>(null);
  const [pinnedContextMenu, setPinnedContextMenu] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);

  const [createDialog, setCreateDialog] = useState<{
    type: 'folder' | 'note';
    parentPath: string | null;
  } | null>(null);
  const [createName, setCreateName] = useState('');
  const [existsDialog, setExistsDialog] = useState<{
    type: 'folder' | 'note';
    name: string;
    parentPath: string | null;
  } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ node: FileTreeNode } | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ node: FileTreeNode } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, node?: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleItemDragStart = useCallback((e: React.DragEvent, node: FileTreeNode) => {
    setDragSourcePath(node.path);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
  }, []);
  const handleItemDragOver = useCallback(
    (e: React.DragEvent, node: FileTreeNode) => {
      if (!dragSourcePath) return;
      if (node.type !== 'folder') return;
      const sep = node.path.includes('\\') ? '\\' : '/';
      if (dragSourcePath === node.path || node.path.startsWith(dragSourcePath + sep)) return;
      if (dragSourcePath.substring(0, dragSourcePath.lastIndexOf(sep)) === node.path) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDragOverPath(node.path);
    },
    [dragSourcePath]
  );
  const handleItemDrop = useCallback(
    async (e: React.DragEvent, node: FileTreeNode) => {
      if (!dragSourcePath) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOverPath(null);
      const sourcePath = dragSourcePath;
      setDragSourcePath(null);
      if (sourcePath !== node.path) {
        const success = await params.onMoveItem(sourcePath, node.path);
        addToast({
          type: success ? 'success' : 'error',
          message: success ? '已移动到所选目录' : '移动失败',
        });
      }
    },
    [dragSourcePath, params, addToast]
  );
  const handleItemDragEnd = useCallback(() => {
    setDragSourcePath(null);
    setDragOverPath(null);
  }, []);

  const handleAsideDragOver = useCallback(
    (e: React.DragEvent) => {
      if (dragSourcePath || pinnedDragIndex !== null) {
        if (dragOverPath) setDragOverPath(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    [dragSourcePath, dragOverPath, pinnedDragIndex]
  );
  const handleAsideDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  const handleAsideDrop = useCallback(
    async (e: React.DragEvent) => {
      if (dragSourcePath || pinnedDragIndex !== null) {
        setDragSourcePath(null);
        setDragOverPath(null);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (!params.rootPath) {
        addToast({ type: 'error', message: '请先设置笔记存储路径' });
        return;
      }
      const filePaths: string[] = [];
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        for (const item of Array.from(items)) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file && window.electron?.getFileOrFolderPath) {
              const filePath = await window.electron.getFileOrFolderPath(file);
              if (filePath) filePaths.push(filePath);
            }
          }
        }
      } else {
        for (const file of Array.from(e.dataTransfer.files)) {
          if (window.electron?.getFileOrFolderPath) {
            const filePath = await window.electron.getFileOrFolderPath(file);
            if (filePath) filePaths.push(filePath);
          }
        }
      }
      if (filePaths.length === 0) {
        addToast({ type: 'error', message: '无法获取文件路径' });
        return;
      }
      const result = await params.onImportDroppedFiles(filePaths, listSelection ?? undefined);
      if (result.success) {
        const msg =
          result.imported && result.imported.length > 0
            ? `已导入 ${result.imported.length} 个文件`
            : '导入成功';
        addToast({ type: 'success', message: msg });
      } else {
        const msg = result.errors && result.errors.length > 0 ? result.errors[0] : '导入失败';
        addToast({ type: 'error', message: msg });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      params.rootPath,
      params.onImportDroppedFiles,
      addToast,
      listSelection,
      dragSourcePath,
      pinnedDragIndex,
    ]
  );

  // 键盘 Ctrl+C / 系统粘贴
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      if (isCtrlOrMeta && e.key === 'c') {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) return;
        if (listSelection) {
          e.preventDefault();
          const itemName = listSelection.split(/[/\\]/).pop() || listSelection;
          const success = await params.onCopyItem(listSelection);
          addToast({
            type: success ? 'success' : 'error',
            message: success ? `已复制「${itemName}」到剪贴板` : `复制「${itemName}」失败`,
          });
        }
      }
    },
    [listSelection, params, addToast]
  );
  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      )
        return;
      if (!params.rootPath) return;
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;
      const filePaths: string[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && window.electron?.getFileOrFolderPath) {
            const filePath = await window.electron.getFileOrFolderPath(file);
            if (filePath) filePaths.push(filePath);
          }
        }
      }
      if (filePaths.length > 0) {
        e.preventDefault();
        const result = await params.onImportDroppedFiles(filePaths, listSelection ?? undefined);
        addToast({
          type: result.success ? 'success' : 'error',
          message: result.success ? '已粘贴到当前目录' : '粘贴失败',
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.rootPath, params.onImportDroppedFiles, addToast, listSelection]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleKeyDown, handlePaste]);

  useEffect(() => {
    if (params.selectedFile) setListSelection(params.selectedFile.path);
    else setListSelection(null);
  }, [params.selectedFile]);

  const openCreateDialog = useCallback((type: 'folder' | 'note', parentPath: string | null) => {
    setCreateDialog({ type, parentPath });
    setCreateName('');
  }, []);
  const openRenameDialog = useCallback((node: FileTreeNode) => {
    setRenameDialog({ node });
    setRenameName(node.name);
  }, []);
  const openDeleteDialog = useCallback((node: FileTreeNode) => {
    setDeleteDialog({ node });
  }, []);

  const cancelCreateOrRename = useCallback(() => {
    setCreateDialog(null);
    setCreateName('');
    setRenameDialog(null);
    setRenameName('');
  }, []);
  const cancelExists = useCallback(() => {
    setExistsDialog(null);
    setCreateDialog(null);
  }, []);
  const cancelDelete = useCallback(() => {
    setDeleteDialog(null);
  }, []);

  const handleCreateFolder = useCallback(async () => {
    const parentPath = createDialog?.parentPath ?? null;
    const name = createName;
    const result = await params.onCreateFolder(parentPath, name);
    if (result.exists) setExistsDialog({ type: 'folder', name, parentPath });
    else {
      setCreateDialog(null);
      setCreateName('');
    }
  }, [createDialog, createName, params]);
  const handleCreateNote = useCallback(async () => {
    const parentPath = createDialog?.parentPath ?? null;
    const name = createName;
    const result = await params.onCreateNote(parentPath, name);
    if (result.exists) setExistsDialog({ type: 'note', name, parentPath });
    else {
      setCreateDialog(null);
      setCreateName('');
    }
  }, [createDialog, createName, params]);
  const handleOverwriteFolder = useCallback(async () => {
    if (existsDialog) {
      await params.onCreateFolderForce(existsDialog.parentPath, existsDialog.name, 'overwrite');
      setExistsDialog(null);
      setCreateDialog(null);
    }
  }, [existsDialog, params]);
  const handleCreateFolderCopy = useCallback(async () => {
    if (existsDialog) {
      await params.onCreateFolderForce(existsDialog.parentPath, existsDialog.name, 'copy');
      setExistsDialog(null);
      setCreateDialog(null);
    }
  }, [existsDialog, params]);
  const handleOverwriteNote = useCallback(async () => {
    if (existsDialog) {
      await params.onCreateNoteForce(existsDialog.parentPath, existsDialog.name, 'overwrite');
      setExistsDialog(null);
      setCreateDialog(null);
    }
  }, [existsDialog, params]);
  const handleCreateNoteCopy = useCallback(async () => {
    if (existsDialog) {
      await params.onCreateNoteForce(existsDialog.parentPath, existsDialog.name, 'copy');
      setExistsDialog(null);
      setCreateDialog(null);
    }
  }, [existsDialog, params]);
  const handleRename = useCallback(async () => {
    if (renameDialog) {
      await params.onRenameItem(renameDialog.node.path, renameName);
      setRenameDialog(null);
      setRenameName('');
    }
  }, [renameDialog, renameName, params]);
  const handleConfirmDelete = useCallback(async () => {
    if (deleteDialog) {
      await params.onDeleteItem(deleteDialog.node.path);
      setDeleteDialog(null);
    }
  }, [deleteDialog, params]);

  return {
    contextMenu,
    listSelection,
    isOrganizeExpanded,
    isDragOver,
    dragSourcePath,
    dragOverPath,
    pinnedDragIndex,
    pinnedDragOverIndex,
    pinnedContextMenu,
    createDialog,
    createName,
    existsDialog,
    renameDialog,
    renameName,
    deleteDialog,
    handleContextMenu,
    handleItemDragStart,
    handleItemDragOver,
    handleItemDrop,
    handleItemDragEnd,
    handleAsideDragOver,
    handleAsideDragLeave,
    handleAsideDrop,
    toggleOrganize: () => toggleSection('organize'),
    setListSelection,
    setPinnedDragIndex,
    setPinnedDragOverIndex,
    setPinnedContextMenu,
    openCreateDialog,
    openRenameDialog,
    openDeleteDialog,
    closeContextMenu,
    handleCreateFolder,
    handleCreateNote,
    handleOverwriteFolder,
    handleCreateFolderCopy,
    handleOverwriteNote,
    handleCreateNoteCopy,
    handleRename,
    handleConfirmDelete,
    cancelCreateOrRename,
    cancelExists,
    cancelDelete,
    setCreateName,
    setRenameName,
  };
}