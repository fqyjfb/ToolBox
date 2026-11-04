import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileText, Save, Edit3, PanelLeft, FolderPlus, FilePlus, FileText as FileWord, Table2, FileImage, Code, Play, FileDown, FileCode2, Eye } from 'lucide-react';
import { buildExportHtml } from '@/lib/markdown';
import MarkdownEditor from '@/components/MarkdownEditor';
import PlainTextEditor from '@/components/PlainTextEditor';
import OverflowMenu, { type OverflowMenuItem } from '@/components/ui/OverflowMenu';
import { useThemeStore } from '@/store/themeStore';
import { FileViewer } from '@open-file-viewer/react';
import { imagePlugin, pdfPlugin, officePlugin, fallbackPlugin } from '@open-file-viewer/core';
import '@open-file-viewer/core/style.css';
import { FileTreeNode, FileMetadata } from '@/hooks/useNotes';
import { useToastStore } from '@/store/toastStore';
import type { UseNotesDraftsReturn } from '../hooks/useNotesDrafts';
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS } from '../constants/limits';
import { useNotesSearchScroll } from '../hooks/useNotesSearchScroll';
import { useNotesStats } from '../hooks/useNotesStats';
import { useNotesAttachments } from '../hooks/useNotesAttachments';
import { useNotesTabsStore } from '../../../../store/notesTabsStore';
import NotesEditorStats from './NotesEditorStats';
import NotesImageViewer from './NotesImageViewer';
// 图片 URL 拼接统一走 lib 的唯一实现，避免与 Markdown 渲染/导出产生第二份路径逻辑（G15）
import {
  isExternalAsset,
  localMediaUrl as toLocalMediaUrl,
  resolveAssetPath,
} from '@/lib/markdown/resolveAssetUrl';

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

// 保存时间：同一天只显示 HH:mm，跨天补上日期；不显示"相对时间"（否则需要常驻定时器刷新）
function formatSavedAt(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return new Date().toDateString() === d.toDateString()
    ? ` · ${hm}`
    : ` · ${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

type VideoPlayback = { mode: 'checking' } | { mode: 'play' } | { mode: 'external'; notice: string };

interface NotesEditorProps {
  selectedFile: FileTreeNode | null;
  content: string;
  /** 磁盘基线：脏态 = content !== savedContent（派生，组件内不再维护 isDirty state） */
  savedContent: string;
  fileMetadata: FileMetadata | null;
  filePreviewUrl: string | null;
  onContentChange: (content: string) => void;
  onSave: (content: string, path?: string) => Promise<boolean>;
  onRenameFile: (newName: string) => Promise<boolean>;
  /** 草稿写入器：页面级唯一实例，避免多个实例各持一套定时器 */
  drafts: UseNotesDraftsReturn;
  /** 自动保存暂停（冲突裁决 / 草稿恢复期间）：只停写文件，草稿照写 */
  autoSavePaused?: boolean;
  sidebarVisible?: boolean;
  onToggleSidebar?: () => void;
  onCreateNote?: () => void;
  onCreateFolder?: () => void;
}

const NotesEditor: React.FC<NotesEditorProps> = ({
  selectedFile,
  content,
  savedContent,
  fileMetadata,
  filePreviewUrl,
  onContentChange,
  onSave,
  onRenameFile,
  drafts,
  autoSavePaused = false,
  sidebarVisible = true,
  onToggleSidebar,
  onCreateNote,
  onCreateFolder,
}) => {
  const isDark = useThemeStore((s) => s.isDark);
  // 脏态只由"读盘 / 落盘成功"推进，组件内不允许再写
  const isDirty = content !== savedContent;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 保存时间按文件记录：切走再切回仍能看到"上次保存于"，且不受异步保存完成时机影响
  const [savedAtByPath, setSavedAtByPath] = useState<Record<string, number>>({});
  const savedAt = selectedFile?.path ? savedAtByPath[selectedFile.path] ?? null : null;
  // 四态全部由 isDirty / isSaving / saveError 派生，没有"忘记复位"的可能
  const saveState: 'clean' | 'dirty' | 'saving' | 'error' = isSaving
    ? 'saving'
    : saveError
      ? 'error'
      : isDirty
        ? 'dirty'
        : 'clean';
  const editableFile =
    fileMetadata?.fileType === 'md' ||
    fileMetadata?.fileType === 'txt' ||
    fileMetadata?.fileType === 'html' ||
    fileMetadata?.fileType === 'json';
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
  // 编辑/阅读模式：控制 MarkdownEditor 的 view（持久化用 localStorage 的默认值，对齐 MarkdownEditor 内部 DEFAULT_MODE）
  const [mode, setMode] = useState<'edit' | 'read'>(() => {
    try {
      const v = localStorage.getItem('md-editor-mode') as 'edit' | 'read' | null;
      return v === 'edit' || v === 'read' ? v : 'edit';
    } catch {
      return 'edit';
    }
  });
  // 保存链路（唯一入口 persist）的过程态与守卫
  const contentRef = useRef(content);
  contentRef.current = content; // 异步回调始终读最新内容，不用闭包旧值
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFilePathRef = useRef<string | null>(null);
  const savingRef = useRef(false); // 互斥：state 有提交延迟，判重入必须用 ref
  const savingPathRef = useRef<string | null>(null); // 正在保存哪个文件（切文件时判断"内容是否即将落盘"）
  const pendingRef = useRef(false); // 合流：保存期间又来的请求，完成后再补一次
  // 仅用于"同一文件同一内容不重复写盘"，不参与脏态判定（脏态仍是 content !== savedContent）
  const lastSavedRef = useRef<{ path: string; payload: string } | null>(null);
  const dirtySinceRef = useRef<number | null>(null); // 变脏起点，用于最长等待
  const previewContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    statsHook.recompute(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, selectedFile?.path]);

  // 切走文件的兜底快照：本 effect 晚于"切文件 effect 的 cleanup"重跑，
  // 所以 cleanup 里读到的仍是旧文件最后一次渲染的内容（contentRef 已在 render 期被新值覆盖，不能用）。
  const flushSnapshotRef = useRef<{ content: string; dirty: boolean }>({ content, dirty: isDirty });
  useEffect(() => {
    flushSnapshotRef.current = { content, dirty: isDirty };
  }, [content, isDirty]);

  /**
   * 唯一落盘入口：自动保存 / 按钮 / Ctrl+S / 切文件 / 冲突 keep-mine 全部走这里。
   *
   * - 互斥 + 合流：保存期间的新输入不丢，完成后立刻补写一次
   * - 路径守卫：目标路径显式传入，父级只回灌"当前打开文件"的内容
   * - 基线快照：落盘的是发起时的 payload，不是完成时的 content（否则保存期间的输入会被误标为已保存）
   * - finally：任何异常都不会把 UI 卡在"保存中"
   */
  const persist = useCallback(
    async (
      reason: 'manual' | 'auto' | 'switch' | 'conflict',
      targetPath?: string,
      payloadOverride?: string
    ): Promise<boolean> => {
      const path = targetPath ?? selectedFile?.path;
      if (!path) return false;
      if (savingRef.current) {
        pendingRef.current = true;
        return false;
      }

      savingRef.current = true;
      savingPathRef.current = path;
      setIsSaving(true);
      setSaveError(null);

      // 显式指定内容的保存（切文件 / 冲突）只写一次，绝不在循环里补写
      const singleShot = payloadOverride !== undefined;
      let nextPayload = payloadOverride;
      try {
        let ok = true;
        do {
          pendingRef.current = false;
          // 补写只允许"目标文件仍是当前打开文件"：否则会把新文件的内容写进旧文件
          const payload =
            nextPayload ?? (path === currentFilePathRef.current ? contentRef.current : null);
          nextPayload = undefined; // 只对第一次生效：循环补写必须取最新内容
          if (payload === null) break;
          // 同一文件同一内容不重复写盘（clean 态点击 / Ctrl+S 连按），mtime 不抖动
          if (lastSavedRef.current?.path === path && lastSavedRef.current.payload === payload) break;

          ok = await onSave(payload, path);
          if (!ok) {
            setSaveError('保存失败');
            return false;
          }
          lastSavedRef.current = { path, payload };
          // 收尾都是 path 级别的：即使期间切走了，也该清理该文件的草稿与脏点
          setSavedAtByPath((m) => ({ ...m, [path]: Date.now() }));
          void drafts.deleteDraftNow(path).catch(() => undefined);
          useNotesTabsStore.getState().setDirty(path, false);
        } while (!singleShot && pendingRef.current);
        return ok;
      } catch (err) {
        console.error('[NotesEditor] 保存失败', reason, err);
        setSaveError('保存失败');
        return false;
      } finally {
        savingRef.current = false;
        savingPathRef.current = null;
        setIsSaving(false);
      }
    },
    [drafts, onSave, selectedFile?.path]
  );

  // 切文件：先尝试落盘（比草稿可靠），失败才退回草稿兜底
  useEffect(() => {
    const prevPath = currentFilePathRef.current;
    const nextPath = selectedFile?.path ?? null;
    currentFilePathRef.current = nextPath;
    setSaveError(null); // 错误态属于上一个文件，切走后不能继续挂在标题栏上

    return () => {
      if (!prevPath || prevPath === nextPath) return;
      const snap = flushSnapshotRef.current;
      if (!snap.dirty) return;
      // 该文件正在保存：内容即将落盘，不必再写一份草稿（否则会留下与磁盘一致的冗余草稿）
      if (savingPathRef.current === prevPath) return;
      void persist('switch', prevPath, snap.content).then((ok) => {
        if (!ok) void drafts.flushNow(prevPath, snap.content).catch(() => undefined);
      });
    };
  }, [selectedFile?.path, persist, drafts]);

  // 自动保存：2s 防抖 + 30s 最长等待；冲突 / 恢复弹窗期间暂停写文件（草稿照写）
  useEffect(() => {
    if (!isDirty || !selectedFile || autoSavePaused) {
      if (!isDirty) dirtySinceRef.current = null;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    const now = Date.now();
    if (dirtySinceRef.current === null) dirtySinceRef.current = now;
    const elapsed = now - dirtySinceRef.current;
    // 连续输入时防抖会被无限重置，必须有上限，否则一次崩溃丢整段
    const delay = Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS - elapsed));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void persist('auto');
    }, delay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [autoSavePaused, isDirty, persist, selectedFile]);

  const handleContentChange = useCallback(
    (value: string) => {
      // 编辑器在加载文档时会用同一内容回调一次 onChange：
      // 这不是用户编辑，必须原样忽略，否则"打开文件"就会被判成一次改动（甚至误删该文件的草稿）。
      if (value === content) {
        onContentChange(value); // 防御：父级内容若落后则补齐，但不触碰脏态与草稿
        return;
      }
      onContentChange(value);
      const path = selectedFile?.path;
      if (!path) return;
      const dirty = value !== savedContent;
      // 标签页脏点是 UI 镜像，由派生脏态单向驱动
      useNotesTabsStore.getState().setDirty(path, dirty);
      if (dirty) drafts.scheduleDraft(path, value);
      else void drafts.deleteDraftNow(path).catch(() => undefined);
    },
    [content, onContentChange, selectedFile?.path, savedContent, drafts]
  );

  // 导出：渲染层构建 HTML（图片内联为 data-uri）→ 主进程打印并弹保存对话框落盘
  const exportingRef = useRef(false);
  const handleExport = useCallback(
    async (kind: 'pdf' | 'html') => {
      // 一次导出可能几十秒（内联图片 / PDF 打印），连点会叠出多个保存对话框
      if (!selectedFile || exportingRef.current) return;
      exportingRef.current = true;
      const noteDir = selectedFile.path.replace(/[\\/][^\\/]*$/, '');
      const baseName = selectedFile.name.replace(/\.[^.]+$/, '') || 'note';
      try {
        const html = await buildExportHtml(content, { noteDir, title: baseName });
        const api = window.electron?.notes;
        const result =
          kind === 'pdf'
            ? await api?.exportPdf({ html, defaultPath: `${baseName}.pdf` })
            : await api?.exportHtml({ html, defaultPath: `${baseName}.html` });
        if (result && result.success === false) {
          addToast({ type: 'error', message: result.error || '导出失败' });
        }
      } catch (error) {
        console.error('[NotesEditor] 导出失败', error);
        addToast({ type: 'error', message: '导出失败' });
      } finally {
        exportingRef.current = false;
      }
    },
    [addToast, content, selectedFile],
  );

  // 头部「更多」菜单：当前只承载导出，后续同类操作直接追加到这里
  const exportMenuItems = useMemo<OverflowMenuItem[]>(
    () => [
      {
        key: 'export-pdf',
        label: '导出 PDF',
        icon: <FileDown className="h-4 w-4" />,
        onClick: () => void handleExport('pdf'),
      },
      {
        key: 'export-html',
        label: '导出 HTML',
        icon: <FileCode2 className="h-4 w-4" />,
        onClick: () => void handleExport('html'),
      },
    ],
    [handleExport],
  );

  // 手动保存（按钮 / Ctrl+S）：clean 态只提示、不写盘（避免 mtime 抖动与同步盘噪音）
  const handleSave = useCallback(() => {
    if (!selectedFile) return;
    if (!isDirty) {
      addToast({ type: 'info', message: '内容已是最新' });
      return;
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    void persist('manual');
  }, [addToast, isDirty, persist, selectedFile]);

  // Ctrl+S 统一注册一次：编辑器内部不再各自挂监听，避免一次按键触发两次保存
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      const type = selectedFile?.fileType;
      if (type !== 'md' && type !== 'txt' && type !== 'html' && type !== 'json') return;
      event.preventDefault();
      handleSave();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, selectedFile?.fileType]);

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
    return toLocalMediaUrl(selectedFile.path);
  }, [selectedFile]);

  // 笔记所在目录：Markdown 里的图片是相对路径（attachments/YYYY-MM/…），需按此拼接
  const noteDir = useMemo(() => {
    if (!selectedFile) return '';
    const normalized = selectedFile.path.replace(/\\/g, '/');
    const cut = normalized.lastIndexOf('/');
    return cut < 0 ? '' : normalized.slice(0, cut);
  }, [selectedFile]);

  /**
   * 编辑器内图片解析。
   *
   * 复用 `resolveAssetUrl` 的**同步**构件（`resolveAssetPath` + `localMediaUrl`），
   * 不另写一份路径换算（G15）。异步的 data-uri 分支由导出专用。
   */
  const resolveImage = useCallback(
    (src: string) => {
      const raw = src.trim();
      if (raw === '') return null;
      if (isExternalAsset(raw)) return raw; // 外链 / 已是协议地址 → 原样使用
      if (!noteDir) return null;
      const abs = resolveAssetPath(noteDir, raw);
      return abs ? toLocalMediaUrl(abs) : null;
    },
    [noteDir],
  );

  // 图片加载策略：优先 local-media://（流式返回，不整读文件），
  // 协议失败（越界 403 / 文件缺失 / 协议未注册等）时自动降级到 useNotesSelection
  // 已读好的 blob URL；两者都失败才显式提示，避免只表现成「右侧空白」却无任何反馈。
  const [imageStage, setImageStage] = useState<'protocol' | 'blob' | 'failed'>('protocol');

  // 换图时复位，避免上一张的降级状态带到新图上
  useEffect(() => {
    setImageStage('protocol');
  }, [localMediaUrl]);

  const handleImageError = useCallback(() => {
    setImageStage((stage) => (stage === 'protocol' ? 'blob' : 'failed'));
  }, []);

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
      md: 'MD',
      txt: 'TXT',
      html: 'HTML',
      json: 'JSON',
      docx: 'Word',
      xlsx: 'Excel',
      image: '图片',
      pdf: 'PDF',
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
        return <FileText className="h-5 w-5 text-content-tertiary" />;
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
        return <FileText className="h-5 w-5 text-content-tertiary" />;
    }
  };

  const renderEditor = () => {
    const fileType = fileMetadata?.fileType;

    // image 走 local-media://，加载失败后自动降级为 blob URL，再失败才提示
    if (fileType === 'image') {
      const imageSrc = imageStage === 'protocol' ? localMediaUrl : filePreviewUrl;
      if (!imageSrc) {
        return (
          <div className="flex flex-1 min-h-0 items-center justify-center px-6 text-center text-sm text-content-tertiary">
            {imageStage === 'failed'
              ? '图片加载失败，文件可能已损坏或不在笔记目录内。'
              : '正在加载图片…'}
          </div>
        );
      }
      return (
        <NotesImageViewer
          src={imageSrc}
          alt={selectedFile?.name || ''}
          onError={handleImageError}
        />
      );
    }

    if (fileType === 'video') {
      if (!selectedFile) return null;

      // 编码不支持 / 体积超限 / 加载失败
      if (videoPlayback.mode === 'external') {
        return (
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
            <Play className="h-10 w-10 text-content-secondary" />
            <span className="max-w-full truncate text-sm text-content-secondary">
              {selectedFile.name}
            </span>
            <p className="max-w-sm text-xs leading-relaxed text-content-tertiary">
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
            <div className="flex flex-1 items-center justify-center text-sm text-content-tertiary">
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
          className="flex flex-1 min-h-0 overflow-auto scrollbar-5px"
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
            <div className="flex flex-1 items-center justify-center text-content-tertiary text-sm">
              切到后台时已暂停加载预览
            </div>
          )}
        </div>
      );
    }

    if (fileType === 'html') {
      return (
        <div className="flex flex-1 flex-col min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0">
            <button
              className={`px-3 py-1 text-sm rounded transition-colors ${
                htmlViewMode === 'preview'
                  ? 'bg-primary text-button-text'
                  : 'text-content-secondary hover:bg-menu-hover'
              }`}
              onClick={() => setHtmlViewMode('preview')}
            >
              预览
            </button>
            <button
              className={`px-3 py-1 text-sm rounded transition-colors ${
                htmlViewMode === 'source'
                  ? 'bg-primary text-button-text'
                  : 'text-content-secondary hover:bg-menu-hover'
              }`}
              onClick={() => setHtmlViewMode('source')}
            >
              源码
            </button>
          </div>
          {htmlViewMode === 'preview' ? (
            <div className="flex flex-1 min-h-0 overflow-auto scrollbar-5px">
              <iframe
                key={`${selectedFile?.path}-${!!content}`}
                srcDoc={content}
                sandbox="allow-scripts allow-forms allow-links allow-popups"
                className="w-full flex-1 border-0"
                title={selectedFile?.name || 'HTML Preview'}
              />
            </div>
          ) : (
            <div className="flex flex-1 min-h-0">
              {/* 🔴 HTML 源码必须走纯文本通道：块投影会把尖括号标签误判为块结构，破坏源码 */}
              <PlainTextEditor
                value={content}
                onChange={handleContentChange}
                onSave={handleSave}
                registerSaveShortcut={false}
                placeholder="编辑 HTML 源码..."
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-1 min-h-0">
        <MarkdownEditor
          value={content}
          onChange={handleContentChange}
          onSave={handleSave}
          registerSaveShortcut={false}
          onUpload={handleUpload}
          resolveImage={resolveImage}
          placeholder="开始编写内容..."
          documentKey={selectedFile?.path ?? null}
          mode={mode}
          onModeChange={(next) => {
            setMode(next);
            try {
              localStorage.setItem('md-editor-mode', next);
            } catch {
              /* localStorage 不可用时静默忽略 */
            }
          }}
        />
      </div>
    );
  };

  if (!selectedFile) {
    return (
      <section className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* 与打开笔记后的头部保持一致：侧边栏开关常驻，列表被隐藏后仍有入口恢复 */}
        <div className="flex flex-shrink-0 items-center gap-3 bg-surface-secondary-50 px-4 py-2">
          {onToggleSidebar ? (
            <button
              className="rounded p-1 text-content-tertiary hover:bg-menu-hover dark:hover:bg-surface"
              onClick={onToggleSidebar}
              title={sidebarVisible ? '隐藏列表' : '显示列表'}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-secondary">
            <Edit3 className="h-10 w-10 text-content-tertiary" />
          </div>
          <h3 className="mt-4 text-lg font-medium text-content-secondary">
            还没有打开笔记
          </h3>
          <p className="mt-1 max-w-sm text-center text-sm text-content-tertiary">
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
              className="flex items-center gap-2 rounded-lg bg-white/60 px-4 py-2 text-sm text-content-primary transition-colors hover:bg-surface-secondary-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FolderPlus className="h-4 w-4" />
              新建文件夹
            </button>
          </div>

          <p className="mt-8 text-xs text-content-tertiary">
            Ctrl + Shift + F 全文搜索 · 拖入文件到左侧列表即可导入
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col min-h-0 min-w-0">
      {/* flex-shrink-0：头部固定，滚动只发生在下方内容区 */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-between gap-3 bg-surface-secondary-50 px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            {onToggleSidebar && (
              <button
                className="rounded p-1 text-content-tertiary hover:bg-menu-hover dark:hover:bg-surface"
                onClick={onToggleSidebar}
                title={sidebarVisible ? '隐藏列表' : '显示列表'}
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            )}
            {getFileIcon()}
            {renameDraft === null ? (
              <span
                className="cursor-text truncate font-medium text-content-primary"
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
                  className="min-w-0 max-w-[240px] rounded border border-primary bg-white/60 px-1 py-0.5 text-sm text-content-primary outline-none"
                />
                {renameExt && (
                  <span className="text-sm text-content-secondary">{renameExt}</span>
                )}
              </span>
            )}
            {getFileTypeLabel() && (
              <span className="px-2 py-0.5 text-xs bg-menu-hover text-content-primary rounded">
                {getFileTypeLabel()}
              </span>
            )}
            {editableFile && saveState === 'error' && (
              <button
                type="button"
                onClick={handleSave}
                className="text-xs text-error hover:underline"
                title="点击重试保存"
              >
                保存失败 · 重试
              </button>
            )}
            {editableFile && saveState === 'saving' && (
              <span className="flex items-center gap-1 text-xs text-content-tertiary">
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
                保存中…
              </span>
            )}
            {editableFile && saveState === 'dirty' && (
              <span className="text-xs text-warning">● 未保存</span>
            )}
            {editableFile && saveState === 'clean' && (
              <span className="text-xs text-content-tertiary">
                已保存{formatSavedAt(savedAt)}
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

        <div className="flex flex-shrink-0 items-center">
          {editableFile ? (
            <button
              className={
                isDirty
                  ? 'flex items-center rounded-lg bg-primary px-2 py-1.5 text-button-text transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50'
                  : 'flex items-center rounded-lg px-2 py-1.5 text-content-secondary transition-colors hover:bg-menu-hover disabled:cursor-not-allowed disabled:opacity-50'
              }
              onClick={handleSave}
              disabled={isSaving}
              title="保存 (Ctrl+S)"
            >
              <Save className="h-4 w-4" />
            </button>
          ) : (
            <button
              className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs text-button-text transition-colors hover:bg-primary-hover"
              onClick={() => selectedFile && window.electron?.openFile(selectedFile.path)}
              title="在外部打开"
            >
              外部打开
            </button>
          )}
          {/* 编辑/阅读模式切换：尺寸完全对齐保存按钮（h-4 w-4 + px-2 py-1.5），置于保存按钮右侧 */}
          {fileMetadata?.fileType === 'md' ? (
            <button
              className="flex items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-menu-hover disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setMode((m) => (m === 'edit' ? 'read' : 'edit'))}
              title={mode === 'edit' ? '切换到阅读模式' : '切换到编辑模式'}
            >
              {mode === 'edit' ? (
                <Eye className="h-4 w-4 text-content-secondary" />
              ) : (
                <Edit3 className="h-4 w-4 text-content-secondary" />
              )}
            </button>
          ) : null}
          {/* 更多操作：导出 PDF / HTML（只有 Markdown 可渲染导出，其他类型走外部打开） */}
          {fileMetadata?.fileType === 'md' ? (
            <OverflowMenu variant="icon" label="更多操作" items={exportMenuItems} />
          ) : null}
        </div>
      </div>

      {/* 内容区唯一滚动容器：min-h-0 内部滚动，overscroll-contain 防带滚外层 */}
      <div className="relative flex flex-1 flex-col min-h-0 min-w-0 overflow-auto overscroll-contain scrollbar-5px">
        {renderEditor()}
      </div>
    </section>
  );
};

export default NotesEditor;