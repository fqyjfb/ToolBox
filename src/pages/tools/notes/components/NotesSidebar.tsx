import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FolderOpen, Folder, FileText, ChevronRight, RefreshCw, FolderPlus, FilePlus, Edit, Trash2, RotateCcw, ExternalLink, MessageCircle, Table2, FileImage, Code, MoveRight, Pin, MessageSquare, Plus, Trash } from 'lucide-react';
import ContextMenu, { ContextMenuItem, SubMenuItem } from '@/components/ui/ContextMenu';
import { useToastStore } from '@/store/toastStore';
import type { PinnedFolder } from '@/hooks/useNotes';

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

interface NotesSidebarProps {
  fileTree: FileTreeNode[];
  rootPath: string | null;
  selectedFile: FileTreeNode | null;
  onSelectFile: (file: FileTreeNode) => void;
  onToggleFolder: (folderPath: string) => void;
  onCreateFolder: (parentPath: string | null, name: string) => Promise<{ success: boolean; exists?: boolean }>;
  onCreateFolderForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<boolean>;
  onCreateNote: (parentPath: string | null, name: string) => Promise<{ success: boolean; exists?: boolean }>;
  onCreateNoteForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<boolean>;
  onRenameItem: (oldPath: string, newName: string) => Promise<boolean>;
  onDeleteItem: (itemPath: string) => Promise<boolean>;
  onMoveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  onRefresh: () => void;
  onRebuildIndex?: () => Promise<void>;
  loading: boolean;
  isChatMode: boolean;
  onToggleChatMode: () => void;
  chatOrganizePath?: string | null;
  onSelectOrganizeFolder?: () => void;
  onCopyItem: (sourcePath: string) => Promise<boolean>;
  onImportDroppedFiles: (filePaths: string[], targetFolderPath?: string) => Promise<{ success: boolean; imported?: string[]; errors?: string[] }>;
  pinnedFolders: PinnedFolder[];
  currentViewPath: string | null;
  onAddPinnedFolder: () => Promise<boolean>;
  onRemovePinnedFolder: (folderPath: string) => void;
  onReorderPinnedFolder: (fromIndex: number, toIndex: number) => void;
  onSwitchToFolder: (folderPath: string) => Promise<void>;
  onSetChatPath: () => Promise<boolean>;
  chatPath: string | null;
  chatOrganizeTree: FileTreeNode[];
}

const FileTreeItem: React.FC<{
  node: FileTreeNode;
  depth: number;
  selectedFile: FileTreeNode | null;
  listSelection: string | null;
  onSelectFile: (file: FileTreeNode) => void;
  onSelectItem: (path: string) => void;
  onToggleFolder: (folderPath: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  onItemDragStart: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDragOver: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDrop: (e: React.DragEvent, node: FileTreeNode) => void;
  onItemDragEnd: () => void;
  dragOverPath: string | null;
  dragSourcePath: string | null;
}> = ({
  node,
  depth,
  selectedFile,
  listSelection,
  onSelectFile,
  onSelectItem,
  onToggleFolder,
  onContextMenu,
  onItemDragStart,
  onItemDragOver,
  onItemDrop,
  onItemDragEnd,
  dragOverPath,
  dragSourcePath,
}) => {
  const isExpanded = node.expanded ?? false;
  const isSelected = selectedFile?.path === node.path;
  const isListSelected = listSelection === node.path;
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && itemRef.current) {
      requestAnimationFrame(() => {
        itemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
  }, [isSelected]);

  const handleClick = () => {
    onSelectItem(node.path);
    if (node.type === 'folder') {
      onToggleFolder(node.path);
    } else {
      onSelectFile(node);
    }
  };

  return (
    <>
      <div
        ref={itemRef}
        className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${
          isSelected || isListSelected
            ? 'bg-primary text-button-text'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        } ${dragOverPath === node.path ? '!ring-2 !ring-primary' : ''} ${dragSourcePath === node.path ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        title={node.path}
        draggable
        onDragStart={(e) => onItemDragStart(e, node)}
        onDragEnd={onItemDragEnd}
        onDragOver={node.type === 'folder' ? (e) => onItemDragOver(e, node) : undefined}
        onDrop={node.type === 'folder' ? (e) => onItemDrop(e, node) : undefined}
      >
        {node.type === 'folder' && (
          <ChevronRight
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        )}

        {node.type === 'folder' ? (
          isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
        ) : (
          <>
            {node.fileType === 'docx' && <FileText className="w-4 h-4 text-blue-600" />}
            {node.fileType === 'xlsx' && <Table2 className="w-4 h-4 text-green-600" />}
            {node.fileType === 'image' && <FileImage className="w-4 h-4 text-purple-600" />}
            {node.fileType === 'txt' && <FileText className="w-4 h-4 text-gray-500" />}
            {node.fileType === 'html' && <Code className="w-4 h-4 text-orange-500" />}
            {node.fileType === 'json' && <Code className="w-4 h-4 text-yellow-600" />}
            {(!node.fileType || node.fileType === 'md') && <FileText className="w-4 h-4" />}
          </>
        )}

        <span className="flex-1 truncate text-sm">{node.name}</span>
      </div>

      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
          <FileTreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedFile={selectedFile}
            listSelection={listSelection}
            onSelectFile={onSelectFile}
            onSelectItem={onSelectItem}
            onToggleFolder={onToggleFolder}
            onContextMenu={onContextMenu}
            onItemDragStart={onItemDragStart}
            onItemDragOver={onItemDragOver}
            onItemDrop={onItemDrop}
            onItemDragEnd={onItemDragEnd}
            dragOverPath={dragOverPath}
            dragSourcePath={dragSourcePath}
          />
        ))}
        </div>
      )}
    </>
  );
};

const CreateDialog: React.FC<{
  type: 'folder' | 'note';
  onConfirm: () => void;
  onCancel: () => void;
  initialName?: string;
  onNameChange?: (name: string) => void;
}> = ({ type, onConfirm, onCancel, initialName = '', onNameChange }) => {
  const [name, setName] = useState(initialName);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm();
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    onNameChange?.(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-80 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {type === 'folder' ? '新建文件夹' : '新建笔记'}
        </h3>

        <input
          type="text"
          className="mb-4 w-full rounded-lg bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary/30 focus:outline-none"
          placeholder={type === 'folder' ? '文件夹名称' : '笔记名称'}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
            if (e.key === 'Escape') onCancel();
          }}
        />

        <div className="flex justify-end gap-2">
          <button
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-button-text hover:bg-primary-hover"
            onClick={handleConfirm}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
};

const ExistsConfirmDialog: React.FC<{
  type: 'folder' | 'note';
  name: string;
  onOverwrite: () => void;
  onCreateCopy: () => void;
  onCancel: () => void;
}> = ({ type, name, onOverwrite, onCreateCopy, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          {type === 'folder' ? '文件夹已存在' : '文件已存在'}
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          {type === 'folder'
            ? `文件夹 "${name}" 已存在，请选择操作：`
            : `文件 "${name}" 已存在，请选择操作：`}
        </p>

        <div className="flex flex-col gap-2">
          <button
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-button-text hover:bg-primary-hover"
            onClick={onOverwrite}
          >
            覆盖原有{type === 'folder' ? '文件夹' : '文件'}
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onCreateCopy}
          >
            创建副本
          </button>
          <button
            className="w-full rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmDialog: React.FC<{
  type: 'folder' | 'file';
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ type, name, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-xl bg-white dark:bg-gray-800 p-4 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
          确认删除
        </h3>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          {type === 'folder'
            ? `确定要删除文件夹 "${name}" 及其所有内容吗？此操作不可撤销。`
            : `确定要删除文件 "${name}" 吗？此操作不可撤销。`}
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="rounded-lg bg-error px-3 py-1.5 text-sm text-white hover:bg-error/80"
            onClick={onConfirm}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
};

const NotesSidebar: React.FC<NotesSidebarProps> = ({
  fileTree,
  rootPath,
  selectedFile,
  onSelectFile,
  onToggleFolder,
  onCreateFolder,
  onCreateFolderForce,
  onCreateNote,
  onCreateNoteForce,
  onRenameItem,
  onDeleteItem,
  onMoveItem,
  onRefresh,
  onRebuildIndex,
  loading,
  isChatMode,
  onToggleChatMode,
  chatOrganizePath,
  onSelectOrganizeFolder,
  onCopyItem,
  onImportDroppedFiles,
  pinnedFolders,
  currentViewPath,
  onAddPinnedFolder,
  onRemovePinnedFolder,
  onReorderPinnedFolder,
  onSwitchToFolder,
  onSetChatPath,
  chatPath,
  chatOrganizeTree,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node?: FileTreeNode;
  } | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [listSelection, setListSelection] = useState<string | null>(null);
  const [isOrganizeExpanded, setIsOrganizeExpanded] = useState(false);
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
  const addToast = useToastStore(state => state.addToast);

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

  const [renameDialog, setRenameDialog] = useState<{
    node: FileTreeNode;
  } | null>(null);
  const [renameName, setRenameName] = useState('');

  const [deleteDialog, setDeleteDialog] = useState<{
    node: FileTreeNode;
  } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, node?: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleCreateFolder = async () => {
    const parentPath = createDialog?.parentPath ?? null;
    const name = createName;
    const result = await onCreateFolder(parentPath, name);

    if (result.exists) {
      setExistsDialog({ type: 'folder', name, parentPath });
    } else {
      setCreateDialog(null);
      setCreateName('');
    }
  };

  const handleCreateNote = async () => {
    const parentPath = createDialog?.parentPath ?? null;
    const name = createName;
    const result = await onCreateNote(parentPath, name);

    if (result.exists) {
      setExistsDialog({ type: 'note', name, parentPath });
    } else {
      setCreateDialog(null);
      setCreateName('');
    }
  };

  const handleOverwriteFolder = async () => {
    if (existsDialog) {
      await onCreateFolderForce(
        existsDialog.parentPath,
        existsDialog.name,
        'overwrite'
      );
      setExistsDialog(null);
      setCreateDialog(null);
    }
  };

  const handleCreateFolderCopy = async () => {
    if (existsDialog) {
      await onCreateFolderForce(
        existsDialog.parentPath,
        existsDialog.name,
        'copy'
      );
      setExistsDialog(null);
      setCreateDialog(null);
    }
  };

  const handleOverwriteNote = async () => {
    if (existsDialog) {
      await onCreateNoteForce(
        existsDialog.parentPath,
        existsDialog.name,
        'overwrite'
      );
      setExistsDialog(null);
      setCreateDialog(null);
    }
  };

  const handleCreateNoteCopy = async () => {
    if (existsDialog) {
      await onCreateNoteForce(
        existsDialog.parentPath,
        existsDialog.name,
        'copy'
      );
      setExistsDialog(null);
      setCreateDialog(null);
    }
  };

  const handleRename = async () => {
    if (renameDialog) {
      await onRenameItem(renameDialog.node.path, renameName);
      setRenameDialog(null);
      setRenameName('');
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteDialog) {
      await onDeleteItem(deleteDialog.node.path);
      setDeleteDialog(null);
    }
  };

  const handleRebuildIndex = async () => {
    if (!onRebuildIndex || isRebuilding) return;
    setIsRebuilding(true);
    try {
      await onRebuildIndex();
    } finally {
      setIsRebuilding(false);
    }
  };

  const findNodeInTree = useCallback((nodes: FileTreeNode[], path: string): FileTreeNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeInTree(node.children, path);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const handleKeyDown = useCallback(async (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    if (isCtrlOrMeta && e.key === 'c') {
      if (listSelection) {
        e.preventDefault();
        const success = await onCopyItem(listSelection);
        addToast({ type: success ? 'success' : 'error', message: success ? '已复制到剪贴板' : '复制失败' });
      }
    }
  }, [listSelection, onCopyItem, addToast]);

  const getTargetFolderPath = useCallback((): string | undefined => {
    if (!listSelection) return undefined;
    const node = findNodeInTree(fileTree, listSelection);
    if (!node) return undefined;
    if (node.type === 'folder') return node.path;
    const separator = node.path.includes('\\') ? '\\' : '/';
    const lastSep = node.path.lastIndexOf(separator);
    if (lastSep > 0) return node.path.substring(0, lastSep);
    return undefined;
  }, [listSelection, fileTree, findNodeInTree]);

  const handleItemDragStart = useCallback((e: React.DragEvent, node: FileTreeNode) => {
    setDragSourcePath(node.path);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.path);
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent, node: FileTreeNode) => {
    if (!dragSourcePath) return;
    if (node.type !== 'folder') return;
    const sep = node.path.includes('\\') ? '\\' : '/';
    if (dragSourcePath === node.path || node.path.startsWith(dragSourcePath + sep)) return;
    if (dragSourcePath.substring(0, dragSourcePath.lastIndexOf(sep)) === node.path) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPath(node.path);
  }, [dragSourcePath]);

  const handleItemDrop = useCallback(async (e: React.DragEvent, node: FileTreeNode) => {
    if (!dragSourcePath) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverPath(null);
    const sourcePath = dragSourcePath;
    setDragSourcePath(null);
    if (sourcePath !== node.path) {
      const success = await onMoveItem(sourcePath, node.path);
      addToast({ type: success ? 'success' : 'error', message: success ? '已移动到所选目录' : '移动失败' });
    }
  }, [dragSourcePath, onMoveItem, addToast]);

  const handleItemDragEnd = useCallback(() => {
    setDragSourcePath(null);
    setDragOverPath(null);
  }, []);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (!rootPath) return;

    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const filePaths: string[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && window.electron?.getFileOrFolderPath) {
          const filePath = await window.electron.getFileOrFolderPath(file);
          if (filePath) {
            filePaths.push(filePath);
          }
        }
      }
    }

    if (filePaths.length > 0) {
      e.preventDefault();
      const result = await onImportDroppedFiles(filePaths, getTargetFolderPath());
      addToast({ type: result.success ? 'success' : 'error', message: result.success ? '已粘贴到当前目录' : '粘贴失败' });
    }
  }, [rootPath, onImportDroppedFiles, addToast, getTargetFolderPath]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [handleKeyDown, handlePaste]);

  useEffect(() => {
    if (selectedFile) {
      setListSelection(selectedFile.path);
    } else {
      setListSelection(null);
    }
  }, [selectedFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (dragSourcePath || pinnedDragIndex !== null) {
      if (dragOverPath) setDragOverPath(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, [dragSourcePath, dragOverPath, pinnedDragIndex]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    if (dragSourcePath || pinnedDragIndex !== null) {
      setDragSourcePath(null);
      setDragOverPath(null);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!rootPath) {
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
            if (filePath) {
              filePaths.push(filePath);
            }
          }
        }
      }
    } else {
      for (const file of Array.from(e.dataTransfer.files)) {
        if (window.electron?.getFileOrFolderPath) {
          const filePath = await window.electron.getFileOrFolderPath(file);
          if (filePath) {
            filePaths.push(filePath);
          }
        }
      }
    }

    if (filePaths.length === 0) {
      addToast({ type: 'error', message: '无法获取文件路径' });
      return;
    }

    const result = await onImportDroppedFiles(filePaths, getTargetFolderPath());
    if (result.success) {
      const msg = result.imported && result.imported.length > 0
        ? `已导入 ${result.imported.length} 个文件`
        : '导入成功';
      addToast({ type: 'success', message: msg });
    } else {
      const msg = result.errors && result.errors.length > 0
        ? result.errors[0]
        : '导入失败';
      addToast({ type: 'error', message: msg });
    }
  }, [rootPath, onImportDroppedFiles, addToast, getTargetFolderPath, dragSourcePath, pinnedDragIndex]);

  const getFoldersFromTree = useCallback((nodes: FileTreeNode[], excludePath?: string): { path: string; label: string }[] => {
    const folders: { path: string; label: string }[] = [];
    const walk = (list: FileTreeNode[], depth: number) => {
      for (const n of list) {
        if (n.type === 'folder' && n.path !== excludePath) {
          const indent = '　'.repeat(depth);
          folders.push({ path: n.path, label: `${indent}${n.name}` });
          if (n.children) walk(n.children, depth + 1);
        }
      }
    };
    walk(nodes, 0);
    return folders;
  }, []);

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];
    
    const items: ContextMenuItem[] = [];
    const node = contextMenu.node;
    
    const getParentPath = (): string | null => {
      if (!node) return null;
      if (node.type === 'folder') return node.path;
      const separator = node.path.includes('\\') ? '\\' : '/';
      const pathParts = node.path.split(separator);
      pathParts.pop();
      return pathParts.join(separator) || null;
    };
    
    items.push({
      id: 'create-note',
      label: '新建笔记',
      icon: <FilePlus className="w-4 h-4" />,
      onClick: () => {
        setCreateDialog({ type: 'note', parentPath: getParentPath() });
        setCreateName('');
        setContextMenu(null);
      },
    });
    
    items.push({
      id: 'create-folder',
      label: '新建文件夹',
      icon: <FolderPlus className="w-4 h-4" />,
      onClick: () => {
        setCreateDialog({ type: 'folder', parentPath: getParentPath() });
        setCreateName('');
        setContextMenu(null);
      },
    });
    
    if (node) {
      items.push({
        id: 'divider1',
        divider: true,
      });

      const allFolders = getFoldersFromTree(fileTree, node.path);
      const separator = node.path.includes('\\') ? '\\' : '/';
      const nodeParentPath = node.path.includes(separator) ? node.path.substring(0, node.path.lastIndexOf(separator)) : null;
      const normalizedRootPath = rootPath ? rootPath.replace(/[\\/]+$/, '') : null;
      const normalizedParentPath = nodeParentPath ? nodeParentPath.replace(/[\\/]+$/, '') : null;
      const normalizedNodePath = node.path.replace(/[\\/]+$/, '');

      const moveSubItems: SubMenuItem[] = [];

      if (normalizedRootPath && normalizedParentPath !== normalizedRootPath && normalizedRootPath !== normalizedNodePath) {
        moveSubItems.push({
          id: `move-to-root`,
          label: '根目录',
          onClick: async () => {
            const success = await onMoveItem(node.path, normalizedRootPath);
            if (success) setContextMenu(null);
          },
        });
      }

      allFolders.forEach((folder) => {
        moveSubItems.push({
          id: `move-to-${folder.path}`,
          label: folder.label,
          onClick: async () => {
            const success = await onMoveItem(node.path, folder.path);
            if (success) setContextMenu(null);
          },
        });
      });

      items.push({
        id: 'move',
        label: '移动',
        icon: <MoveRight className="w-4 h-4" />,
        subMenu: moveSubItems.length > 0 ? moveSubItems : undefined,
        onClick: () => {},
      });

      items.push({
        id: 'open-in-folder',
        label: '打开位置',
        icon: <ExternalLink className="w-4 h-4" />,
        onClick: () => {
          window.electron?.notes.openFileInFolder(node.path);
          setContextMenu(null);
        },
      });
      
      items.push({
        id: 'rename',
        label: '重命名',
        icon: <Edit className="w-4 h-4" />,
        onClick: () => {
          setRenameDialog({ node });
          setRenameName(node.name);
          setContextMenu(null);
        },
      });
      
      items.push({
        id: 'delete',
        label: '删除',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => {
          setDeleteDialog({ node });
          setContextMenu(null);
        },
        className: 'text-error hover:bg-error/10 dark:hover:bg-error/20',
      });
    }
    
    return items;
  };

  return (
    <aside
      className={`flex h-full w-48 flex-shrink-0 flex-col bg-white dark:bg-gray-900 ${isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 pointer-events-none">
          <div className="rounded-lg bg-white dark:bg-gray-800 px-4 py-2 text-sm text-primary shadow-lg">
            释放以导入文件
          </div>
        </div>
      )}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={onRefresh}
            disabled={loading}
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onRebuildIndex && (
            <button
              className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={handleRebuildIndex}
              disabled={isRebuilding}
              title="重建索引"
            >
              <RotateCcw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={onAddPinnedFolder}
            disabled={loading}
            title="添加固定目录"
          >
            <Pin className="w-4 h-4" />
          </button>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={onSetChatPath}
            disabled={loading}
            title={chatPath ? `对话路径: ${chatPath}` : '设置对话路径'}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() =>
              setCreateDialog({ type: 'folder', parentPath: currentViewPath })
            }
            title="新建文件夹"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setCreateDialog({ type: 'note', parentPath: currentViewPath })}
            title="新建笔记"
          >
            <FilePlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 py-2 space-y-1">
        <div
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${
            isChatMode
              ? 'bg-primary/10 text-primary'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={onToggleChatMode}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="flex-1 truncate text-sm">对话</span>
        </div>

        {chatOrganizePath && chatOrganizeTree.length > 0 && (() => {
          const organizeNode = chatOrganizeTree[0];
          const organizeChildren = organizeNode?.children || [];
          return (
            <div>
              <div
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => {
                  setIsOrganizeExpanded(!isOrganizeExpanded);
                  if (!isOrganizeExpanded) {
                    onSelectOrganizeFolder?.();
                  }
                }}
                title={chatOrganizePath}
              >
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${isOrganizeExpanded ? 'rotate-90' : ''}`}
                />
                <Folder className="w-4 h-4" />
                <span className="flex-1 truncate text-sm">对话整理</span>
              </div>
              {isOrganizeExpanded && organizeChildren.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {organizeChildren.map((child) => (
                    <FileTreeItem
                      key={child.id}
                      node={child}
                      depth={1}
                      selectedFile={selectedFile}
                      listSelection={listSelection}
                      onSelectFile={onSelectFile}
                      onSelectItem={setListSelection}
                      onToggleFolder={onToggleFolder}
                      onContextMenu={handleContextMenu}
                      onItemDragStart={handleItemDragStart}
                      onItemDragOver={handleItemDragOver}
                      onItemDrop={handleItemDrop}
                      onItemDragEnd={handleItemDragEnd}
                      dragOverPath={dragOverPath}
                      dragSourcePath={dragSourcePath}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {pinnedFolders.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 py-2">
          <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-gray-400">
            <Pin className="w-3 h-3" />
            <span>固定目录</span>
          </div>
          <div className="space-y-0.5">
            {pinnedFolders.map((pinned, index) => (
              <div
                key={pinned.path}
                draggable
                className={`group flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 transition-colors ${
                  currentViewPath === pinned.path
                    ? 'bg-accent/10 text-accent border-l-2 border-accent'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border-l-2 border-transparent'
                } ${pinnedDragOverIndex === index && pinnedDragIndex !== index ? 'ring-2 ring-accent' : ''} ${pinnedDragIndex === index ? 'opacity-50' : ''}`}
                onClick={() => onSwitchToFolder(pinned.path)}
                onDragStart={(e) => {
                  setPinnedDragIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(index));
                }}
                onDragOver={(e) => {
                  if (pinnedDragIndex === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (pinnedDragOverIndex !== index) setPinnedDragOverIndex(index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (pinnedDragIndex !== null && pinnedDragIndex !== index) {
                    onReorderPinnedFolder(pinnedDragIndex, index);
                  }
                  setPinnedDragIndex(null);
                  setPinnedDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setPinnedDragIndex(null);
                  setPinnedDragOverIndex(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setPinnedContextMenu({ x: e.clientX, y: e.clientY, index });
                }}
                title={pinned.path}
              >
                <Folder className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate text-sm">{pinned.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pinnedContextMenu && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={() => setPinnedContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setPinnedContextMenu(null); }}
          />
          <div
            className="fixed z-50 min-w-[120px] rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
            style={{ left: pinnedContextMenu.x, top: pinnedContextMenu.y }}
          >
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={() => {
                setPinnedContextMenu(null);
                onAddPinnedFolder();
              }}
            >
              <Plus className="w-4 h-4" />
              <span>添加固定目录</span>
            </button>
            <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
            <button
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-error hover:bg-error/10"
              onClick={() => {
                const p = pinnedFolders[pinnedContextMenu.index];
                if (p) {
                  onRemovePinnedFolder(p.path);
                  addToast({ type: 'success', message: `已移除固定目录: ${p.name}` });
                }
                setPinnedContextMenu(null);
              }}
            >
              <Trash className="w-4 h-4" />
              <span>移除</span>
            </button>
          </div>
        </>
      )}

      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 scrollbar-hide border-t border-gray-100 dark:border-gray-800"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('.cursor-pointer')) return;
          handleContextMenu(e);
        }}
      >
        {fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <FolderOpen className="mb-2 h-12 w-12" />
            <span className="text-sm">暂无笔记</span>
            <span className="text-xs">点击上方按钮创建</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {fileTree
              .filter((node) => node.path !== chatOrganizePath)
              .map((node) => (
                <FileTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedFile={selectedFile}
                  listSelection={listSelection}
                  onSelectFile={onSelectFile}
                  onSelectItem={setListSelection}
                  onToggleFolder={onToggleFolder}
                  onContextMenu={handleContextMenu}
                  onItemDragStart={handleItemDragStart}
                  onItemDragOver={handleItemDragOver}
                  onItemDrop={handleItemDrop}
                  onItemDragEnd={handleItemDragEnd}
                  dragOverPath={dragOverPath}
                  dragSourcePath={dragSourcePath}
                />
              ))}
          </div>
        )}
      </div>

      <ContextMenu
        isOpen={!!contextMenu}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        items={getContextMenuItems()}
        onClose={() => setContextMenu(null)}
      />

      {createDialog && (
        <CreateDialog
          type={createDialog.type}
          onConfirm={
            createDialog.type === 'folder'
              ? handleCreateFolder
              : handleCreateNote
          }
          onCancel={() => { setCreateDialog(null); setCreateName(''); }}
          initialName={createName}
          onNameChange={setCreateName}
        />
      )}

      {renameDialog && (
        <CreateDialog
          type="note"
          onConfirm={handleRename}
          onCancel={() => { setRenameDialog(null); setRenameName(''); }}
          initialName={renameName}
          onNameChange={setRenameName}
        />
      )}

      {existsDialog && (
        <ExistsConfirmDialog
          type={existsDialog.type}
          name={existsDialog.name}
          onOverwrite={
            existsDialog.type === 'folder'
              ? handleOverwriteFolder
              : handleOverwriteNote
          }
          onCreateCopy={
            existsDialog.type === 'folder'
              ? handleCreateFolderCopy
              : handleCreateNoteCopy
          }
          onCancel={() => {
            setExistsDialog(null);
            setCreateDialog(null);
          }}
        />
      )}

      {deleteDialog && (
        <DeleteConfirmDialog
          type={deleteDialog.node.type}
          name={deleteDialog.node.name}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteDialog(null)}
        />
      )}
    </aside>
  );
};

export { CreateDialog };
export default NotesSidebar;