import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileText, Save, Edit3, PanelLeft, FolderPlus, FilePlus, FileText as FileWord, Table2, FileImage, Code, Play } from 'lucide-react';
import WMarkdownEditor from '@/components/WMarkdownEditor';
import { useThemeStore } from '@/store/themeStore';
import { FileViewer } from '@open-file-viewer/react';
import { imagePlugin, pdfPlugin, officePlugin, fallbackPlugin } from '@open-file-viewer/core';
import '@open-file-viewer/core/style.css';
import { FileTreeNode, FileMetadata } from '@/hooks/useNotes';
import { useToastStore } from '@/store/toastStore';
import { useNotesDrafts } from '../hooks/useNotesDrafts';
import { useNotesSearchScroll } from '../hooks/useNotesSearchScroll';
import { useNotesStats } from '../hooks/useNotesStats';
import { useNotesAttachments } from '../hooks/useNotesAttachments';
import { useNotesTabsStore } from '../../../../store/notesTabsStore';
import NotesEditorStats from './NotesEditorStats';
import NotesImageViewer from './NotesImageViewer';

// canPlayType 必须带 codecs，否则恒为 "maybe"
const VIDEO_CODEC_PROBES: Record<string, string> = {
  mp4: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
  m4v: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
  mov: 'video/mp4; codecs="avc1.42E01E"',
  webm: 'video/webm; codecs="vp8,vorbis"',
  ogv: 'video/ogg; codecs="theora,vorbis"',
  mkv: 'video/x-matroska; codecs="avc1.42E01E"',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
};

function canPlayVideoInApp(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
  const probe = VIDEO_CODEC_PROBES[ext];
  if (!probe) return false;
  try {
    return document.createElement('video').canPlayType(probe) !== '';
  } catch {
    return false;
  }
}

// 超限文件不进 <video>，交给系统播放器
const MAX_INLINE_VIDEO_BYTES = 500 * 1024 * 1024;

// 文件名拆分为「主名 + 后缀」：重命名时只编辑主名，后缀单独固定展示并提交，
// 避免双击编辑时误删 .md 之类后缀（删掉会改变文件类型、图标与解析方式）。
// 无后缀或点开头的文件（.gitignore 等）整体视为主名，不给空主名。
function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

// 派生 state
type VideoPlayback = { mode: 'checking' } | { mode: 'play' } | { mode: 'external'; notice: string };

interface NotesEditorProps {
  selectedFile: FileTreeNode | null;
  content: string;
  fileMetadata: FileMetadata | null;
  filePreviewUrl: string | null;
  onContentChange: (content: string) => void;
  onSave: (content: string) => Promise<boolean>;
  onRenameFile: (newName: string) => Promise<boolean>;
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
  onRenameFile,
  sidebarVisible = true,
  onToggleSidebar,
  onCreateNote,
  onCreateFolder,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [htmlViewMode, setHtmlViewMode] = useState<'preview' | 'source'>('preview');
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [verifiedPaths, setVerifiedPaths] = useState<Record<string, true>>({});
  const [externalNotices, setExternalNotices] = useState<Record<string, string>>({});
  const videoPlayback: VideoPlayback = (() => {
    const path = selectedFile?.fileType === 'video' ? selectedFile.path : null;
    if (!path) return { mode: 'checking' };
    if (verifiedPaths[path]) return { mode: 'play' };
    if (externalNotices[path]) return { mode: 'external', notice: externalNotices[path] };
    return { mode: 'checking' };
  })();
  const addToast = useToastStore((state) => state.addToast);
  const [previewVisible, setPreviewVisible] = useState(true);
  const lastSavedContentRef = useRef(content);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentFilePathRef = useRef<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const drafts = useNotesDrafts();
  useNotesSearchScroll();
  const statsHook = useNotesStats(selectedFile?.path);
  const { upload: handleUpload } = useNotesAttachments(selectedFile?.path);

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

  // 切文件时复位
  useEffect(() => {
    setHtmlViewMode('preview');
    setRenameDraft(null);
  }, [selectedFile?.path]);

  // 编码 + 体积都通过才把 src 交给 <video>
  useEffect(() => {
    const path = selectedFile?.path;
    if (!path || selectedFile?.fileType !== 'video') return;

    let cancelled = false;

    if (verifiedPaths[path] || externalNotices[path]) return;

    if (!canPlayVideoInApp(path)) {
      setExternalNotices((m) => ({
        ...m,
        [path]: '该视频无法在应用内播放（当前运行环境缺少对应编解码器）。',
      }));
      return;
    }

    (async () => {
      let size = 0;
      let statOk = false;
      try {
        const result = await window.electron?.notes.statFile?.(path);
        if (result && result.success) {
          size = result.size ?? 0;
          statOk = true;
        }
      } catch {
        /* 落下方 statOk=false 分支 */
      }
      if (cancelled) return;
      if (!statOk) {
        setExternalNotices((m) => ({
          ...m,
          [path]: '无法读取视频文件信息，已改为用系统播放器打开。',
        }));
        return;
      }
      if (size > MAX_INLINE_VIDEO_BYTES) {
        setExternalNotices((m) => ({
          ...m,
          [path]: `视频体积 ${(size / 1024 / 1024 / 1024).toFixed(2)}GB，超过内嵌播放上限 500MB，内置播放器加载时会崩溃。`,
        }));
        return;
      }
      setVerifiedPaths((s) => ({ ...s, [path]: true }));
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFile?.path, selectedFile?.fileType, verifiedPaths, externalNotices]);



  // 重算统计
  useEffect(() => {
    statsHook.recompute(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, selectedFile?.path]);

  // 用 ref 跟踪切走时的脏态与内容
  const isDirtyRef = useRef(false);
  const lastContentForFlushRef = useRef(content);
  useEffect(() => {
    isDirtyRef.current = isDirty;
    lastContentForFlushRef.current = content;
  }, [isDirty, content]);

  // 切文件时把未保存内容 flush 成草稿
  useEffect(() => {
    const prevPath = currentFilePathRef.current;
    const nextPath = selectedFile?.path ?? null;
    currentFilePathRef.current = nextPath;
    lastSavedContentRef.current = content;
    setTimeout(() => setIsDirty(false), 0);

    return () => {
      if (prevPath && prevPath !== nextPath && isDirtyRef.current) {
        if (prevPath) useNotesTabsStore.getState().setDirty(prevPath, false);
        drafts
          .flushNow(prevPath, lastContentForFlushRef.current)
          .catch((err: unknown) => console.warn('[NotesEditor] cleanup flushNow failed:', err));
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile?.path]);

  // 自动保存 2s 防抖
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
        if (selectedFile?.path) useNotesTabsStore.getState().setDirty(selectedFile.path, false);
        if (selectedFile?.path) {
          drafts.deleteDraftNow(selectedFile.path).catch(() => {
            /* best-effort */
          });
        }
      }
      setIsSaving(false);
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, isDirty, selectedFile, onSave, drafts]);

  const handleContentChange = useCallback(
    (value: string) => {
      onContentChange(value);
      setIsDirty(value !== lastSavedContentRef.current);
      // 脏态上报标签页
      if (selectedFile?.path) {
        useNotesTabsStore.getState().setDirty(selectedFile.path, value !== lastSavedContentRef.current);
        drafts.scheduleDraft(selectedFile.path, value);
      }
    },
    [onContentChange, selectedFile?.path, drafts]
  );

  const handleSave = useCallback(
    async (value: string) => {
      if (!selectedFile) return;

      setIsSaving(true);
      const success = await onSave(value);
      if (success) {
        setIsDirty(false);
        lastSavedContentRef.current = value;
        useNotesTabsStore.getState().setDirty(selectedFile.path, false);
        drafts.deleteDraftNow(selectedFile.path).catch(() => {
          /* best-effort */
        });
      }
      setIsSaving(false);
    },
    [selectedFile, onSave, drafts]
  );

  // 双击标题进入重命名：只带入主名，后缀不进输入框（输入框右侧单独展示，提交时自动补回）
  const startRename = useCallback(() => {
    if (selectedFile) setRenameDraft(splitFileName(selectedFile.name).base);
  }, [selectedFile]);

  const cancelRename = useCallback(() => setRenameDraft(null), []);

  // 空值/未改动视为取消；提交时把后缀补回主名（用户自己输入了同名后缀则不再重复追加）
  const commitRename = useCallback(async () => {
    const draft = renameDraft?.trim();
    setRenameDraft(null);
    if (!selectedFile || !draft) return;
    const { ext } = splitFileName(selectedFile.name);
    const withExt =
      ext && draft.toLowerCase().endsWith(ext.toLowerCase()) ? draft : `${draft}${ext}`;
    if (withExt === selectedFile.name) return;
    const ok = await onRenameFile(withExt);
    if (!ok) addToast({ type: 'error', message: '重命名失败，名称可能已存在' });
  }, [renameDraft, selectedFile, onRenameFile, addToast]);

  // 编辑态下固定展示的后缀（不参与编辑，提交时按此补回）
  const renameExt = selectedFile ? splitFileName(selectedFile.name).ext : '';

  // 图片预览
  const localMediaUrl = useMemo(() => {
    if (!selectedFile) return null;
    return `local-media://host/${encodeURIComponent(selectedFile.path.replace(/\\/g, '/'))}`;
  }, [selectedFile]);

  // 视频直连
  const videoFileUrl = useMemo(() => {
    if (!selectedFile) return null;
    return `file:///${selectedFile.path.replace(/\\/g, '/').replace(/[%#?]/g, encodeURIComponent)}`;
  }, [selectedFile]);

  // 容器不可见时暂停加载
  useEffect(() => {
    if (!previewContainerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setPreviewVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.01 }
    );
    observer.observe(previewContainerRef.current);

    const onVisibility = () => setPreviewVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

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
      video: '视频',
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
      case 'video':
        return <Play className="h-5 w-5 text-blue-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const renderEditor = () => {
    const fileType = fileMetadata?.fileType;

    // image 走 local-media://
    if (fileType === 'image' && localMediaUrl) {
      return <NotesImageViewer src={localMediaUrl} alt={selectedFile?.name || ''} />;
    }

    if (fileType === 'video') {
      if (!selectedFile) return null;

      // 编码不支持 / 体积超限 / 加载失败
      if (videoPlayback.mode === 'external') {
        return (
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
            <Play className="h-10 w-10 text-gray-300" />
            <span className="max-w-full truncate text-sm text-gray-600 dark:text-gray-300">
              {selectedFile.name}
            </span>
            <p className="max-w-sm text-xs leading-relaxed text-gray-400">
              {videoPlayback.notice}请用系统播放器打开。
            </p>
            <button
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-button-text transition-colors hover:bg-primary-hover"
              onClick={() => window.electron?.openFile(selectedFile.path)}
            >
              外部打开
            </button>
          </div>
        );
      }
      return (
        <div
          ref={previewContainerRef}
          className="flex flex-1 min-h-0 overflow-auto bg-black"
        >
          {previewVisible && videoPlayback.mode === 'play' ? (
            <video
              key={selectedFile.path}
              src={videoFileUrl ?? ''}
              controls
              preload="metadata"
              className="w-full h-full object-contain"
              onError={() =>
                setExternalNotices((m) => ({
                  ...m,
                  [selectedFile.path]: '视频加载失败，可能是文件已损坏或编码不受支持。',
                }))
              }
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              {previewVisible ? '正在检查视频…' : '切到后台时已暂停加载'}
            </div>
          )}
        </div>
      );
    }

    if (
      (fileType === 'pdf' || fileType === 'docx' || fileType === 'xlsx') &&
      filePreviewUrl
    ) {
      // 仅可见时挂载
      return (
        <div
          ref={previewContainerRef}
          className="flex flex-1 min-h-0 overflow-auto"
        >
          {previewVisible ? (
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
          ) : (
            <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
              切到后台时已暂停加载预览
            </div>
          )}
        </div>
      );
    }

    if (fileType === 'html') {
      return (
        <div className="flex flex-1 flex-col min-h-0">
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
            <div className="flex flex-1 min-h-0 overflow-auto">
              <iframe
                key={`${selectedFile?.path}-${!!content}`}
                srcDoc={content}
                sandbox="allow-scripts allow-forms allow-links allow-popups"
                className="w-full flex-1 border-0"
                title={selectedFile?.name || 'HTML Preview'}
              />
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 overflow-auto">
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
      <div className="flex flex-1 min-h-0 overflow-auto">
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
      <section className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* 与打开笔记后的头部保持一致：侧边栏开关常驻，列表被隐藏后仍有入口恢复 */}
        <div className="flex flex-shrink-0 items-center gap-3 bg-gray-50/40 dark:bg-gray-800/30 px-4 py-2">
          {onToggleSidebar ? (
            <button
              className="rounded p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={onToggleSidebar}
              title={sidebarVisible ? '隐藏列表' : '显示列表'}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
            <Edit3 className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-300">
            还没有打开笔记
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-gray-400">
            {sidebarVisible
              ? '从左侧文件树选择一篇笔记开始编辑，也可以现在新建'
              : '列表已隐藏，点击左上角图标显示文件树，或直接新建一篇'}
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
              className="flex items-center gap-2 rounded-lg bg-white/60 dark:bg-gray-900/40 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100/40 dark:hover:bg-gray-800/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FolderPlus className="h-4 w-4" />
              新建文件夹
            </button>
          </div>

          <p className="mt-8 text-xs text-gray-400">
            Ctrl + Shift + F 全文搜索 · 拖入文件到左侧列表即可导入
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col min-h-0 min-w-0">
      {/* flex-shrink-0：头部固定，滚动只发生在下方内容区 */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-3 bg-gray-50/40 dark:bg-gray-800/30 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex min-w-0 items-center gap-2 text-sm">
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
            {renameDraft === null ? (
              <span
                className="cursor-text truncate font-medium text-gray-900 dark:text-white"
                onDoubleClick={startRename}
                title="双击重命名"
              >
                {selectedFile.name}
              </span>
            ) : (
              // 输入框只编辑主名，后缀紧随其后固定展示，避免误删导致文件类型变化
              <span className="flex min-w-0 items-center">
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  onBlur={() => {
                    void commitRename();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // 输入法组合态下的回车是「确认候选词」，此时 value 还是拼音串，提交会把文件改成拼音
                      if (e.nativeEvent.isComposing) return;
                      e.preventDefault();
                      void commitRename();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  className="min-w-0 max-w-[240px] rounded border border-primary bg-white/60 px-1 py-0.5 text-sm text-gray-900 outline-none dark:bg-gray-900/40 dark:text-white"
                />
                {renameExt && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">{renameExt}</span>
                )}
              </span>
            )}
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
            <NotesEditorStats
              stats={statsHook.stats}
              visible={
                fileMetadata?.fileType === 'md' ||
                fileMetadata?.fileType === 'txt' ||
                fileMetadata?.fileType === 'html' ||
                fileMetadata?.fileType === 'json'
              }
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
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
      </div>

      {/* 内容区唯一滚动容器：min-h-0 内部滚动，overscroll-contain 防带滚外层 */}
      <div className="relative flex flex-1 flex-col min-h-0 min-w-0 overflow-auto overscroll-contain">
        {renderEditor()}
      </div>
    </section>
  );
};

export default NotesEditor;