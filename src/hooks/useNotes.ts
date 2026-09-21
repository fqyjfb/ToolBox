// useNotes —— 组合根：聚合 useNotesTree / useNotesSelection / useNotesOperations /
// useNotesPinned / useChatPath 等子 Hook；子 Hook 间依赖靠参数透传以避免循环依赖。
// 不得删改既有字段（会破坏调用方），新能力只能在末尾追加（T04 recents/favorites、T08 switchTab）。
// 「init 完成后还原上次打开文件」这类跨子 Hook 逻辑放在本文件。
// 末尾转发 FileTreeNode 等类型，是为了让老的 `@/hooks/useNotes` 导入路径不破坏。

import { useCallback, useEffect } from 'react';
import { useNotesTree } from '../pages/tools/notes/hooks/useNotesTree';
import { useNotesSelection } from '../pages/tools/notes/hooks/useNotesSelection';
import { useNotesOperations } from '../pages/tools/notes/hooks/useNotesOperations';
import { useNotesPinned } from '../pages/tools/notes/hooks/useNotesPinned';
import { useChatPath } from '../pages/tools/notes/hooks/useChatPath';
import { useNotesRecents } from '../pages/tools/notes/hooks/useNotesRecents';
import { useNotesFavorites } from '../pages/tools/notes/hooks/useNotesFavorites';
import { useNotesTabs } from '../pages/tools/notes/hooks/useNotesTabs';
import { bindNotesRecentsStorageSync } from '../store/notesRecentsStore';
import { useToastStore } from '../store/toastStore';
import type { FileTreeNode, FileMetadata, PinnedFolder, NotesRecentItem, NotesFavoritePath, NotesSendTarget } from '../pages/tools/notes/types';

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
  pinnedFolders: PinnedFolder[];
  currentViewPath: string | null;
  chatPath: string | null;
  chatOrganizeTree: FileTreeNode[];
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
  /** 移入系统回收站（可恢复），删除的替代路径 */
  trashItem: (itemPath: string) => Promise<boolean>;
  moveItem: (itemPath: string, targetFolderPath: string) => Promise<boolean>;
  copyItem: (sourcePath: string) => Promise<boolean>;
  /** 发送：desktop=复制到系统桌面；qq/wechat=写入系统剪贴板并唤起应用 */
  sendItem: (sourcePath: string, target: NotesSendTarget) => Promise<boolean>;
  importDroppedFiles: (filePaths: string[], targetFolderPath?: string) => Promise<{ success: boolean; imported?: string[]; errors?: string[] }>;
  toggleFolderExpand: (folderPath: string) => void;
  rebuildIndex: () => Promise<void>;
  clearError: () => void;
  addPinnedFolder: () => Promise<boolean>;
  addPinnedFolderByPath: (folderPath: string) => boolean;
  removePinnedFolder: (folderPath: string) => void;
  reorderPinnedFolder: (fromIndex: number, toIndex: number) => void;
  switchToFolder: (folderPath: string) => Promise<void>;
  setChatPath: () => Promise<boolean>;
  // 追加字段（不得删改既有字段）
  recents: NotesRecentItem[];
  favorites: NotesFavoritePath[];
  favoritePaths: NotesFavoritePath[];
  toggleFavorite: (absolutePath: NotesFavoritePath) => Promise<boolean>;
  removeRecent: (absolutePath: NotesFavoritePath) => void;
  clearRecents: () => void;
  // 只暴露 switchTab：tabs / activeTabPath / closeTab 由 <OpenTabs> 直连 store，
  // 经组合根转发会变成零调用方的冗余 API
  switchTab: (path: string) => void;
}

export function useNotes(): UseNotesReturn {
  // 1) 无跨 hook 依赖的先建
  const pinned = useNotesPinned();
  const chatPathHook = useChatPath();

  // 2) useNotesTree 拥有 loading/error，但**不**调用 useNotesSelection.selectFile
  //    （避免循环依赖）——原 useNotes 的"还原上次打开文件"由本组合根另行触发。
  const tree = useNotesTree({
    currentViewPath: pinned.currentViewPath,
    setCurrentViewPath: pinned.setCurrentViewPath,
    pinnedFolders: pinned.pinnedFolders,
    chatPath: chatPathHook.chatPath,
    loadChatOrganizeTree: chatPathHook.loadChatOrganizeTree,
  });

  // 3) useNotesSelection 持有 loading/error 的写入句柄（来自 tree）
  const selection = useNotesSelection({
    setError: tree.setError,
    setLoading: tree.setLoading,
  });

  // 4) useNotesOperations 持有最复杂的跨 hook 同步句柄
  const operations = useNotesOperations({
    setError: tree.setError,
    refreshFileTree: tree.refreshFileTree,
    selectFile: selection.selectFile,
    clearSelection: selection.clearSelection,
    selectedFile: selection.selectedFile,
    setSelectedFile: selection.setSelectedFile,
    setExpandedFolders: tree.setExpandedFolders,
    setPinnedFolders: pinned.setPinnedFolders,
    currentViewPathRef: pinned.currentViewPathRef,
  });

  // 5) T04：最近列表 + 收藏（独立 hook，不互相依赖）
  const recents = useNotesRecents();
  const favorites = useNotesFavorites();

  // 6) T08：标签页（独立 hook，只存路径；与上面两者互不依赖）
  const tabs = useNotesTabs();

  // 切换标签：从文件树找回节点再 selectFile。节点不在树中（被外部删除 / 移动 / 不在当前目录）
  // 时不能静默返回——关掉标签并弹 toast，否则用户点了标签像没反应。
  const switchTab = useCallback(
    (path: string) => {
      const node = tree.findFileInTree(path, tree.fileTree);
      if (node) {
        void selection.selectFile(node);
        return;
      }
      tabs.closeTab(path);
      useToastStore.getState().addToast({ type: 'warning', message: '文件已不存在，已关闭标签' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tree.fileTree, selection.selectFile, tabs.closeTab]
  );

  // 延迟注入：把 recents.pushRecent / favorites.toggle / tabs.openTab 注入 selection，
  // 让 selectFile 成功后自动写最近列表、收藏与标签（hook 内 useRef 缓存，每次渲染调用无副作用）。
  selection.setRecentPusher(recents.pushRecent);
  selection.setFavoriteToggler(favorites.toggle);
  selection.setTabPusher(tabs.openTab);

  // 跨标签同步最近列表；挂一次即可，卸载时由返回的 unbind 清理
  useEffect(() => {
    const unbind = bindNotesRecentsStorageSync();
    return unbind;
  }, []);

  // 视图只允许指向仍被固定的目录：固定目录被移除 / 被删除（含当前目录或其上级被删）后，
  // 视图若仍停在失效目录上，下方文件列表会一直是它的内容。这里只重置视图路径，文件树刷新
  // 由 useNotesTree 的 viewSync effect 统一处理，避免与 refreshFileTree 重复扫描。
  // 还有固定目录时回落到第一个：目录体系只有"对话目录 + 固定目录"两种，列表必须指向固定目录
  useEffect(() => {
    const view = pinned.currentViewPath;
    if (view && pinned.pinnedFolders.some((p) => p.path === view)) return;
    pinned.setCurrentViewPath(pinned.pinnedFolders[0]?.path ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned.pinnedFolders, pinned.currentViewPath]);

  // 还原上次打开的文件：为避免 useNotesTree → useNotesSelection 循环依赖，改在组合根
  // 监听 tree.initialized 后触发。找不到节点则清除 STORAGE key，找到则 selectFile
  // 并把父目录加入 expandedFolders。
  useEffect(() => {
    if (!tree.initialized) return;

    let cancelled = false;
    const restoreLastOpened = async () => {
      if (!window.electron) return;
      try {
        const localStorageServiceMod = await import('../services/localStorageService');
        const localStorageService = localStorageServiceMod.default;
        const { STORAGE_KEYS } = localStorageServiceMod;
        const lastOpened = localStorageService.getString(STORAGE_KEYS.NOTES_LAST_OPENED_FILE);
        if (!lastOpened) return;
        if (cancelled) return;

        const fileNode = tree.findFileInTree(lastOpened, tree.fileTree);
        // 找不到节点（如未配置固定目录、或上次选中的文件已不在当前固定目录）时
        // 保留存储键不删除，避免其他视图 / 会话的选中状态被永久清除
        if (!fileNode) return;

        await selection.selectFile(fileNode);
        if (cancelled) return;

        // 父链基准取当前视图目录（固定目录视图下相对固定目录展开）；
        // useNotesPinned 恢复视图在首次渲染即完成，此处闭包取值稳定
        const viewBase = pinned.currentViewPath;
        if (viewBase) {
          const parents = tree.getParentFolders(fileNode.path, viewBase);
          if (parents.length > 0) {
            tree.setExpandedFolders((prev) => {
              const newSet = new Set(prev);
              parents.forEach((folder) => newSet.add(folder));
              return newSet;
            });
          }
        }
      } catch {
        /* 静默失败，与原实现一致 */
      }
    };

    restoreLastOpened();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.initialized]);

  return {
    // state
    hasRootPath: tree.hasRootPath,
    rootPath: tree.rootPath,
    fileTree: tree.expandTree(tree.fileTree),
    selectedFile: selection.selectedFile,
    fileContent: selection.fileContent,
    fileMetadata: selection.fileMetadata,
    filePreviewUrl: selection.filePreviewUrl,
    loading: tree.loading,
    error: tree.error,
    pinnedFolders: pinned.pinnedFolders,
    currentViewPath: pinned.currentViewPath,
    chatPath: chatPathHook.chatPath,
    chatOrganizeTree: tree.expandTree(chatPathHook.chatOrganizeTree),
    // actions
    refreshFileTree: tree.refreshFileTree,
    selectFile: selection.selectFile,
    updateFileContent: selection.updateFileContent,
    saveFile: selection.saveFile,
    createFolder: operations.createFolder,
    createFolderForce: operations.createFolderForce,
    createNote: operations.createNote,
    createNoteForce: operations.createNoteForce,
    renameItem: operations.renameItem,
    deleteItem: operations.deleteItem,
    trashItem: operations.trashItem,
    moveItem: operations.moveItem,
    copyItem: operations.copyItem,
    sendItem: operations.sendItem,
    importDroppedFiles: operations.importDroppedFiles,
    toggleFolderExpand: tree.toggleFolderExpand,
    rebuildIndex: tree.rebuildIndex,
    clearError: tree.clearError,
    addPinnedFolder: pinned.addPinnedFolder,
    addPinnedFolderByPath: pinned.addPinnedFolderByPath,
    removePinnedFolder: pinned.removePinnedFolder,
    reorderPinnedFolder: pinned.reorderPinnedFolder,
    switchToFolder: tree.switchToFolder,
    setChatPath: chatPathHook.setChatPath,
    // 追加字段
    recents: recents.recents,
    favorites: favorites.favorites,
    favoritePaths: favorites.favoritePaths,
    toggleFavorite: favorites.toggle,
    removeRecent: recents.removeRecent,
    clearRecents: recents.clearRecents,
    // tabs 数据由 <OpenTabs> 直连 store，不在此转发
    switchTab,
  };
}

export type { FileTreeNode, FileMetadata, PinnedFolder };