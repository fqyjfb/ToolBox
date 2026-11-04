import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SourceBlock } from '@/lib/markdown';
import { BlockMenu } from './BlockMenu';
import { convertBlockText, type ConvertKind } from './blockConvert';

const FENCE_OPEN = /^[ \t]{0,3}(`{3,}|~{3,})[ \t]*([^\n`]*)/u;
const FENCE_CLOSE = /^[ \t]{0,3}(?:`{3,}|~{3,})[ \t]*$/u;

/** 拆出围栏语言与代码体（去掉首尾围栏行） */
function parseFence(text: string): { language: string; code: string; fence: string } {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const first = FENCE_OPEN.exec(lines[0] ?? '');
  const fence = first?.[1] ?? '```';
  const language = first?.[2]?.trim() ?? '';
  let body = lines.slice(1);
  const last = body.length - 1;
  // 末行是配对围栏才剥离；未闭合围栏原样保留（避免吞掉真实内容）
  if (last >= 0 && FENCE_CLOSE.test(body[last] ?? '')) body = body.slice(0, last);
  return { language, code: body.join('\n'), fence };
}

/** 把代码体重新包装成围栏 Markdown */
function serializeFence(language: string, code: string, fence: string): string {
  const langLine = language ? `${fence}${language}` : fence;
  return `${langLine}\n${code}\n${fence}`;
}

export interface CodeFenceBlockProps {
  block: SourceBlock;
  line: number;
  /** 编辑提交：修改后的完整围栏文本回写源；返回值 = patch 是否生效 */
  onEdit?: (block: SourceBlock, text: string) => boolean;
  /** 删除当前块；返回值 = patch 是否生效 */
  onDeleteBlock?: (block: SourceBlock) => boolean;
  /** 创建块副本；返回值 = patch 是否生效 */
  onDuplicateBlock?: (block: SourceBlock) => boolean;
  /** 插入新块；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertBlock?: (block: SourceBlock, kind: ConvertKind, below: boolean) => boolean;
  /** 插入表格；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertTable?: (block: SourceBlock, rows: number, cols: number, below: boolean) => boolean;
  /** 插入分割线；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertDivider?: (block: SourceBlock, below: boolean) => boolean;
  /** 插入会议记录模板；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertMeetingNotes?: (block: SourceBlock, below: boolean) => boolean;
  /** 右键打开块菜单，默认 true */
  enableContextMenu?: boolean;
  /** 选区工具条可见时为 true；canvas 通过 data 属性隐藏 gutter */
  selectionActive?: boolean;
}

/**
 * 代码围栏块：**可编辑** —— textarea 编辑代码体，围栏语法自动补齐。
 *
 * 🔴 不用 contentEditable：代码块需要等宽字体、保留空白、支持 Tab 缩进，
 * textarea 天然满足这些。围栏起止符号由组件负责，用户只编辑中间的代码。
 */
export function CodeFenceBlock({
  block,
  line,
  onEdit,
  onDeleteBlock,
  onDuplicateBlock,
  onInsertBlock,
  onInsertTable,
  onInsertDivider,
  onInsertMeetingNotes,
  enableContextMenu,
  selectionActive,
}: CodeFenceBlockProps) {
  const [copied, setCopied] = useState(false);
  // 块根元素 ref：gutter portal 定位 + 右键监听
  const blockRef = useRef<HTMLDivElement | null>(null);
  const { language, code, fence } = useMemo(
    () => parseFence(block.expectedText),
    [block.expectedText],
  );
  // textarea 本地状态：允许 IME 组合输入
  const [draft, setDraft] = useState(code);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // block.expectedText 变化时同步 draft（切换文档 / 外部更新）
  useEffect(() => {
    setDraft(code);
  }, [code]);

  const commit = () => {
    if (!onEdit) return;
    const next = serializeFence(language, draft, fence);
    if (next !== block.expectedText) {
      onEdit(block, next);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab 缩进：插入两个空格而不是切换焦点
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;
      const indent = '  ';
      const nextValue = value.slice(0, start) + indent + value.slice(end);
      setDraft(nextValue);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + indent.length;
      });
    }
  };

  const copy = () => {
    void navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  const handleConvert = useCallback(
    (kind: ConvertKind) =>
      onEdit?.(block, convertBlockText(block.expectedText, kind)) !== false,
    [block, onEdit],
  );

  return (
    <div
      ref={blockRef}
      className="mde-block mde-block-code"
      data-source-from={block.range.from}
      data-source-to={block.range.to}
      data-source-kind={block.kind}
      data-source-line={line}
    >
      <BlockMenu
        block={block}
        anchorRef={blockRef}
        onConvert={handleConvert}
        onDelete={onDeleteBlock ? () => onDeleteBlock(block) : undefined}
        onDuplicate={onDuplicateBlock ? () => onDuplicateBlock(block) : undefined}
        onInsertBelow={
          onInsertBlock ? (kind) => onInsertBlock(block, kind, true) : undefined
        }
        onInsertHere={
          onInsertBlock ? (kind) => onInsertBlock(block, kind, false) : undefined
        }
        onInsertTable={
          onInsertTable
            ? (rows, cols, below) => onInsertTable(block, rows, cols, below)
            : undefined
        }
        onInsertDivider={
          onInsertDivider ? (below) => onInsertDivider(block, below) : undefined
        }
        onInsertMeetingNotes={
          onInsertMeetingNotes
            ? (below) => onInsertMeetingNotes(block, below)
            : undefined
        }
        selectionActive={selectionActive}
        enableContextMenu={enableContextMenu}
      />
      <div className="mde-code-head">
        <span className="mde-code-lang">{language || 'text'}</span>
        <button
          type="button"
          className="mde-code-copy"
          onClick={copy}
          aria-label="复制代码"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <textarea
        ref={textareaRef}
        className="mde-code-body"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        aria-label={`${language || 'text'} 代码块`}
      />
    </div>
  );
}
