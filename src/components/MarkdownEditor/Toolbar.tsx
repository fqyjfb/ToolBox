import { useCallback, useState } from 'react';
import {
  Bold,
  Code2,
  HelpCircle,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  ListTree,
  Quote,
  Redo2,
  Strikethrough,
  Table,
  Undo2,
} from 'lucide-react';
import type { ConvertKind } from './blockConvert';
import type { InlineFormat } from './inlineFormat';
import { TablePicker } from './TablePicker';
import './MarkdownEditor.css';

/** 只有「编辑 / 阅读」两态（分屏已移除） */
export type EditorMode = 'edit' | 'read';

export interface ToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** 块级转换（作用于当前聚焦块） */
  onConvert: (kind: ConvertKind) => void;
  /** 行内格式（作用于当前选区） */
  onFormat: (format: InlineFormat) => void;
  onInsertLink: () => void;
  onInsertTable: (rows: number, cols: number) => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  /** 打开「快捷键 / 语法速查」 */
  onOpenGuide: () => void;
  /** 当前模式；阅读态隐藏编辑类按钮 */
  mode: EditorMode;
}

/**
 * 顶部精简工具栏。
 *
 * ⚠️ 撤销/重做/加粗/斜体等按钮原先由旧编辑器内置 toolbar 提供，
 * `NotesEditor.tsx` 里并没有这些按钮，因此必须在这里自建补齐，否则功能直接消失。
 *
 * 🔴 行内格式**不用** `document.execCommand`：块画布的序列化器
 * （`plainTextFromInlineDom`）只取纯文本、不认 `<b>`/`<i>`，
 * execCommand 插入的标签会在写回源时被抹掉，表现为「点了加粗没反应」。
 * 统一走 `onFormat` → 直接改写 Markdown 源文本。
 */
export function Toolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onConvert,
  onFormat,
  onInsertLink,
  onInsertTable,
  outlineOpen,
  onToggleOutline,
  onOpenGuide,
  mode,
}: ToolbarProps) {
  const [tableOpen, setTableOpen] = useState(false);

  const closeTable = useCallback(() => setTableOpen(false), []);
  // 阅读态没有可编辑块：只保留「大纲 / 速查 / 模式切换」，编辑类按钮不渲染
  const readMode = mode === 'read';

  return (
    <div className="mde-toolbar" role="toolbar" aria-label="编辑器工具栏">
      {readMode ? null : (
        <>
          <button
            type="button"
            className="mde-tool"
            aria-label="撤销"
            title="撤销"
            disabled={!canUndo}
            onClick={onUndo}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="mde-tool"
            aria-label="重做"
            title="重做"
            disabled={!canRedo}
            onClick={onRedo}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Redo2 size={16} />
          </button>

          <span className="mde-tool-sep" />

          <button
            type="button"
            className="mde-tool"
            aria-label="加粗"
            title="加粗"
            onClick={() => onFormat('bold')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Bold size={16} />
          </button>
          <button
            type="button"
            className="mde-tool"
            aria-label="斜体"
            title="斜体"
            onClick={() => onFormat('italic')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Italic size={16} />
          </button>
          <button
            type="button"
            className="mde-tool"
            aria-label="删除线"
            title="删除线"
            onClick={() => onFormat('strike')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Strikethrough size={16} />
          </button>

          <span className="mde-tool-sep" />

          <button
            type="button"
            className="mde-tool"
            aria-label="无序列表"
            title="无序列表"
            onClick={() => onConvert('bullet')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <List size={16} />
          </button>
          <button
            type="button"
            className="mde-tool"
            aria-label="有序列表"
            title="有序列表"
            onClick={() => onConvert('ordered')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ListOrdered size={16} />
          </button>
          <button
            type="button"
            className="mde-tool"
            aria-label="待办"
            title="待办"
            onClick={() => onConvert('task')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <ListTodo size={16} />
          </button>
          <button
            type="button"
            className="mde-tool"
            aria-label="引用"
            title="引用"
            onClick={() => onConvert('quote')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Quote size={16} />
          </button>
          <button
            type="button"
            className="mde-tool"
            aria-label="代码块"
            title="代码块"
            onClick={() => onConvert('code')}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Code2 size={16} />
          </button>

          <span className="mde-tool-sep" />

          <button
            type="button"
            className="mde-tool"
            aria-label="插入链接"
            title="插入链接"
            onClick={() => onInsertLink()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <Link2 size={16} />
          </button>
          <div className="mde-tool-dropdown">
            <button
              type="button"
              className="mde-tool"
              aria-label="插入表格"
              title="插入表格"
              aria-expanded={tableOpen}
              onClick={() => setTableOpen((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
            >
              <Table size={16} />
            </button>
            {tableOpen ? (
              <TablePicker onPick={onInsertTable} onClose={closeTable} />
            ) : null}
          </div>
        </>
      )}

      <span className="mde-tool-sep" />

      <button
        type="button"
        className={outlineOpen ? 'mde-tool is-active' : 'mde-tool'}
        aria-label="大纲"
        title="大纲"
        aria-pressed={outlineOpen}
        onClick={onToggleOutline}
        onMouseDown={(e) => e.preventDefault()}
      >
        <ListTree size={16} />
      </button>
      <button
        type="button"
        className="mde-tool"
        aria-label="快捷键与语法速查"
        title="快捷键与语法速查"
        onClick={onOpenGuide}
        onMouseDown={(e) => e.preventDefault()}
      >
        <HelpCircle size={16} />
      </button>

      <span className="mde-tool-sep" />
    </div>
  );
}

export default Toolbar;
