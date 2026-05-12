import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileText, Save, Edit3 } from 'lucide-react';
import WMarkdownEditor from '@/components/WMarkdownEditor';
import { useThemeStore } from '@/store/themeStore';

interface FileTreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileTreeNode[];
  expanded?: boolean;
  active?: boolean;
}

interface NotesEditorProps {
  selectedFile: FileTreeNode | null;
  content: string;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<boolean>;
}

const NotesEditor: React.FC<NotesEditorProps> = ({
  selectedFile,
  content,
  onContentChange,
  onSave,
}) => {
  const { isDark } = useThemeStore();
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const lastSavedContentRef = useRef(content);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentFilePathRef = useRef<string | null>(null);

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
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col bg-white dark:bg-gray-900">
      <div className="relative z-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-5 w-5 text-blue-500" />
            <span className="font-medium text-gray-900 dark:text-white">
              {selectedFile.name}
            </span>
            {isDirty && (
              <span className="text-xs text-amber-500">● 未保存</span>
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

        <button
          className="flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => handleSave(content)}
          disabled={!isDirty || isSaving}
        >
          <Save className="h-4 w-4" />
          保存
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <WMarkdownEditor
          value={content}
          onChange={handleContentChange}
          onSave={handleSave}
          mode="ir"
          height="100%"
          placeholder="开始编写您的笔记..."
          theme={isDark ? 'dark' : 'classic'}
        />
      </div>
    </section>
  );
};

export default NotesEditor;