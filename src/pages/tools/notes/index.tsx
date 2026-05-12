import React from 'react';
import { useNotes } from '@/hooks/useNotes';
import FolderSelectModal from './components/FolderSelectModal';
import NotesSidebar from './components/NotesSidebar';
import NotesEditor from './components/NotesEditor';

const NotesPage: React.FC = () => {
  const {
    hasRootPath,
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
          onSelectFile={selectFile}
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
        />

        <NotesEditor
          selectedFile={selectedFile}
          content={fileContent}
          onContentChange={updateFileContent}
          onSave={saveFile}
        />
      </main>
    </div>
  );
};

export default NotesPage;