import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import { useNotes, type FileTreeNode } from '@/hooks/useNotes';
import { useChatNotes } from './hooks/useChatNotes';
import { CHAT_ORGANIZE_FOLDER } from './constants/paths';
import FolderSelectModal from './components/FolderSelectModal';
import NotesSidebar, { CreateDialog } from './components/NotesSidebar';
import NotesEditor from './components/NotesEditor';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatInput } from './components/ChatInput';
import { localStorageService, STORAGE_KEYS } from '../../../services/localStorageService';

const NotesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const chatModeParam = searchParams.get('chatMode');
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
    selectRootFolder,
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
    removePinnedFolder,
    reorderPinnedFolder,
    switchToFolder,
    setChatPath,
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
  } = useChatNotes({ rootPath: chatPath || rootPath, onRefreshFileTree: refreshFileTree });

  useEffect(() => {
    if (isChatMode) {
      refreshMessages();
    }
  }, [isChatMode, refreshMessages]);

  useEffect(() => {
    if (chatModeParam === '1' && !isChatMode) {
      setIsChatMode(true);
    }
  }, [chatModeParam, isChatMode, setIsChatMode]);

  const handleToggleChatMode = () => {
    setIsChatMode(!isChatMode);
  };

  const chatBasePath = chatPath || rootPath;
  const sep = chatBasePath && chatBasePath.includes('\\') ? '\\' : '/';
  const chatOrganizePath = chatBasePath ? `${chatBasePath}${sep}${CHAT_ORGANIZE_FOLDER}` : null;

  const ensureOrganizeFolder = useCallback(async () => {
    if (!chatBasePath) return;
    try {
      await window.electron?.notes.createFolder(chatBasePath, CHAT_ORGANIZE_FOLDER);
      const s = chatBasePath.includes('\\') ? '\\' : '/';
      const oldChatPath = `${chatBasePath}${s}对话.md`;
      const newChatPath = `${chatBasePath}${s}${CHAT_ORGANIZE_FOLDER}${s}对话.md`;
      const result = await window.electron?.notes.readFile(oldChatPath);
      if (result?.success && result.content) {
        const newResult = await window.electron?.notes.readFile(newChatPath);
        if (!newResult?.success) {
          await window.electron?.notes.saveFile(newChatPath, result.content);
          await window.electron?.notes.deleteItem(oldChatPath);
        }
      }
      await refreshFileTree();
    } catch {}
  }, [chatBasePath, refreshFileTree]);

  useEffect(() => {
    if (chatBasePath) {
      ensureOrganizeFolder();
    }
  }, [chatBasePath, ensureOrganizeFolder]);

  const handleSelectOrganizeFolder = useCallback(() => {
    if (!chatOrganizePath) return;
    toggleFolderExpand(chatOrganizePath);
  }, [chatOrganizePath, toggleFolderExpand]);

  const handleToggleSidebar = () => {
    const newValue = !sidebarVisible;
    setSidebarVisible(newValue);
    localStorageService.setString(STORAGE_KEYS.NOTES_SIDEBAR_VISIBLE, String(newValue));
  };

  const handleSelectFile = (file: FileTreeNode) => {
    setIsChatMode(false);
    selectFile(file);
  };

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

  if (!hasRootPath) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <FolderSelectModal onSelect={selectRootFolder} loading={loading} />
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
            onRemovePinnedFolder={removePinnedFolder}
            onReorderPinnedFolder={reorderPinnedFolder}
            onSwitchToFolder={switchToFolder}
            onSetChatPath={setChatPath}
            chatPath={chatPath}
            chatOrganizeTree={chatOrganizeTree}
          />
        )}

        {isChatMode ? (
          <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={handleToggleSidebar}
                  title={sidebarVisible ? '隐藏列表' : '显示列表'}
                >
                  <PanelLeft className="h-4 w-4" />
                </button>
                <h2 className="text-base font-medium text-gray-900 dark:text-white">快速记录想法，稍后整理</h2>
              </div>
              {selectedMessages.length > 0 && (
                <button
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
          <NotesEditor
            selectedFile={selectedFile}
            content={fileContent}
            fileMetadata={fileMetadata}
            filePreviewUrl={filePreviewUrl}
            onContentChange={updateFileContent}
            onSave={saveFile}
            sidebarVisible={sidebarVisible}
            onToggleSidebar={handleToggleSidebar}
            onCreateNote={() => handleOpenCreateDialog('note')}
            onCreateFolder={() => handleOpenCreateDialog('folder')}
          />
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
    </div>
  );
};

export default NotesPage;