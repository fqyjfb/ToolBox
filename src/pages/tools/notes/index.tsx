import React, { useEffect, useState, useCallback } from 'react';
import { PanelLeft } from 'lucide-react';
import { useNotes, type FileTreeNode } from '@/hooks/useNotes';
import { useChatNotes } from './hooks/useChatNotes';
import { useNotesSearch } from './hooks/useNotesSearch';
import {
  type NotesSearchMatch,
  type NotesSearchResultItem,
} from './types';
import { CHAT_ORGANIZE_FOLDER } from './constants/paths';
import FolderSelectModal from './components/FolderSelectModal';
import NotesSidebar, { CreateDialog } from './components/NotesSidebar';
import NotesEditor from './components/NotesEditor';
import OpenTabs from './components/OpenTabs';
import SearchPalette from './components/SearchPalette';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatInput } from './components/ChatInput';
import { useNotesWatcher } from './hooks/useNotesWatcher';
import ExternalChangeDialog from './components/ExternalChangeDialog';
import { useNotesDraftRecovery, type DraftInfo } from './hooks/useNotesDraftRecovery';
import DraftRecoveryDialog from './components/DraftRecoveryDialog';
import { localStorageService, STORAGE_KEYS } from '../../../services/localStorageService';

const NotesPage: React.FC = () => {
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const stored = localStorageService.getString(STORAGE_KEYS.NOTES_SIDEBAR_VISIBLE);
    return stored === null ? true : stored === 'true';
  });
  const [createDialog, setCreateDialog] = useState<{
    type: 'folder' | 'note';
    parentPath: string | null;
  } | null>(null);
  const [createName, setCreateName] = useState('');
  const {
    hasRootPath,
    rootPath,
    fileTree,
    selectedFile,
    fileContent,
    fileMetadata,
    filePreviewUrl,
    loading,
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
    refreshFileTree,
    rebuildIndex,
    pinnedFolders,
    currentViewPath,
    chatPath,
    chatOrganizeTree,
    addPinnedFolder,
    addPinnedFolderByPath,
    removePinnedFolder,
    reorderPinnedFolder,
    switchToFolder,
    setChatPath,
    recents,
    favorites,
    toggleFavorite,
    removeRecent,
    clearRecents,
    switchTab,
  } = useNotes();

  const {
    isChatMode,
    setIsChatMode,
    messages,
    selectedMessages,
    sendMessage,
    toggleMessageDone,
    toggleMessageSelection,
    clearSelection,
    moveMessages,
    refreshMessages,
  } = useChatNotes({ rootPath: chatPath, onRefreshFileTree: refreshFileTree });



  useEffect(() => {
    if (isChatMode) {
      refreshMessages();
    }
  }, [isChatMode, refreshMessages]);

  const handleToggleChatMode = () => {
    setIsChatMode(!isChatMode);
  };

  const sep = chatPath && chatPath.includes('\\') ? '\\' : '/';
  const chatOrganizePath = chatPath ? `${chatPath}${sep}${CHAT_ORGANIZE_FOLDER}` : null;

  const ensureOrganizeFolder = useCallback(async () => {
    if (!chatPath) return;
    try {
      await window.electron?.notes.createFolder(chatPath, CHAT_ORGANIZE_FOLDER);
      const s = chatPath.includes('\\') ? '\\' : '/';
      const oldChatPath = `${chatPath}${s}对话.md`;
      const newChatPath = `${chatPath}${s}${CHAT_ORGANIZE_FOLDER}${s}对话.md`;
      const result = await window.electron?.notes.readFile(oldChatPath);
      if (result?.success && result.content) {
        const newResult = await window.electron?.notes.readFile(newChatPath);
        if (!newResult?.success) {
          await window.electron?.notes.saveFile(newChatPath, result.content);
          await window.electron?.notes.deleteItem(oldChatPath);
        }
      }
      await refreshFileTree();
    } catch {
      // 组织目录已存在 / 旧对话迁移失败都不阻塞启动
    }
  }, [chatPath, refreshFileTree]);

  useEffect(() => {
    if (chatPath) {
      ensureOrganizeFolder();
    }
  }, [chatPath, ensureOrganizeFolder]);

  const handleSelectOrganizeFolder = useCallback(() => {
    if (!chatOrganizePath) return;
    toggleFolderExpand(chatOrganizePath);
  }, [chatOrganizePath, toggleFolderExpand]);

  const handleToggleSidebar = () => {
    const newValue = !sidebarVisible;
    setSidebarVisible(newValue);
    localStorageService.setString(STORAGE_KEYS.NOTES_SIDEBAR_VISIBLE, String(newValue));
  };

  // 全文搜索：把 selectFile 注入 hook，使 navigateToMatch 能先切文件再派发跳转事件。
  const search = useNotesSearch();
  useEffect(() => {
    search.bindSelectFile(selectFile);
  }, [selectFile, search]);

  // 搜索范围限定在当前查看的固定目录：文件列表不显示对话路径内容，无视图时不检索。
  const handleSearch = useCallback(
    (q: string) => {
      search.setQuery(q);
      if (currentViewPath && q.trim().length > 0) {
        void search.search(currentViewPath);
      } else {
        search.clearResults();
      }
    },
    [search, currentViewPath]
  );

  const handleSearchPaletteClose = useCallback(() => {
    search.closePalette();
  }, [search]);

  const handleSelectMatch = useCallback(
    (item: FileTreeNode | NotesSearchResultItem, match: NotesSearchMatch) => {
      // 搜索结果一定有 score 字段（SearchPalette 的 prop 是 union 类型）
      if ('score' in item) {
        void search.navigateToMatch(item, match);
      }
    },
    [search]
  );

  // deps 用解构出的 togglePalette（引用稳定），而非整个 search 对象（identity 每次渲染都变）。
  const { togglePalette } = search;
  useEffect(() => {
    if (!chatPath) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        togglePalette();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    }, [chatPath, togglePalette]);

  const handleSelectFile = (file: FileTreeNode) => {
    setIsChatMode(false);
    selectFile(file);
  };

  // 标题重命名（NotesEditor 双击标题触发）：复用组合根 renameItem（内部刷新树 + 同步选中项 + 更新标签页）。
  const handleRenameFile = useCallback(
    async (newName: string) => {
      if (!selectedFile) return false;
      return renameItem(selectedFile.path, newName);
    },
    [selectedFile, renameItem]
  );

  const handleOpenCreateDialog = (type: 'folder' | 'note') => {
    setCreateDialog({ type, parentPath: null });
    setCreateName('');
  };

  const handleCloseCreateDialog = () => {
    setCreateDialog(null);
    setCreateName('');
  };

  const handleCreateConfirm = async () => {
    if (!createDialog || !createName.trim()) return;

    try {
      if (createDialog.type === 'folder') {
        await createFolder(createDialog.parentPath, createName.trim());
      } else {
        await createNote(createDialog.parentPath, createName.trim());
      }
      handleCloseCreateDialog();
    } catch (error) {
      console.error('Create failed:', error);
    }
  };

  // 外部文件变更监听 + 冲突裁决（挂页面，须早于 early return 以保证 hooks 顺序稳定）。
  const watcher = useNotesWatcher({
    rootPath,
    hasRootPath,
    onExternalChange: refreshFileTree,
    selectedFile,
    fileContent,
    updateFileContent,
    saveFile,
  });

  // 启动时清点上一次会话残留的未保存草稿；只解构引用稳定的 useCallback（整个 hook 对象进 deps 会无限循环）。
  const {
    drafts: pendingDrafts,
    scan: scanDrafts,
    recover: recoverDraft,
    discard: discardDraft,
    clear: clearDrafts,
  } = useNotesDraftRecovery();
  useEffect(() => {
    if (!chatPath) return;
    void scanDrafts();
  }, [chatPath, scanDrafts]);

  const handleRecoverDraft = useCallback(
    async (draft: DraftInfo) => {
      const content = await recoverDraft(draft);
      if (content !== null && selectedFile?.path === draft.absolutePath) {
        updateFileContent(content);
      }
      await scanDrafts();
    },
    [recoverDraft, scanDrafts, selectedFile, updateFileContent]
  );

  const handleDiscardDraft = useCallback(
    async (draft: DraftInfo) => {
      await discardDraft(draft);
      await scanDrafts();
    },
    [discardDraft, scanDrafts]
  );

  if (!chatPath) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <FolderSelectModal onSelect={setChatPath} loading={loading} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <main className="flex flex-1 overflow-hidden">
        {sidebarVisible && (
          <NotesSidebar
            fileTree={fileTree}
            rootPath={rootPath}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
            onToggleFolder={toggleFolderExpand}
            onCreateFolder={createFolder}
            onCreateFolderForce={createFolderForce}
            onCreateNote={createNote}
            onCreateNoteForce={createNoteForce}
            onRenameItem={renameItem}
            onDeleteItem={deleteItem}
            onMoveItem={moveItem}
            onRefresh={refreshFileTree}
            onRebuildIndex={rebuildIndex}
            loading={loading}
            isChatMode={isChatMode}
            onToggleChatMode={handleToggleChatMode}
            chatOrganizePath={chatOrganizePath}
            onSelectOrganizeFolder={handleSelectOrganizeFolder}
            onCopyItem={copyItem}
            onImportDroppedFiles={importDroppedFiles}
            pinnedFolders={pinnedFolders}
            currentViewPath={currentViewPath}
            onAddPinnedFolder={addPinnedFolder}
            onAddPinnedFolderByPath={addPinnedFolderByPath}
            onRemovePinnedFolder={removePinnedFolder}
            onReorderPinnedFolder={reorderPinnedFolder}
            onSwitchToFolder={switchToFolder}
            onSetChatPath={setChatPath}
            chatPath={chatPath}
            chatOrganizeTree={chatOrganizeTree}
            recents={recents}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onRemoveRecent={removeRecent}
            onClearRecents={clearRecents}
          />
        )}

        {isChatMode ? (
          <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleToggleSidebar}
                  title={sidebarVisible ? '隐藏列表' : '显示列表'}
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                </button>
                <h2 className="text-xs font-medium text-gray-600 dark:text-gray-300">快速记录想法，稍后整理</h2>
              </div>
              {selectedMessages.length > 0 && (
                <button
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  onClick={clearSelection}
                >
                  清除选择 ({selectedMessages.length})
                </button>
              )}
            </div>

            <ChatMessageList
              messages={messages}
              selectedMessages={selectedMessages}
              onToggleDone={toggleMessageDone}
              onToggleSelection={toggleMessageSelection}
              onMove={moveMessages}
            />

            <ChatInput onSend={sendMessage} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            <OpenTabs onSelect={switchTab} />
            <NotesEditor
              selectedFile={selectedFile}
              content={fileContent}
              fileMetadata={fileMetadata}
              filePreviewUrl={filePreviewUrl}
              onContentChange={updateFileContent}
              onSave={saveFile}
              onRenameFile={handleRenameFile}
              sidebarVisible={sidebarVisible}
              onToggleSidebar={handleToggleSidebar}
              onCreateNote={() => handleOpenCreateDialog('note')}
              onCreateFolder={() => handleOpenCreateDialog('folder')}
            />
          </div>
        )}
      </main>

      {createDialog && (
        <CreateDialog
          type={createDialog.type}
          onConfirm={handleCreateConfirm}
          onCancel={handleCloseCreateDialog}
          initialName={createName}
          onNameChange={setCreateName}
        />
      )}

      {/* 搜索面板：永远挂载，靠 isOpen 控制可见性 */}
      <SearchPalette
        isOpen={search.isOpen}
        query={search.query}
        results={search.results}
        loading={search.loading}
        error={search.error}
        scanned={search.scanned}
        elapsedMs={search.elapsedMs}
        truncated={search.truncated}
        onQueryChange={handleSearch}
        onSelectMatch={handleSelectMatch}
        onClose={handleSearchPaletteClose}
      />

      <DraftRecoveryDialog
        isOpen={pendingDrafts.length > 0}
        drafts={pendingDrafts}
        onRecover={handleRecoverDraft}
        onDiscard={handleDiscardDraft}
        onClose={clearDrafts}
      />

      {/* 外部修改冲突裁决：有 pending 时才挂载，层级高于草稿弹窗 */}
      {watcher.pendingExternalChange && (
        <ExternalChangeDialog
          fileName={watcher.pendingExternalChange.name}
          onKeepMine={() => watcher.resolveExternalChange('keep-mine')}
          onTakeExternal={() => watcher.resolveExternalChange('take-external')}
          onDismiss={watcher.dismiss}
        />
      )}
    </div>
  );
};

export default NotesPage;