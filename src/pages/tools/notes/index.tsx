import React, { useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNotes } from '@/hooks/useNotes';
import { useChatNotes } from './hooks/useChatNotes';
import FolderSelectModal from './components/FolderSelectModal';
import NotesSidebar from './components/NotesSidebar';
import NotesEditor from './components/NotesEditor';
import { ChatMessageList } from './components/ChatMessageList';
import { ChatInput } from './components/ChatInput';
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToastStore } from '@/store/toastStore';
import { isElectron } from '@/utils/environment';
import { marked } from 'marked';

marked.setOptions({
  breaks: true,
});

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

  const addToast = useToastStore((state) => state.addToast);

  const handleExportFile = useCallback(async (
    filePath: string,
    format: 'pdf' | 'docx'
  ) => {
    if (!isElectron() || !window.electron?.notes) {
      addToast({ message: '导出功能仅支持桌面端', type: 'error' });
      return;
    }

    const result = await window.electron.notes.readFile(filePath);
    if (!result.success || result.content === undefined) {
      addToast({ message: '导出失败：无法读取文件', type: 'error' });
      return;
    }

    const fileName = filePath.split(/[/\\]/).pop()?.replace('.md', '') || '笔记';
    const content = result.content;

    if (format === 'pdf') {
      try {
        addToast({ message: '正在生成 PDF...', type: 'info' });

        const container = document.createElement('div');
        container.innerHTML = await marked(content);
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.width = '800px';
        container.style.padding = '40px';
        container.style.background = '#ffffff';
        container.style.fontFamily = 'Noto Sans SC, Microsoft YaHei, sans-serif';
        document.body.appendChild(container);

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
        });

        document.body.removeChild(container);

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height],
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${fileName}.pdf`);

        addToast({ message: `PDF 已导出: ${fileName}.pdf`, type: 'success' });
      } catch (error) {
        console.error('PDF 导出失败:', error);
        addToast({ message: 'PDF 导出失败', type: 'error' });
      }
    } else {
      try {
        addToast({ message: '正在生成 Word 文档...', type: 'info' });

        const lines = content.split('\n');
        const paragraphs: Paragraph[] = [];

        for (const line of lines) {
          if (line.startsWith('# ')) {
            paragraphs.push(new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun(line.substring(2))],
            }));
          } else if (line.startsWith('## ')) {
            paragraphs.push(new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun(line.substring(3))],
            }));
          } else if (line.startsWith('### ')) {
            paragraphs.push(new Paragraph({
              heading: HeadingLevel.HEADING_3,
              children: [new TextRun(line.substring(4))],
            }));
          } else if (line.startsWith('#### ')) {
            paragraphs.push(new Paragraph({
              heading: HeadingLevel.HEADING_4,
              children: [new TextRun(line.substring(5))],
            }));
          } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
            paragraphs.push(new Paragraph({
              indent: { left: 720 },
              children: [new TextRun(line)],
            }));
          } else if (line.startsWith('> ')) {
            paragraphs.push(new Paragraph({
              alignment: 'right',
              children: [new TextRun(line.substring(2))],
            }));
          } else if (line.startsWith('```')) {
            paragraphs.push(new Paragraph({
              children: [new TextRun(line)],
            }));
          } else {
            let textRuns: TextRun[] = [];
            let remaining = line;

            while (remaining.length > 0) {
              const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
              const italicMatch = remaining.match(/^\*(.+?)\*/);

              if (boldMatch) {
                textRuns.push(new TextRun({ text: boldMatch[1], bold: true }));
                remaining = remaining.substring(boldMatch[0].length);
              } else if (italicMatch) {
                textRuns.push(new TextRun({ text: italicMatch[1], italics: true }));
                remaining = remaining.substring(italicMatch[0].length);
              } else {
                textRuns.push(new TextRun(remaining));
                break;
              }
            }

            paragraphs.push(new Paragraph({ children: textRuns }));
          }
        }

        const doc = new Document({
          sections: [{
            properties: {},
            children: paragraphs,
          }],
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addToast({ message: `Word 文档已导出: ${fileName}.docx`, type: 'success' });
      } catch (error) {
        console.error('Word 导出失败:', error);
        addToast({ message: 'Word 导出失败', type: 'error' });
      }
    }
  }, [addToast]);

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
          onExportFile={handleExportFile}
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