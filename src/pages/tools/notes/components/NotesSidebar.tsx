import React, { useState, useRef, useEffect } from 'react';
import { FolderOpen, Folder, FileText, ChevronRight, RefreshCw, FolderPlus, FilePlus, Edit, Trash2, RotateCcw, ExternalLink, MessageCircle } from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '@/components/ui/ContextMenu';

export interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
  expanded?: boolean;
  active?: boolean;
}

interface NotesSidebarProps {
  fileTree: FileTreeNode[];
  selectedFile: FileTreeNode | null;
  onSelectFile: (file: FileTreeNode) => void;
  onToggleFolder: (folderPath: string) => void;
  onCreateFolder: (parentPath: string | null, name: string) => Promise<{ success: boolean; exists?: boolean }>;
  onCreateFolderForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<boolean>;
  onCreateNote: (parentPath: string | null, name: string) => Promise<{ success: boolean; exists?: boolean }>;
  onCreateNoteForce: (parentPath: string | null, name: string, mode: 'overwrite' | 'copy') => Promise<boolean>;
  onRenameItem: (oldPath: string, newName: string) => Promise<boolean>;
  onDeleteItem: (itemPath: string) => Promise<boolean>;
  onRefresh: () => void;
  onRebuildIndex?: () => Promise<void>;
  onChangeFolder?: () => Promise<boolean>;
  loading: boolean;
  isChatMode: boolean;
  onToggleChatMode: () => void;
}

const FileTreeItem: React.FC<{
  node: FileTreeNode;
  depth: number;
  selectedFile: FileTreeNode | null;
  onSelectFile: (file: FileTreeNode) => void;
  onToggleFolder: (folderPath: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
}> = ({
  node,
  depth,
  selectedFile,
  onSelectFile,
  onToggleFolder,
  onContextMenu,
}) => {
  const isExpanded = node.expanded ?? false;
  const isSelected = selectedFile?.path === node.path;
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
          isSelected
            ? 'border-l-2 border-primary bg-primary/10 text-primary'
            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
        title={node.path}
      >
        {node.type === 'folder' && (
          <ChevronRight
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
        )}

        {node.type === 'folder' ? (
          isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
        ) : (
          <FileText className="w-4 h-4" />
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
              onSelectFile={onSelectFile}
              onToggleFolder={onToggleFolder}
              onContextMenu={onContextMenu}
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
      <div className="w-80 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-xl">
        <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {type === 'folder' ? '新建文件夹' : '新建笔记'}
        </h3>

        <input
          type="text"
          className="mb-4 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-primary focus:outline-none"
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
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover"
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
      <div className="w-96 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-xl">
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
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary-hover"
            onClick={onOverwrite}
          >
            覆盖原有{type === 'folder' ? '文件夹' : '文件'}
          </button>
          <button
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
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
      <div className="w-96 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-4 shadow-xl">
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
  selectedFile,
  onSelectFile,
  onToggleFolder,
  onCreateFolder,
  onCreateFolderForce,
  onCreateNote,
  onCreateNoteForce,
  onRenameItem,
  onDeleteItem,
  onRefresh,
  onRebuildIndex,
  onChangeFolder,
  loading,
  isChatMode,
  onToggleChatMode,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node?: FileTreeNode;
  } | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);

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

  const getContextMenuItems = (): ContextMenuItem[] => {
    if (!contextMenu) return [];
    
    const items: ContextMenuItem[] = [];
    const node = contextMenu.node;
    
    const getParentPath = (): string | null => {
      if (!node) return null;
      if (node.type === 'folder') return node.path;
      const pathParts = node.path.split('/');
      pathParts.pop();
      return pathParts.join('/') || null;
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
    <aside className="flex h-full w-48 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-600 p-3">
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
          {onChangeFolder && (
            <button
              className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              onClick={onChangeFolder}
              disabled={loading}
              title="切换目录"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          )}
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() =>
              setCreateDialog({ type: 'folder', parentPath: null })
            }
            title="新建文件夹"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
          <button
            className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => setCreateDialog({ type: 'note', parentPath: null })}
            title="新建笔记"
          >
            <FilePlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 scrollbar-hide"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('.cursor-pointer')) return;
          handleContextMenu(e);
        }}
      >
        <div
          className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 mb-2 transition-colors ${
            isChatMode
              ? 'border-l-2 border-primary bg-primary/10 text-primary'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          onClick={onToggleChatMode}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="flex-1 truncate text-sm">对话</span>
        </div>

        {fileTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <FolderOpen className="mb-2 h-12 w-12" />
            <span className="text-sm">暂无笔记</span>
            <span className="text-xs">点击上方按钮创建</span>
          </div>
        ) : (
          <div className="space-y-0.5">
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                depth={0}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                onToggleFolder={onToggleFolder}
                onContextMenu={handleContextMenu}
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