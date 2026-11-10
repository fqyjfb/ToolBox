import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deriveOutline,
  formatImageMarkdown,
  renderSafeInlineMarkdown,
  safeLinkTarget,
  type SourceBlock,
} from '@/lib/markdown';
import { BlockCanvas } from './BlockCanvas';
import { convertBlockText, type ConvertKind } from './blockConvert';
import { CommandGuide } from './CommandGuide';
import { InlineToolbar } from './InlineToolbar';
import { InsertImageDialog } from './InsertImageDialog';
import { MarkdownView } from '../MarkdownView';
import Modal from '@/components/ui/Modal';
import {
  buildTableMarkdown,
  stripInlineFormat,
  toggleInlineFormat,
  type InlineFormat,
} from './inlineFormat';
import { OutlinePanel } from './OutlinePanel';
import { SlashMenu } from './SlashMenu';
import { Toolbar } from './Toolbar';
import { useBlockDocument } from './useBlockDocument';
import './MarkdownEditor.css';

/** 字号三档（⌘⇧ + \ 循环切换） */
const FONT_SCALES = [0.9, 1, 1.15];

/** 会议记录模板（中文） */
const MEETING_NOTES_TEMPLATE =
  '## 会议记录\n\n**日期：** \n\n**参与者：** \n\n### 结论\n\n- \n\n### 下一步\n\n- [ ] \n';

/** 分割线 Markdown */
const DIVIDER_MARKDOWN = '---';

/** 纯文本粘贴：整段恰好是一条 http(s) 图片直链时直接转为图片（含查询串） */
const IMAGE_URL_ONLY = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?\S*)?$/iu;

/**
 * 弹窗内输入框（链接地址 / 图片地址）的粘贴、拖放不归编辑器处理。
 * Modal 渲染在 `.mde` 内部，事件会冒泡到根节点的 onPaste / onDrop；
 * 若不放行，粘贴图片直链会被误判成「粘贴图片」写进正文，而输入框拿不到内容。
 */
function isFromDialogField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('.mde-canvas')) return false;
  return target.closest('input, textarea') !== null;
}

/** 块内光标插入点：可编辑元素 + 打开时的选区快照（上传是异步的，必须提前捕获） */
interface CaretPoint {
  root: HTMLElement;
  range: Range;
}

/** 拖放落点 → 光标 Range（Chromium 专有 API，用于把图片落在鼠标松手处） */
function caretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

/** 捕获当前选区所在的块内光标；`block` 用于确认光标确实在该块里 */
function captureCaretPoint(block: SourceBlock | null): CaretPoint | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;
  const element =
    container instanceof Element ? container : container.parentElement;
  const root = element?.closest<HTMLElement>('.mde-block-content') ?? null;
  if (!root) return null;
  const holder = root.closest('[data-block-id]');
  if (block && holder?.getAttribute('data-block-id') !== block.id) return null;
  return { root, range: range.cloneRange() };
}

/**
 * 把行内 Markdown（图片等）插到光标处：先渲染成原子 DOM 节点再插入，
 * 随后派发 input 交给块自己的 `commit` 写回源码（`serializeInlineDom` 会保留图片语法）。
 * 返回 false 表示插入点已失效，调用方回退为「新开一个块」。
 */
function insertInlineMarkdownAtCaret(
  point: CaretPoint,
  markdown: string,
  resolveImage?: (src: string) => string | null,
): boolean {
  const { root, range } = point;
  if (!root.isConnected || !root.contains(range.commonAncestorContainer)) {
    return false;
  }
  const holder = document.createElement('div');
  holder.innerHTML = renderSafeInlineMarkdown(
    markdown,
    resolveImage ? { resolveImage } : {},
  );
  const nodes = Array.from(holder.childNodes);
  const last = nodes[nodes.length - 1];
  if (!last) return false;
  const fragment = document.createDocumentFragment();
  for (const node of nodes) fragment.append(node);
  try {
    range.deleteContents();
    range.insertNode(fragment);
    range.setStartAfter(last);
    range.collapse(true);
  } catch {
    return false;
  }
  const selection = window.getSelection();
  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
  // 触发该块的 onInput → commit，由媒体签名差异识别「非文本编辑」并整块回写
  root.dispatchEvent(new InputEvent('input', { bubbles: true }));
  return true;
}

/** 模式持久化 localStorage 键名；默认 mode = read（阅读优先） */
const MODE_STORAGE_KEY = 'toolbox.markdown.mode.default';
/** 只有「编辑 / 阅读」两态（分屏已移除） */
type PersistedMode = 'edit' | 'read';
/** 旧版本存过 'split'，此处归一化，避免读到已移除的模式 */
const DEFAULT_MODE: PersistedMode = (() => {
  try {
    const stored = localStorage.getItem(MODE_STORAGE_KEY);
    return stored === 'edit' || stored === 'read' ? stored : 'read';
  } catch {
    return 'read';
  }
})();

/**
 * 从 PersistedMode 解析 mode prop：props.mode 存在时（如父组件强制只读）覆盖内部状态；
 * 否则用内部 state（从 localStorage 读或默认 read）。
 *
 * 🔴 props.mode **不设默认值**，否则 propMode 永真、内部切换永远被覆盖。
 */
function resolveMode(
  propMode: MarkdownEditorProps['mode'] | undefined,
  internalMode: PersistedMode,
): PersistedMode {
  if (propMode === 'edit' || propMode === 'read') return propMode;
  return internalMode;
}

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  /** `edit` 块编辑；`read` 纯预览。不传时由内部状态 + localStorage 决定 */
  mode?: 'edit' | 'read';
  /** 父组件强制 mode 时，通过此回调感知用户的切换意图（父组件自己更新 state 再把新 mode 回灌） */
  onModeChange?: (mode: 'edit' | 'read') => void;
  onUpload?: (file: File) => Promise<string>;
  /**
   * 图片路径解析。**必须**由调用方注入 `resolveAssetUrl` 的 `protocol` 模式，
   * 禁止在编辑器内再写一份路径换算（G15）。
   */
  resolveImage?: (src: string) => string | null;
  /** 右键打开块菜单，默认 true */
  enableContextMenu?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
  /** 文档身份：切换时触发统一状态重置（关闭 portal 浮层 / outline / mode / scroll）；null 表示无文档（首次加载前） */
  documentKey?: string | null;
  /** 是否在组件内注册 Ctrl+S；宿主已统一注册时传 false，避免一次按键触发两次保存 */
  registerSaveShortcut?: boolean;
}

/**
 * 块级 Markdown 编辑器。
 *
 * props 与 `WMarkdownEditorProps` 对齐（去掉 `theme` / `height` / `minHeight`：
 * 主题自动消费 `--color-*`，尺寸由容器控制），保证阶段 4 接线平顺。
 */
export function MarkdownEditor({
  value,
  onChange,
  onSave,
  placeholder,
  readonly = false,
  mode: propMode,
  onModeChange,
  onUpload,
  resolveImage,
  enableContextMenu = true,
  onFocus,
  onBlur,
  className,
  documentKey,
  registerSaveShortcut = true,
}: MarkdownEditorProps) {
  const {
    snapshot,
    editBlock,
    insertBlockAfter,
    replaceBlockWithMarkdown,
    appendMarkdown,
    undo,
    redo,
  } = useBlockDocument(value);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [inlineToolbarVisible, setInlineToolbarVisible] = useState(false);
  const [linkSelectedText, setLinkSelectedText] = useState<string>('');
  const [linkUrlDraft, setLinkUrlDraft] = useState('');
  const [linkLabelDraft, setLinkLabelDraft] = useState('');
  // 打开链接弹窗时捕获的目标块，避免弹窗 autofocus 抢走 activeElement 后定位失败
  const [linkTargetBlock, setLinkTargetBlock] = useState<SourceBlock | null>(null);
  // 插入图片弹窗：同样在打开时捕获目标块
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageTargetBlock, setImageTargetBlock] = useState<SourceBlock | null>(null);
  // 弹窗打开瞬间的块内光标（上传/输入地址期间焦点在弹窗里，必须提前冻结）
  const imageCaretRef = useRef<CaretPoint | null>(null);
  // 内部 mode state：父组件未强制时由用户切换并持久化；默认 read
  const [internalMode, setInternalMode] = useState<PersistedMode>(DEFAULT_MODE);
  const effectiveMode = resolveMode(propMode, internalMode);

  /** 滚动位置捕获：read → edit 时恢复上次 edit 时的滚动；切文档后重置 */
  const capturedScrollTopRef = useRef<number>(0);

  // 字号三档：写进根元素 CSS 变量，正文 / 标题 / 代码按比例同步缩放
  useEffect(() => {
    rootRef.current?.style.setProperty('--md-font-scale', String(fontScale));
  }, [fontScale]);

  /** 切模式 effect：close portal + capture/restore scroll */
  useEffect(() => {
    // read 模式：capture 当前编辑区滚动，close portal 浮层
    if (effectiveMode === 'read') {
      const body = rootRef.current?.querySelector('.mde-body') as HTMLElement | null;
      if (body) capturedScrollTopRef.current = body.scrollTop;
      setOutlineOpen(false);
      setGuideOpen(false);
      setLinkDialogOpen(false);
      setLinkTargetBlock(null);
      setImageDialogOpen(false);
      setImageTargetBlock(null);
    } else {
      // edit 模式：切回后尝试恢复上次 read 时捕获的滚动
      const body = rootRef.current?.querySelector('.mde-body') as HTMLElement | null;
      if (body && capturedScrollTopRef.current > 0) {
        // requestAnimationFrame 等待 DOM 完成布局后再滚
        requestAnimationFrame(() => {
          body.scrollTop = capturedScrollTopRef.current;
        });
      }
    }
  }, [effectiveMode]);

  /** documentKey 变化 = 切换/打开/关闭文档：统一重置所有易残留状态 */
  useEffect(() => {
    // 1. close portal 浮层
    setGuideOpen(false);
    setLinkDialogOpen(false);
    setLinkTargetBlock(null);
    setImageDialogOpen(false);
    setImageTargetBlock(null);
    setOutlineOpen(false);
    // 2. reset mode 到全局默认
    if (propMode !== 'edit' && propMode !== 'read') {
      setInternalMode(DEFAULT_MODE);
    }
    // 3. scroll 重置
    requestAnimationFrame(() => {
      rootRef.current?.querySelector('.mde-body')?.scrollTo({ top: 0 });
      capturedScrollTopRef.current = 0;
    });
  }, [documentKey, propMode]);

  // 回调一律用 ref 持有：identity 变化不应触发任何重建（硬约束 C1）
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onUploadRef = useRef(onUpload);
  onUploadRef.current = onUpload;

  /** 切模式统一入口：持久化 localStorage + close portal + capture/restore scroll */
  const handleModeChange = useCallback(
    (next: PersistedMode) => {
      // 父组件强制锁定（propMode 存在）：不走内部 state，回调父组件让其回灌
      if (propMode === 'edit' || propMode === 'read') {
        onModeChange?.(next);
        return;
      }
      setInternalMode(next);
      try {
        localStorage.setItem(MODE_STORAGE_KEY, next);
      } catch {
        /* localStorage 不可用时静默忽略 */
      }
    },
    [propMode, onModeChange],
  );
  const onModeChangeRef = useRef(handleModeChange);
  onModeChangeRef.current = handleModeChange;

  // 跳过首次：初始 value 与 store 内 source 相同，不应算作一次用户编辑
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    onChangeRef.current?.(snapshot.source);
  }, [snapshot.source]);

  /** 应用块文本 patch；返回值 = patch 是否生效（false = 文档已变化被拒），供菜单层决定是否关闭 */
  const handleEdit = useCallback(
    (block: SourceBlock, text: string) => {
      if (readonly) return false;
      return editBlock(block, text, 'edit');
    },
    [editBlock, readonly],
  );

  const handleSplit = useCallback(
    (block: SourceBlock, before: string, after: string) => {
      if (readonly) return;
      editBlock(block, `${before}\n${after}`, 'split');
    },
    [editBlock, readonly],
  );

  const handleDelete = useCallback(
    (block: SourceBlock) => {
      if (readonly) return false;
      return editBlock(block, '', 'delete-block');
    },
    [editBlock, readonly],
  );

  /** 创建副本：在该块正下方插入（复制内容不带尾换行，insertBlockAfter 自己会补 \n\n） */
  const handleDuplicate = useCallback(
    (block: SourceBlock) => {
      if (readonly) return false;
      return insertBlockAfter(block, block.expectedText.trim());
    },
    [insertBlockAfter, readonly],
  );

  /** 从 DOM 节点反查所属块（activeElement / selection 共用一份换算） */
  const blockFromNode = useCallback(
    (node: Node | null): SourceBlock | null => {
      const element = node instanceof Element ? node : node?.parentElement ?? null;
      const id = element?.closest('[data-block-id]')?.getAttribute('data-block-id');
      if (!id) return null;
      return snapshot.projection.blocks.find((block) => block.id === id) ?? null;
    },
    [snapshot.projection.blocks],
  );

  /** 当前聚焦的块（从 DOM 反查，避免再引入一层 state）
   * 优先从 activeElement 找；点击 InlineToolbar/Toolbar 按钮时 activeElement 变按钮（不在 .mde-block 内），
   * 此时从 selection.anchorNode 往上层找（选区已被 onMouseDown preventDefault 保住）。 */
  const activeBlock = useCallback((): SourceBlock | null => {
    const fromActive = blockFromNode(document.activeElement);
    if (fromActive) return fromActive;
    const sel = window.getSelection();
    return blockFromNode(sel?.anchorNode ?? null);
  }, [blockFromNode]);

  /** 把 `block`（缺省时取当前聚焦块）转换为目标类型 */
  const handleConvertBlock = useCallback(
    (kind: ConvertKind, block: SourceBlock | null) => {
      if (readonly) return false;
      const target = block ?? activeBlock();
      if (!target) return false;
      return editBlock(
        target,
        convertBlockText(target.expectedText, kind),
        'convert',
      );
    },
    [activeBlock, editBlock, readonly],
  );

  /** 顶部工具栏：作用于当前聚焦块 */
  const handleConvert = useCallback(
    (kind: ConvertKind) => handleConvertBlock(kind, null),
    [handleConvertBlock],
  );

  const handleInsertLink = useCallback(
    (selectedText?: unknown) => {
      if (readonly) return;
      // 🔴 顶部工具栏是 `onClick={() => onInsertLink()}`；这里仍对来源做类型守卫，
      // 防止任何 `onClick={onInsertLink}` 形式的误接把 MouseEvent 传进来。
      let captured = typeof selectedText === 'string' ? selectedText.trim() : '';
      if (!captured) {
        const sel = window.getSelection();
        if (sel && sel.toString().trim()) captured = sel.toString().trim();
      }
      setLinkSelectedText(captured);
      setLinkLabelDraft(captured);
      setLinkUrlDraft('');
      setLinkTargetBlock(activeBlock());
      setLinkDialogOpen(true);
    },
    [readonly, activeBlock],
  );

  const handleConfirmLink = useCallback(() => {
    const rawUrl = linkUrlDraft.trim();
    if (!rawUrl) {
      setLinkDialogOpen(false);
      return;
    }
    // 复用 commands.ts 的 safeLinkTarget 做安全校验（防 javascript: / data: / 换行等）
    const target = safeLinkTarget(rawUrl);
    if (!target) {
      setLinkDialogOpen(false);
      return;
    }
    const label = linkLabelDraft.trim() || linkSelectedText || '链接';
    const markdown = `[${label}](${target})`;
    const block = linkTargetBlock ?? activeBlock();
    if (block) {
      // 有选中文本就替换它，否则追加到块尾
      const body = block.expectedText;
      const next =
        linkSelectedText && body.includes(linkSelectedText)
          ? body.replace(linkSelectedText, markdown)
          : body + markdown;
      editBlock(block, next, 'insert-link');
    } else {
      appendMarkdown(markdown);
    }
    setLinkTargetBlock(null);
    setLinkDialogOpen(false);
  }, [
    linkUrlDraft,
    linkLabelDraft,
    linkSelectedText,
    linkTargetBlock,
    activeBlock,
    appendMarkdown,
    editBlock,
  ]);

  /**
   * 行内格式：直接改写 Markdown 源。
   * 不用 `execCommand` —— 块画布的序列化器只取纯文本、不认 `<b>`/`<i>`，
   * 插入的标签会在写回时被抹掉（详见 Toolbar 注释）。
   */
  const handleInlineFormat = useCallback(
    (format: InlineFormat, selectedText?: string) => {
      if (readonly) return;
      const block = activeBlock();
      if (!block) return;
      const text = selectedText ?? window.getSelection()?.toString() ?? '';
      const next =
        format === 'clear'
          ? stripInlineFormat(block.expectedText, text)
          : toggleInlineFormat(block.expectedText, text, format);
      // 源里定位不到就安全放弃，绝不写入半截标记破坏文本
      if (next === null) return;
      editBlock(block, next, 'inline-format');
    },
    [activeBlock, editBlock, readonly],
  );

  /** 斜杠菜单选中：块内容当时就是 "/xxx"，清空后套用目标类型前缀 */
  const handleSlashPick = useCallback(
    (kind: ConvertKind) => {
      if (readonly) return false;
      const block = activeBlock();
      if (!block) return false;
      return editBlock(block, convertBlockText('', kind), 'slash');
    },
    [activeBlock, editBlock, readonly],
  );

  const handleInsertTable = useCallback(
    (rows: number, cols: number) => {
      if (readonly) return;
      appendMarkdown(`\n${buildTableMarkdown(rows, cols)}\n`);
    },
    [appendMarkdown, readonly],
  );

  /** 块菜单插入：`below=true` 在该块下方新建，`false` 替换当前空块 */
  const handleInsertBlock = useCallback(
    (block: SourceBlock, kind: ConvertKind, below: boolean) => {
      if (readonly) return false;
      const text = convertBlockText('', kind);
      return below
        ? insertBlockAfter(block, text)
        : replaceBlockWithMarkdown(block, text);
    },
    [insertBlockAfter, replaceBlockWithMarkdown, readonly],
  );

  /** 块菜单表格插入：同上的位置语义 */
  const handleInsertTableAt = useCallback(
    (block: SourceBlock, rows: number, cols: number, below: boolean) => {
      if (readonly) return false;
      const table = buildTableMarkdown(rows, cols);
      return below
        ? insertBlockAfter(block, table)
        : replaceBlockWithMarkdown(block, table);
    },
    [insertBlockAfter, readonly, replaceBlockWithMarkdown],
  );

  /** 块菜单分割线插入 */
  const handleInsertDividerAt = useCallback(
    (block: SourceBlock, below: boolean) => {
      if (readonly) return false;
      return below
        ? insertBlockAfter(block, DIVIDER_MARKDOWN)
        : replaceBlockWithMarkdown(block, DIVIDER_MARKDOWN);
    },
    [insertBlockAfter, readonly, replaceBlockWithMarkdown],
  );

  /** 块菜单会议记录模板插入 */
  const handleInsertMeetingNotesAt = useCallback(
    (block: SourceBlock, below: boolean) => {
      if (readonly) return false;
      const text = MEETING_NOTES_TEMPLATE.trimEnd();
      return below
        ? insertBlockAfter(block, text)
        : replaceBlockWithMarkdown(block, text);
    },
    [insertBlockAfter, readonly, replaceBlockWithMarkdown],
  );

  /**
   * 直接把 Markdown 源码写成独立块。
   *
   * 图片等**含 Markdown 语法**的内容必须走这里，不能塞进 contenteditable 当文本：
   * 提交时 `escapeMarkdownText` 会把 `! [ ] ( )` 转义成字面量，图片永远不显示。
   * 位置语义与块菜单一致：空块替换、非空块插到下方、无块追加到文末。
   */
  const insertMarkdownBlock = useCallback(
    (markdown: string, block: SourceBlock | null = activeBlock()) => {
      if (readonly || !markdown) return;
      if (!block) {
        appendMarkdown(markdown);
        return;
      }
      if (block.expectedText.trim() === '') {
        replaceBlockWithMarkdown(block, markdown);
        return;
      }
      insertBlockAfter(block, markdown);
    },
    [activeBlock, appendMarkdown, insertBlockAfter, readonly, replaceBlockWithMarkdown],
  );

  /** 图片落地：光标还在块内就地插入，否则退回「独立成块」，两条路都不丢图 */
  const insertImageMarkdown = useCallback(
    (markdown: string, block: SourceBlock | null, caret: CaretPoint | null) => {
      if (!markdown) return;
      if (caret && insertInlineMarkdownAtCaret(caret, markdown, resolveImage)) {
        return;
      }
      insertMarkdownBlock(markdown, block);
    },
    [insertMarkdownBlock, resolveImage],
  );

  /** 大纲点击：定位到目标标题。两种策略按顺序尝试：
   *  1. 按 outline.anchor 查 `#id` —— 阅读/编辑模式的标题 DOM 都带 MarkdownIt 生成的 id（与 outline 共享 slugify）
   *  2. fallback：按 line 找 `[data-source-line]` 块 —— 只在编辑模式有效（阅读模式 DOM 无块级属性）
   *  滚动目标必须是 `.mde-body`（body overflow:hidden，window 不滚）。 */
  const handleNavigateToLine = useCallback(
    (line: number) => {
      const root = rootRef.current;
      if (!root) return;
      const body = root.querySelector<HTMLElement>('.mde-body');
      const scroller = body ?? root;

      // 构造 anchor：outline.anchor 是对的，但 onNavigate 只传了 line。
      // 直接重算：拿当前 source 跑一次 deriveOutline，找到该行的 anchor
      const source = snapshot.source;
      const outline = deriveOutline(source);
      const item = outline.find((o) => o.line === line);
      const anchor = item?.anchor;
      let target: HTMLElement | null = null;
      if (anchor) {
        // CSS.escape 防止 slug 里的特殊字符（虽然 slugify 已经过滤了）
        target = scroller.querySelector<HTMLElement>(
          `#${CSS.escape(anchor)}`,
        );
      }
      if (!target) {
        // fallback：按 data-source-line 找块（编辑模式）
        const blocks = Array.from(
          scroller.querySelectorAll<HTMLElement>('[data-source-line]'),
        );
        if (blocks.length > 0) {
          target = blocks[0]!;
          for (const block of blocks) {
            const start = Number(block.getAttribute('data-source-line'));
            if (Number.isFinite(start) && start <= line) target = block;
            else break;
          }
        }
      }
      if (!target) return;
      // 用容器 scrollTo 而不是 target.scrollIntoView —— 避免 sticky Toolbar 遮挡 + 正确落在 body 容器内
      const offsetTop = target.offsetTop - 8; // 顶部留 8px 呼吸
      scroller.scrollTo({ top: offsetTop, behavior: 'smooth' });
    },
    [snapshot.source],
  );

  /**
   * 图片上传：粘贴 / 拖放 / 插入图片弹窗。
   *
   * 🔴 拿到 url 后必须**直接写入源码**，不能塞进 contenteditable 当文本：
   * 块提交时 `mergeInlineTextEdit` 会走 `escapeMarkdownText`，把 `[ ] ( )` 全转义，
   * 源文件会变成 `!\[alt\]\(url\)` 字面量（图片永远不显示）。
   *
   * 一批文件统一拼成一段 Markdown 一次写入：顺序稳定、只产生一次撤销点。
   * 多张图用**空格**分隔而不是空行：同一段落内图片才会水平并排、自动换行。
   * `caret` 在调用瞬间同步捕获（上传是异步的），有光标就插到光标处。
   */
  const uploadImages = useCallback(
    async (
      files: readonly File[],
      target: SourceBlock | null = activeBlock(),
      caret: CaretPoint | null = captureCaretPoint(target),
    ) => {
      const upload = onUploadRef.current;
      if (!upload || readonly) return;
      const markdowns: string[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const url = await upload(file);
          if (!url) continue;
          const markdown = formatImageMarkdown(url, file.name || 'image');
          if (markdown) markdowns.push(markdown);
        } catch (error) {
          console.error('[MarkdownEditor] 上传图片失败', error);
        }
      }
      if (markdowns.length > 0) insertImageMarkdown(markdowns.join(' '), target, caret);
    },
    [activeBlock, insertImageMarkdown, readonly],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      // 弹窗输入框放行默认粘贴，避免图片直链被误判成插入图片
      if (isFromDialogField(event.target)) return;
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.some((f) => f.type.startsWith('image/'))) {
        event.preventDefault();
        void uploadImages(files);
        return;
      }
      // 纯文本粘贴：整段恰好是一个 http(s) 图片直链时直接成图（复制图片地址 → Ctrl+V）
      const text = event.clipboardData?.getData('text/plain')?.trim() ?? '';
      if (!IMAGE_URL_ONLY.test(text)) return;
      const markdown = formatImageMarkdown(text);
      if (!markdown) return;
      event.preventDefault();
      const target = activeBlock();
      insertImageMarkdown(markdown, target, captureCaretPoint(target));
    },
    [activeBlock, insertImageMarkdown, uploadImages],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isFromDialogField(event.target)) {
        // 文本拖放放行到输入框；文件拖放要拦下，避免 Electron 用浏览器默认行为打开文件
        if ((event.dataTransfer?.files?.length ?? 0) > 0) event.preventDefault();
        return;
      }
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (!files.some((f) => f.type.startsWith('image/'))) return;
      event.preventDefault();
      // 浏览器不会给 contenteditable 的拖放设置光标：按落点算出插入位置，
      // 让图片落在鼠标松手处，而不是块末或新块。
      const caret = caretRangeFromPoint(event.clientX, event.clientY);
      if (caret) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(caret);
      }
      void uploadImages(files, blockFromNode(caret?.startContainer ?? null) ?? activeBlock());
    },
    [activeBlock, blockFromNode, uploadImages],
  );

  /** 顶部工具栏 / 块菜单：打开插入图片弹窗，冻结目标块与块内光标（弹窗会抢走焦点） */
  const handleRequestInsertImage = useCallback(
    (block: SourceBlock | null) => {
      if (readonly) return false;
      imageCaretRef.current = captureCaretPoint(block);
      setImageTargetBlock(block);
      setImageDialogOpen(true);
      return true;
    },
    [readonly],
  );

  const closeImageDialog = useCallback(() => {
    imageCaretRef.current = null;
    setImageDialogOpen(false);
    setImageTargetBlock(null);
  }, []);

  /** 弹窗确认网络地址：整条地址直接写成图片，不做行内文本拼接 */
  const handleImageUrlSubmit = useCallback(
    (url: string) => {
      const markdown = formatImageMarkdown(url);
      if (!markdown) return;
      insertImageMarkdown(markdown, imageTargetBlock, imageCaretRef.current);
    },
    [imageTargetBlock, insertImageMarkdown],
  );

  const handleImageFilesPick = useCallback(
    (files: File[]) => {
      void uploadImages(files, imageTargetBlock, imageCaretRef.current);
    },
    [imageTargetBlock, uploadImages],
  );

  // Ctrl/Cmd+S 保存（宿主已统一注册时跳过）
  useEffect(() => {
    if (!registerSaveShortcut) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSaveRef.current?.(snapshot.source);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [registerSaveShortcut, snapshot.source]);

  // ⌘/Ctrl + B / I / K / Z：加粗 / 斜体 / 链接 / 撤销；⇧⌘+Z 重做；⌘⇧+\ 字号三档循环
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      // Shift 下反斜杠的 event.key 可能是 '|'，两种都认
      if (event.shiftKey && (event.key === '\\' || event.key === '|')) {
        event.preventDefault();
        setFontScale((v) => {
          const index = FONT_SCALES.indexOf(v);
          return FONT_SCALES[(index + 1) % FONT_SCALES.length] ?? 1;
        });
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (key !== 'b' && key !== 'i' && key !== 'k' && key !== 'e') return;
      event.preventDefault();
      if (key === 'b') handleInlineFormat('bold');
      else if (key === 'i') handleInlineFormat('italic');
      else if (key === 'k') handleInsertLink();
      else if (key === 'e' && event.shiftKey) {
        // ⌘⇧ + E / Ctrl⇧ + E：在 编辑 / 阅读 之间切换
        onModeChangeRef.current(effectiveMode === 'edit' ? 'read' : 'edit');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleInlineFormat, handleInsertLink, effectiveMode, undo, redo]);

  const isEmpty = snapshot.source.trim().length === 0;

  return (
    <div
      ref={rootRef}
      className={className ? `mde ${className}` : 'mde'}
      data-mode={effectiveMode}
      // 编辑模式排除全局划词工具条（InlineToolbar 独占）；阅读模式不加属性即恢复支持
      data-selection-toolbar-disable={readonly || effectiveMode === 'read' ? undefined : ''}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {readonly ? null : (
        <Toolbar
          canUndo={snapshot.canUndo}
          canRedo={snapshot.canRedo}
          onUndo={undo}
          onRedo={redo}
          onConvert={handleConvert}
          onFormat={handleInlineFormat}
          onInsertLink={handleInsertLink}
          onInsertTable={handleInsertTable}
          onInsertImage={() => handleRequestInsertImage(activeBlock())}
          outlineOpen={outlineOpen}
          onToggleOutline={() => setOutlineOpen((v) => !v)}
          onOpenGuide={() => setGuideOpen(true)}
          mode={effectiveMode}
        />
      )}

      <div className="mde-main">
        {outlineOpen ? (
          <OutlinePanel
            source={snapshot.source}
            onNavigate={handleNavigateToLine}
          />
        ) : null}

        {effectiveMode === 'read' ? (
          <div className="mde-body scrollbar-5px">
            <MarkdownView
              source={snapshot.source}
              resolveImage={resolveImage}
              enableImageZoom
            />
          </div>
        ) : (
          <div className="mde-body scrollbar-5px">
            {isEmpty && placeholder ? (
              <div className="mde-placeholder">{placeholder}</div>
            ) : null}
            <BlockCanvas
              source={snapshot.source}
              blocks={snapshot.projection.blocks}
              onEdit={handleEdit}
              onDeleteBlock={handleDelete}
              onSplitBlock={handleSplit}
              resolveImage={resolveImage}
              enableContextMenu={enableContextMenu}
              onDuplicateBlock={handleDuplicate}
              onInsertBlock={handleInsertBlock}
              onInsertTable={handleInsertTableAt}
              onInsertDivider={handleInsertDividerAt}
              onInsertMeetingNotes={handleInsertMeetingNotesAt}
              onInsertImage={handleRequestInsertImage}
              selectionActive={inlineToolbarVisible}
            />
          </div>
        )}
      </div>

      {snapshot.projectionStatus === 'degraded' || snapshot.projectionStatus === 'blocked' ? (
        <div className="mde-status" role="status">
          部分内容未能解析为块，已按源码保留（不影响保存）
        </div>
      ) : null}

      {readonly || effectiveMode === 'read' ? null : (
        <>
          <InlineToolbar
            rootRef={rootRef}
            onFormat={handleInlineFormat}
            onLink={handleInsertLink}
            onConvert={handleConvertBlock}
            resolveActiveBlock={activeBlock}
            onVisibleChange={setInlineToolbarVisible}
          />
          <SlashMenu rootRef={rootRef} onPick={handleSlashPick} />
        </>
      )}

      <CommandGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      <Modal
        isOpen={linkDialogOpen}
        onClose={() => {
          setLinkDialogOpen(false);
          setLinkTargetBlock(null);
        }}
        title="插入链接"
        size="sm"
        onConfirm={handleConfirmLink}
        confirmText="插入"
        cancelText="取消"
        confirmDisabled={!linkUrlDraft.trim()}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-content-secondary mb-1">链接地址</label>
            <input
              type="url"
              value={linkUrlDraft}
              onChange={(e) => setLinkUrlDraft(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              className="w-full px-3 py-1.5 text-sm rounded-md border border-solid border-[var(--color-border)] bg-[var(--ct-bg-primary,var(--color-bg-primary))] text-[var(--mde-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-xs text-content-secondary mb-1">
              链接文字 {linkSelectedText ? `（选中：${linkSelectedText.length > 30 ? linkSelectedText.slice(0, 30) + '…' : linkSelectedText}）` : ''}
            </label>
            <input
              type="text"
              value={linkLabelDraft}
              onChange={(e) => setLinkLabelDraft(e.target.value)}
              placeholder="链接显示的文字"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-solid border-[var(--color-border)] bg-[var(--ct-bg-primary,var(--color-bg-primary))] text-[var(--mde-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>
      </Modal>

      <InsertImageDialog
        isOpen={imageDialogOpen}
        onClose={closeImageDialog}
        onPickFiles={handleImageFilesPick}
        onSubmitUrl={handleImageUrlSubmit}
      />
    </div>
  );
}

export default MarkdownEditor;
