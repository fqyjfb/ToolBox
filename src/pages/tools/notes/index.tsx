import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNotes } from '@/hooks/useNotes';
import { useChatNotes } from './hooks/useChatNotes';
import FolderSelectModal from './components/FolderSelectModal';
import NotesSidebar from './components/NotesSidebar';
import NotesEditor from './components/NotesEditor';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatInput } from './components/ChatInput';

const NotesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const chatModeParam = searchParams.get('chatMode');
  const {
    hasRootPath,
    rootPath,
    fileTree,
    selectedFile,
    fileContent,
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
    toggleFolderExpand,
    refreshFileTree,
    rebuildIndex,
    changeFolder,
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
  } = useChatNotes({ rootPath, onRefreshFileTree: refreshFileTree });

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

  const handleSelectFile = (file: typeof selectedFile) => {
    if (file) {
      setIsChatMode(false);
      selectFile(file);
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
        <NotesSidebar
          fileTree={fileTree}
          selectedFile={selectedFile}
          onSelectFile={handleSelectFile}
          onToggleFolder={toggleFolderExpand}
          onCreateFolder={createFolder}
          onCreateFolderForce={createFolderForce}
          onCreateNote={createNote}
          onCreateNoteForce={createNoteForce}
          onRenameItem={renameItem}
          onDeleteItem={deleteItem}
          onRefresh={refreshFileTree}
          onRebuildIndex={rebuildIndex}
          onChangeFolder={changeFolder}
          loading={loading}
          isChatMode={isChatMode}
          onToggleChatMode={handleToggleChatMode}
        />

        {isChatMode ? (
          <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <div>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">聊天记录</h2>
                <p className="text-xs text-gray-400">快速记录想法，稍后整理</p>
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
            onContentChange={updateFileContent}
            onSave={saveFile}
          />
        )}
      </main>
    </div>
  );
};

export default NotesPage;