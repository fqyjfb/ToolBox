// 节点右键菜单

import React, { useMemo, useCallback } from 'react';
import { FilePlus, FolderPlus, Edit, Trash2, Recycle, ExternalLink, MoveRight } from 'lucide-react';
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu';
import type { FileTreeNode } from '../types';
import type { SidebarContextMenuArea } from './sidebarTypes';

export interface SidebarContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  node?: FileTreeNode;
  area: SidebarContextMenuArea;
  fileTree: FileTreeNode[];
  // 当前查看的固定目录：新建只在固定目录内生效，为空（未配置固定目录）时不提供新建
  currentViewPath: string | null;
  onMoveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  onOpenCreateDialog: (type: 'folder' | 'note', parentPath: string | null) => void;
  onOpenRenameDialog: (node: FileTreeNode) => void;
  onOpenDeleteDialog: (node: FileTreeNode) => void;
  // 移入系统回收站（可恢复），与「删除」的彻底删除区分
  onOpenTrashDialog: (node: FileTreeNode) => void;
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
  area,
  fileTree,
  currentViewPath,
  onMoveItem,
  onOpenCreateDialog,
  onOpenRenameDialog,
  onOpenDeleteDialog,
  onOpenTrashDialog,
  onClose,
}) => {
  const items = useMemo<ContextMenuItem[]>(() => {
    if (!isOpen) return [];

    const openInFolderItem = (n: FileTreeNode): ContextMenuItem => ({
      id: 'open-in-folder',
      label: '打开位置',
      icon: <ExternalLink className="w-4 h-4" />,
      onClick: () => {
        window.electron?.notes.openFileInFolder(n.path);
        onClose();
      },
    });

    const deleteItem = (n: FileTreeNode): ContextMenuItem => ({
      id: 'delete',
      label: '删除',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => {
        onOpenDeleteDialog(n);
        onClose();
      },
      className: 'text-error hover:bg-error/10 dark:hover:bg-error/20',
    });

    // 对话整理区只保留「打开位置 / 删除」，固定目录与文件列表区走下方完整菜单
    if (area === 'chat') {
      return node ? [openInFolderItem(node), deleteItem(node)] : [];
    }

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

    // 新建只在固定目录内生效：未配置固定目录时不提供入口，避免建到对话目录
    if (currentViewPath) {
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
    }

    if (node) {
      result.push({ id: 'divider1', divider: true });

      const moveSubItems = getFoldersFromTree(fileTree, node.path).map((folder) => ({
        id: `move-to-${folder.path}`,
        label: folder.label,
        onClick: async () => {
          const success = await onMoveItem(node.path, folder.path);
          if (success) onClose();
        },
      }));

      // 无其他文件夹可去时不展示「移动」：菜单里只保留真正可用的项
      if (moveSubItems.length > 0) {
        result.push({
          id: 'move',
          label: '移动',
          icon: <MoveRight className="w-4 h-4" />,
          subMenu: moveSubItems,
        });
      }

      result.push(openInFolderItem(node));

      result.push({
        id: 'rename',
        label: '重命名',
        icon: <Edit className="w-4 h-4" />,
        onClick: () => {
          onOpenRenameDialog(node);
          onClose();
        },
      });

      // 回收站可恢复，排在「删除」之上：误点时还有找回余地
      result.push({
        id: 'trash',
        label: '移入回收站',
        icon: <Recycle className="w-4 h-4" />,
        onClick: () => {
          onOpenTrashDialog(node);
          onClose();
        },
      });

      result.push(deleteItem(node));
    }

    return result;
  }, [
    isOpen,
    area,
    node,
    fileTree,
    currentViewPath,
    onMoveItem,
    onOpenCreateDialog,
    onOpenRenameDialog,
    onOpenDeleteDialog,
    onOpenTrashDialog,
    onClose,
  ]);

  // 维持引用稳定，避免 ContextMenu 内部 effect 重跑
  const stableOnClose = useCallback(() => onClose(), [onClose]);

  return (
    <ContextMenu isOpen={isOpen} x={x} y={y} items={items} onClose={stableOnClose} />
  );
};

export default SidebarContextMenu;