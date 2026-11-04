import { useMemo } from "react";
import { List } from "lucide-react";
import { deriveOutline } from "@/lib/markdown";

export interface OutlinePanelProps {
  source: string;
  /** 点击标题：跳到该行所在块 */
  onNavigate: (line: number) => void;
}

/** 大纲侧栏：列出文档标题，点击定位。标题提取复用内核（已跳过代码围栏、带行号）。 */
export function OutlinePanel({ source, onNavigate }: OutlinePanelProps) {
  const items = useMemo(() => deriveOutline(source), [source]);

  return (
    <aside className="mde-outline scrollbar-5px" aria-label="文档大纲">
      <div className="mde-outline-head">
        <List className="h-3.5 w-3.5" />
        <span>大纲</span>
      </div>
      {items.length === 0 ? (
        <div className="mde-outline-empty">暂无标题</div>
      ) : (
        <nav className="mde-outline-list">
          {items.map((item) => (
            <button
              key={`${item.line}-${item.anchor}`}
              type="button"
              className="mde-outline-item"
              style={{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }}
              title={item.text}
              onClick={() => onNavigate(item.line)}
            >
              <span className={`mde-outline-level mde-lv-${item.level}`} />
              <span className="mde-outline-text">{item.text}</span>
            </button>
          ))}
        </nav>
      )}
    </aside>
  );
}
