import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const SHORTCUTS: ReadonlyArray<{ keys: string; desc: string }> = [
  { keys: '⌘/Ctrl + B', desc: '加粗' },
  { keys: '⌘/Ctrl + I', desc: '斜体' },
  { keys: '⌘/Ctrl + K', desc: '插入链接' },
  { keys: '⌘/Ctrl + S', desc: '保存' },
  { keys: '⌘/Ctrl + Z', desc: '撤销' },
  { keys: '⇧⌘/Ctrl + Z', desc: '重做' },
  { keys: '⌘⇧ + \\', desc: '字号三档循环' },
  { keys: 'Enter', desc: '拆分为新块' },
  { keys: '⇧Enter', desc: '块内换行' },
  { keys: '/', desc: '打开块类型菜单' },
  { keys: 'Esc', desc: '关闭浮层 / 失焦' },
];

const SYNTAX: ReadonlyArray<{ syntax: string; desc: string }> = [
  { syntax: '# ~ ######', desc: '标题 H1-H6' },
  { syntax: '**粗体**', desc: '加粗' },
  { syntax: '*斜体*', desc: '斜体' },
  { syntax: '~~删除线~~', desc: '删除线' },
  { syntax: '`代码`', desc: '行内代码' },
  { syntax: '- 项目', desc: '无序列表' },
  { syntax: '1. 项目', desc: '有序列表' },
  { syntax: '- [ ] 待办', desc: '待办（可勾选）' },
  { syntax: '> 引用', desc: '引用' },
  { syntax: '```语言', desc: '代码围栏' },
  { syntax: '[文字](链接)', desc: '链接' },
  { syntax: '![说明](路径)', desc: '图片' },
  { syntax: '[^标签]', desc: '脚注' },
  { syntax: '| 表头 |', desc: '表格' },
];

export interface CommandGuideProps {
  open: boolean;
  onClose: () => void;
}

/** ⌘/Ctrl 快捷键与 Markdown 语法速查 */
export function CommandGuide({ open, onClose }: CommandGuideProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="mde-guide-mask"
      role="dialog"
      aria-modal="true"
      aria-label="快捷键与语法速查"
      onClick={onClose}
    >
      <div className="mde-guide mde-portal" onClick={(e) => e.stopPropagation()}>
        <div className="mde-guide-head">
          <span>快捷键与语法速查</span>
          <button
            type="button"
            className="mde-guide-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mde-guide-body scrollbar-5px">
          <div className="mde-guide-col">
            <h4>快捷键</h4>
            {SHORTCUTS.map((item) => (
              <div className="mde-guide-row" key={item.keys}>
                <span>{item.desc}</span>
                <span className="mde-guide-keys">{item.keys}</span>
              </div>
            ))}
          </div>
          <div className="mde-guide-col">
            <h4>Markdown 语法</h4>
            {SYNTAX.map((item) => (
              <div className="mde-guide-row" key={item.syntax}>
                <span>{item.desc}</span>
                <span className="mde-guide-syntax">{item.syntax}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
