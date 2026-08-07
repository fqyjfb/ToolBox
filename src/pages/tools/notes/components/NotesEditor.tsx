import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileText, Save, Edit3, PanelLeft, FolderPlus, FilePlus, FileText as FileWord, Table2, FileImage, Code } from 'lucide-react';
import WMarkdownEditor from '@/components/WMarkdownEditor';
import { useThemeStore } from '@/store/themeStore';
import { FileViewer } from '@open-file-viewer/react';
import { imagePlugin, pdfPlugin, officePlugin, fallbackPlugin } from '@open-file-viewer/core';
import '@open-file-viewer/core/style.css';

interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  fileType?: 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf';
  children?: FileTreeNode[];
  expanded?: boolean;
  active?: boolean;
}

interface FileMetadata {
  filePath: string;
  fileType: 'md' | 'txt' | 'html' | 'json' | 'docx' | 'xlsx' | 'image' | 'pdf';
  mimeType?: string;
}

interface NotesEditorProps {
  selectedFile: FileTreeNode | null;
  content: string;
  fileMetadata: FileMetadata | null;
  filePreviewUrl: string | null;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<boolean>;
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  onCreateNote?: () => void;
  onCreateFolder?: () => void;
}

const NotesEditor: React.FC<NotesEditorProps> = ({
  selectedFile,
  content,
  fileMetadata,
  filePreviewUrl,
  onContentChange,
  onSave,
  sidebarVisible = true,
  onToggleSidebar,
  onCreateNote,
  onCreateFolder,
}) => {
  const { isDark } = useThemeStore();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [htmlViewMode, setHtmlViewMode] = useState<'preview' | 'source'>('preview');
  const lastSavedContentRef = useRef(content);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentFilePathRef = useRef<string | null>(null);

  const viewerPlugins = useMemo(
    () => [
      imagePlugin(),
      pdfPlugin(),
      officePlugin(),
      fallbackPlugin(),
    ],
    []
  );

  const viewerTheme = isDark ? 'dark' : 'light';

  const handleUpload = useCallback(async () => {
    const filePath = await window.electron?.selectFile();
    if (filePath) {
      return `file:///${filePath.replace(/\\/g, '/')}`;
    }
    return '';
  }, []);

  useEffect(() => {
    setHtmlViewMode('preview');
  }, [selectedFile?.path]);

  useEffect(() => {
    const filePath = selectedFile?.path ?? null;
    if (currentFilePathRef.current !== filePath) {
      currentFilePathRef.current = filePath;
      lastSavedContentRef.current = content;
      setTimeout(() => setIsDirty(false), 0);
    }
  }, [selectedFile?.path, content]);

  useEffect(() => {
    if (!isDirty || !selectedFile) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      const success = await onSave(content);
      if (success) {
        setIsDirty(false);
        lastSavedContentRef.current = content;
      }
      setIsSaving(false);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, isDirty, selectedFile, onSave]);

  const handleContentChange = useCallback(
    (value: string) => {
      onContentChange(value);
      setIsDirty(value !== lastSavedContentRef.current);
    },
    [onContentChange]
  );

  const handleSave = useCallback(
    async (value: string) => {
      if (!selectedFile) return;

      setIsSaving(true);
      const success = await onSave(value);
      if (success) {
        setIsDirty(false);
        lastSavedContentRef.current = value;
      }
      setIsSaving(false);
    },
    [selectedFile, onSave]
  );

  const getFileTypeLabel = () => {
    if (!fileMetadata) return '';
    const labels = {
      md: 'Markdown',
      txt: '纯文本',
      html: 'HTML',
      json: 'JSON',
      docx: 'Word 文档',
      xlsx: 'Excel 表格',
      image: '图片',
      pdf: 'PDF 文档',
    };
    return labels[fileMetadata.fileType] || '';
  };

  const getFileIcon = () => {
    if (!fileMetadata) return <FileText className="h-5 w-5 text-primary" />;
    switch (fileMetadata.fileType) {
      case 'md':
        return <FileText className="h-5 w-5 text-primary" />;
      case 'txt':
        return <FileText className="h-5 w-5 text-gray-500" />;
      case 'html':
        return <Code className="h-5 w-5 text-orange-500" />;
      case 'json':
        return <Code className="h-5 w-5 text-yellow-600" />;
      case 'docx':
        return <FileWord className="h-5 w-5 text-blue-600" />;
      case 'xlsx':
        return <Table2 className="h-5 w-5 text-green-600" />;
      case 'image':
        return <FileImage className="h-5 w-5 text-purple-600" />;
      case 'pdf':
        return <FileText className="h-5 w-5 text-orange-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const renderEditor = () => {
    const fileType = fileMetadata?.fileType;

    if ((fileType === 'image' || fileType === 'pdf' || fileType === 'docx' || fileType === 'xlsx') && filePreviewUrl) {
      return (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <FileViewer
            file={filePreviewUrl}
            fileName={selectedFile?.name || ''}
            width="100%"
            height="100%"
            fit="contain"
            toolbar
            theme={viewerTheme}
            locale="zh-CN"
            plugins={viewerPlugins}
          />
        </div>
      );
    }

    if (fileType === 'html') {
      return (
        <div className="flex flex-1 flex-col bg-white dark:bg-gray-900 min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <button
              className={`px-3 py-1 text-sm rounded transition-colors ${
                htmlViewMode === 'preview'
                  ? 'bg-primary text-button-text'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => setHtmlViewMode('preview')}
            >
              预览
            </button>
            <button
              className={`px-3 py-1 text-sm rounded transition-colors ${
                htmlViewMode === 'source'
                  ? 'bg-primary text-button-text'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => setHtmlViewMode('source')}
            >
              源码
            </button>
          </div>
          {htmlViewMode === 'preview' ? (
            <div className="flex flex-1 min-h-0 overflow-hidden bg-gray-50">
              <iframe
                key={selectedFile?.path}
                srcDoc={content}
                sandbox="allow-scripts allow-forms allow-links allow-popups"
                className="w-full flex-1 border-0"
                title={selectedFile?.name || 'HTML Preview'}
              />
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <WMarkdownEditor
                value={content}
                onChange={handleContentChange}
                onSave={handleSave}
                onUpload={handleUpload}
                mode="ir"
                height="100%"
                placeholder="编辑 HTML 源码..."
                theme={isDark ? 'dark' : 'classic'}
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <WMarkdownEditor
          value={content}
          onChange={handleContentChange}
          onSave={handleSave}
          onUpload={handleUpload}
          mode="ir"
          height="100%"
          placeholder="开始编写内容..."
          theme={isDark ? 'dark' : 'classic'}
        />
      </div>
    );
  };

  if (!selectedFile) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
          <Edit3 className="h-10 w-10 text-gray-400" />
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-300">
          选择或创建一个笔记
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          从左侧文件树选择笔记开始编辑
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onCreateNote}
            disabled={!onCreateNote}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-button-text transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FilePlus className="h-4 w-4" />
            新建笔记
          </button>
          <button
            onClick={onCreateFolder}
            disabled={!onCreateFolder}
            className="flex items-center gap-2 rounded-lg bg-white dark:bg-gray-800 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderPlus className="h-4 w-4" />
            新建文件夹
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col bg-white dark:bg-gray-900 min-w-0">
      <div className="relative z-10 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            {onToggleSidebar && (
              <button
                className="rounded p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                onClick={onToggleSidebar}
                title={sidebarVisible ? '隐藏列表' : '显示列表'}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
            {getFileIcon()}
            <span className="font-medium text-gray-900 dark:text-white">
              {selectedFile.name}
            </span>
            {getFileTypeLabel() && (
              <span className="px-2 py-0.5 text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 rounded">
                {getFileTypeLabel()}
              </span>
            )}
            {isDirty && (
              <span className="text-xs text-warning">● 未保存</span>
            )}
            {isSaving && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                保存中...
              </span>
            )}
          </div>
        </div>

        {(fileMetadata?.fileType === 'md' || fileMetadata?.fileType === 'txt' || fileMetadata?.fileType === 'html' || fileMetadata?.fileType === 'json') ? (
          <button
            className="flex items-center rounded-lg bg-primary px-2 py-1.5 text-button-text transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => handleSave(content)}
            disabled={!isDirty || isSaving}
            title="保存"
          >
            <Save className="h-4 w-4" />
          </button>
        ) : (
          <button
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => selectedFile && window.electron?.openFile(selectedFile.path)}
            title="在外部打开"
          >
            外部打开
          </button>
        )}
      </div>

      <div className="relative flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        {renderEditor()}
      </div>
    </section>
  );
};

export default NotesEditor;