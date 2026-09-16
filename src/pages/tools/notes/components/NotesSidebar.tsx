// NotesSidebar —— 编排层：aside 容器 + useSidebarInteractions + 转发 props + 对话框 + 树渲染。
// 节点数 > VIRTUALIZE_THRESHOLD 时切 react-window 虚拟列表，否则用 FileTreeItem 递归。

import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import type { NotesSidebarProps } from './sidebarTypes';
import { SidebarToolbar } from './SidebarToolbar';
import { ChatOrganizeSection } from './ChatOrganizeSection';
import { PinnedFoldersSection } from './PinnedFoldersSection';
import { FileTreeItem } from './FileTreeItem';
import { FileTreeVirtualList } from './FileTreeVirtualList';
import { SidebarContextMenu } from './SidebarContextMenu';
import { CreateDialog, ExistsConfirmDialog, DeleteConfirmDialog } from './SidebarDialogs';
import { useSidebarInteractions } from './useSidebarInteractions';
import { VIRTUALIZE_THRESHOLD } from '../constants/limits';
import NotesSidebarRecents from './NotesSidebarRecents';
import NotesSidebarFavorites from './NotesSidebarFavorites';
import NotesSidebarTagFilter from './NotesSidebarTagFilter';
import { useNotesTags } from '../hooks/useNotesTags';

export { CreateDialog };

// 统计所有节点数（含子树），用于判断是否启用虚拟化
function countTreeNodes(items: NotesSidebarProps['fileTree']): number {
  let count = 0;
  const walk = (nodes: NotesSidebarProps['fileTree']) => {
    for (const node of nodes) {
      count++;
      if (node.children && node.children.length > 0) walk(node.children);
    }
  };
  walk(items);
  return count;
}

const NotesSidebar: React.FC<NotesSidebarProps> = (props) => {
  const ix = useSidebarInteractions(props);
  const tagsHook = useNotesTags();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(480);

  // T02 / 4.3：ResizeObserver 测量 tree 容器高度，供 FixedSizeList 使用
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const h = el.clientHeight;
      if (h > 0) setContainerHeight(h);
    });
    ro.observe(el);
    // 立即跑一次，触发首次渲染的高度
    setContainerHeight(el.clientHeight || 480);
    return () => ro.disconnect();
  }, []);

  // T02 / 4.3：节点数 > 阈值则虚拟化，否则保持原 FileTreeItem 递归
  const totalNodes = countTreeNodes(props.fileTree);
  const useVirtual = totalNodes > VIRTUALIZE_THRESHOLD;

  // 过滤掉对话整理目录（与原行为一致） + 应用 tag 过滤（T05）
  const filteredTree = tagsHook.filterTreeByTag(props.fileTree, tagsHook.tagFilter).filter((node) => node.path !== props.chatOrganizePath);

  return (
    <aside
      className={`flex h-full w-48 flex-shrink-0 flex-col bg-white dark:bg-gray-900 ${ix.isDragOver ? 'ring-2 ring-primary ring-offset-2' : ''}`}
      onDragOver={ix.handleAsideDragOver}
      onDragLeave={ix.handleAsideDragLeave}
      onDrop={ix.handleAsideDrop}
    >
      {ix.isDragOver && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary/10 pointer-events-none">
          <div className="rounded-lg bg-white dark:bg-gray-800 px-4 py-2 text-sm text-primary shadow-lg">释放以导入文件</div>
        </div>
      )}

      <SidebarToolbar
        loading={props.loading}
        onRefresh={props.onRefresh}
        onRebuildIndex={props.onRebuildIndex}
        onAddPinnedFolder={props.onAddPinnedFolder}
        onSetChatPath={props.onSetChatPath}
        chatPath={props.chatPath}
        onOpenCreateDialog={ix.openCreateDialog}
        currentViewPath={props.currentViewPath}
        onCreateNote={props.onCreateNote}
        onCreateNoteForce={props.onCreateNoteForce}
      />

      <ChatOrganizeSection
        isChatMode={props.isChatMode}
        onToggleChatMode={props.onToggleChatMode}
        chatOrganizePath={props.chatOrganizePath}
        chatOrganizeTree={props.chatOrganizeTree}
        isOrganizeExpanded={ix.isOrganizeExpanded}
        onToggleOrganize={ix.toggleOrganize}
        onSelectOrganizeFolder={props.onSelectOrganizeFolder}
        selectedFile={props.selectedFile}
        listSelection={ix.listSelection}
        setListSelection={ix.setListSelection}
        onSelectFile={props.onSelectFile}
        onToggleFolder={props.onToggleFolder}
        onContextMenu={ix.handleContextMenu}
        onItemDragStart={ix.handleItemDragStart}
        onItemDragOver={ix.handleItemDragOver}
        onItemDrop={ix.handleItemDrop}
        onItemDragEnd={ix.handleItemDragEnd}
        dragOverPath={ix.dragOverPath}
        dragSourcePath={ix.dragSourcePath}
      />

      <PinnedFoldersSection
        pinnedFolders={props.pinnedFolders}
        currentViewPath={props.currentViewPath}
        pinnedDragIndex={ix.pinnedDragIndex}
        pinnedDragOverIndex={ix.pinnedDragOverIndex}
        pinnedContextMenu={ix.pinnedContextMenu}
        setPinnedDragIndex={ix.setPinnedDragIndex}
        setPinnedDragOverIndex={ix.setPinnedDragOverIndex}
        setPinnedContextMenu={ix.setPinnedContextMenu}
        onSwitchToFolder={props.onSwitchToFolder}
        onReorderPinnedFolder={props.onReorderPinnedFolder}
        onAddPinnedFolder={props.onAddPinnedFolder}
        onRemovePinnedFolder={props.onRemovePinnedFolder}
      />

      <NotesSidebarFavorites
        favorites={props.favorites}
        onToggleFavorite={props.onToggleFavorite}
        selectedFile={props.selectedFile}
        fileTree={props.fileTree}
        onSelectFile={props.onSelectFile}
      />
      {/* rootPath：标签重命名 / 删除后要用它重建索引 */}
      <NotesSidebarTagFilter rootPath={props.rootPath} />
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 scrollbar-hide border-t border-gray-100 dark:border-gray-800"
        onContextMenu={(e) => {
          if ((e.target as HTMLElement).closest('.cursor-pointer')) return;
          ix.handleContextMenu(e);
        }}
      >
        {filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <FolderOpen className="mb-2 h-12 w-12" />
            <span className="text-sm">暂无笔记</span>
            <span className="text-xs">点击上方按钮创建</span>
          </div>
        ) : useVirtual ? (
          /* T02 / 4.3：节点数 > VIRTUALIZE_THRESHOLD 时启用虚拟化 */
          <FileTreeVirtualList
            items={filteredTree}
            selectedFile={props.selectedFile}
            listSelection={ix.listSelection}
            height={containerHeight}
            onSelectFile={props.onSelectFile}
            onSelectItem={ix.setListSelection}
            onToggleFolder={props.onToggleFolder}
            onContextMenu={ix.handleContextMenu}
            onItemDragStart={ix.handleItemDragStart}
            onItemDragOver={ix.handleItemDragOver}
            onItemDrop={ix.handleItemDrop}
            onItemDragEnd={ix.handleItemDragEnd}
            dragOverPath={ix.dragOverPath}
            dragSourcePath={ix.dragSourcePath}
          />
        ) : (
          <div className="space-y-0.5">
            {filteredTree.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                depth={0}
                selectedFile={props.selectedFile}
                listSelection={ix.listSelection}
                onSelectFile={props.onSelectFile}
                onSelectItem={ix.setListSelection}
                onToggleFolder={props.onToggleFolder}
                onContextMenu={ix.handleContextMenu}
                onItemDragStart={ix.handleItemDragStart}
                onItemDragOver={ix.handleItemDragOver}
                onItemDrop={ix.handleItemDrop}
                onItemDragEnd={ix.handleItemDragEnd}
                dragOverPath={ix.dragOverPath}
                dragSourcePath={ix.dragSourcePath}
              />
            ))}
          </div>
        )}
      </div>

      {/* 最近：放在文件树下方（侧栏最底部），默认折叠，状态持久化 */}
      <NotesSidebarRecents
        recents={props.recents}
        onRemoveRecent={props.onRemoveRecent}
        onClearRecents={props.onClearRecents}
        selectedFile={props.selectedFile}
        fileTree={props.fileTree}
        onSelectFile={props.onSelectFile}
      />

      <SidebarContextMenu
        isOpen={!!ix.contextMenu}
        x={ix.contextMenu?.x ?? 0}
        y={ix.contextMenu?.y ?? 0}
        node={ix.contextMenu?.node}
        fileTree={props.fileTree}
        rootPath={props.rootPath}
        onMoveItem={props.onMoveItem}
        onOpenCreateDialog={ix.openCreateDialog}
        onOpenRenameDialog={ix.openRenameDialog}
        onOpenDeleteDialog={ix.openDeleteDialog}
        onClose={ix.closeContextMenu}
      />

      {ix.createDialog && (
        <CreateDialog
          type={ix.createDialog.type}
          onConfirm={ix.createDialog.type === 'folder' ? ix.handleCreateFolder : ix.handleCreateNote}
          onCancel={ix.cancelCreateOrRename}
          initialName={ix.createName}
          onNameChange={ix.setCreateName}
        />
      )}
      {ix.renameDialog && (
        <CreateDialog type="note" onConfirm={ix.handleRename} onCancel={ix.cancelCreateOrRename} initialName={ix.renameName} onNameChange={ix.setRenameName} />
      )}
      {ix.existsDialog && (
        <ExistsConfirmDialog
          type={ix.existsDialog.type}
          name={ix.existsDialog.name}
          onOverwrite={ix.existsDialog.type === 'folder' ? ix.handleOverwriteFolder : ix.handleOverwriteNote}
          onCreateCopy={ix.existsDialog.type === 'folder' ? ix.handleCreateFolderCopy : ix.handleCreateNoteCopy}
          onCancel={ix.cancelExists}
        />
      )}
      {ix.deleteDialog && (
        <DeleteConfirmDialog type={ix.deleteDialog.node.type} name={ix.deleteDialog.node.name} onConfirm={ix.handleConfirmDelete} onCancel={ix.cancelDelete} />
      )}
    </aside>
  );
};

export default NotesSidebar;