// 节点右键菜单：新建 / 移动 / 打开位置 / 重命名 / 删除

import React, { useMemo, useCallback } from 'react';
import { FilePlus, FolderPlus, Edit, Trash2, ExternalLink, MoveRight } from 'lucide-react';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import type { FileTreeNode } from '../types';

export interface SidebarContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  /** 当前右键的节点；空表示在空白处右键（仅显示"新建笔记 / 新建文件夹"） */
  node?: FileTreeNode;
  /** 当前文件树（用于构造"移动到"子菜单） */
  fileTree: FileTreeNode[];
  /** 根目录绝对路径（用于构造"移动到根目录"项） */
  rootPath: string | null;
  onMoveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  onOpenCreateDialog: (type: 'folder' | 'note', parentPath: string | null) => void;
  onOpenRenameDialog: (node: FileTreeNode) => void;
  onOpenDeleteDialog: (node: FileTreeNode) => void;
  onClose: () => void;
}

// 收集树中所有文件夹，label 带层级缩进
function getFoldersFromTree(
  nodes: FileTreeNode[],
  excludePath?: string
): { path: string; label: string }[] {
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
}

export const SidebarContextMenu: React.FC<SidebarContextMenuProps> = ({
  isOpen,
  x,
  y,
  node,
  fileTree,
  rootPath,
  onMoveItem,
  onOpenCreateDialog,
  onOpenRenameDialog,
  onOpenDeleteDialog,
  onClose,
}) => {
  const items = useMemo<ContextMenuItem[]>(() => {
    if (!isOpen) return [];

    const result: ContextMenuItem[] = [];

    // 计算父目录（用于"在父目录新建"）
    const getParentPath = (n?: FileTreeNode): string | null => {
      if (!n) return null;
      if (n.type === 'folder') return n.path;
      const separator = n.path.includes('\\') ? '\\' : '/';
      const pathParts = n.path.split(separator);
      pathParts.pop();
      return pathParts.join(separator) || null;
    };

    result.push({
      id: 'create-note',
      label: '新建笔记',
      icon: <FilePlus className="w-4 h-4" />,
      onClick: () => {
        onOpenCreateDialog('note', getParentPath(node));
        onClose();
      },
    });

    result.push({
      id: 'create-folder',
      label: '新建文件夹',
      icon: <FolderPlus className="w-4 h-4" />,
      onClick: () => {
        onOpenCreateDialog('folder', getParentPath(node));
        onClose();
      },
    });

    if (node) {
      result.push({ id: 'divider1', divider: true });

      const allFolders = getFoldersFromTree(fileTree, node.path);
      const separator = node.path.includes('\\') ? '\\' : '/';
      const nodeParentPath = node.path.includes(separator)
        ? node.path.substring(0, node.path.lastIndexOf(separator))
        : null;
      const normalizedRootPath = rootPath ? rootPath.replace(/[\\/]+$/, '') : null;
      const normalizedParentPath = nodeParentPath ? nodeParentPath.replace(/[\\/]+$/, '') : null;
      const normalizedNodePath = node.path.replace(/[\\/]+$/, '');

      const moveSubItems = allFolders.map((folder) => ({
        id: `move-to-${folder.path}`,
        label: folder.label,
        onClick: async () => {
          const success = await onMoveItem(node.path, folder.path);
          if (success) onClose();
        },
      }));

      if (
        normalizedRootPath &&
        normalizedParentPath !== normalizedRootPath &&
        normalizedRootPath !== normalizedNodePath
      ) {
        moveSubItems.unshift({
          id: 'move-to-root',
          label: '根目录',
          onClick: async () => {
            const success = await onMoveItem(node.path, normalizedRootPath);
            if (success) onClose();
          },
        });
      }

      result.push({
        id: 'move',
        label: '移动',
        icon: <MoveRight className="w-4 h-4" />,
        subMenu: moveSubItems.length > 0 ? moveSubItems : undefined,
        onClick: () => {},
      });

      result.push({
        id: 'open-in-folder',
        label: '打开位置',
        icon: <ExternalLink className="w-4 h-4" />,
        onClick: () => {
          window.electron?.notes.openFileInFolder(node.path);
          onClose();
        },
      });

      result.push({
        id: 'rename',
        label: '重命名',
        icon: <Edit className="w-4 h-4" />,
        onClick: () => {
          onOpenRenameDialog(node);
          onClose();
        },
      });

      result.push({
        id: 'delete',
        label: '删除',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => {
          onOpenDeleteDialog(node);
          onClose();
        },
        className: 'text-error hover:bg-error/10 dark:hover:bg-error/20',
      });
    }

    return result;
  }, [
    isOpen,
    node,
    fileTree,
    rootPath,
    onMoveItem,
    onOpenCreateDialog,
    onOpenRenameDialog,
    onOpenDeleteDialog,
    onClose,
  ]);

  // 维持引用稳定，避免 ContextMenu 内部 effect 重跑
  const stableOnClose = useCallback(() => onClose(), [onClose]);

  return (
    <ContextMenu isOpen={isOpen} x={x} y={y} items={items} onClose={stableOnClose} />
  );
};

export default SidebarContextMenu;