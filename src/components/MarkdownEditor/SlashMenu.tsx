import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TYPE_ITEMS, type ConvertKind } from "./blockConvert";

export interface SlashMenuProps {
  rootRef: React.RefObject<HTMLElement | null>;
  /** 选中即转换块类型；返回值 = patch 是否生效 */
  onPick: (kind: ConvertKind) => boolean;
}

interface Anchor {
  x: number;
  y: number;
}

/**
 * 斜杠菜单：块内输入 `/` 时弹出，可继续输入过滤，选中即转换块类型。
 *
 * 触发条件刻意收紧为「整块内容就是 `/xxx`」——这样不会在写普通文字
 * （如路径 `a/b`、日期 `2026/11/02`）时误弹。
 */
export function SlashMenu({ rootRef, onPick }: SlashMenuProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const sync = () => {
      const element = document.activeElement as HTMLElement | null;
      const holder = element?.closest("[data-block-id]");
      if (!holder || !rootRef.current?.contains(holder)) {
        setAnchor(null);
        return;
      }
      const text = (holder.textContent ?? "").trim();
      const match = /^\/(\S*)$/u.exec(text);
      if (!match) {
        setAnchor(null);
        return;
      }
      const rect = holder.getBoundingClientRect();
      setAnchor({ x: rect.left, y: rect.bottom });
      setQuery(match[1] ?? "");
      setActiveIndex(0);
    };

    document.addEventListener("input", sync);
    return () => document.removeEventListener("input", sync);
  }, [rootRef]);

  const items = TYPE_ITEMS.filter(
    (item) =>
      query.length === 0 ||
      item.label.includes(query) ||
      item.kind.includes(query.toLowerCase()),
  );

  const pick = (kind: ConvertKind) => {
    // patch 被拒（文档已变化）时保持菜单打开
    if (onPick(kind)) setAnchor(null);
  };

  useEffect(() => {
    if (!anchor) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setAnchor(null);
        return;
      }
      if (items.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + items.length) % items.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const target = items[Math.min(activeIndex, items.length - 1)];
        if (target) pick(target.kind);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
    // items 每次渲染重建，故只依赖其长度
  }, [anchor, items.length, activeIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!anchor) return null;

  const left = Math.min(anchor.x, window.innerWidth - 260);
  const top = Math.min(anchor.y + 6, window.innerHeight - 240);

  return createPortal(
    <div className="mde-slash mde-portal scrollbar-5px" style={{ left, top }} role="listbox" aria-label="块类型">
      {items.length === 0 ? (
        <div className="mde-slash-empty">无匹配类型</div>
      ) : (
        items.map((item, index) => (
          <button
            key={item.kind}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            className={
              index === activeIndex ? "mde-slash-item is-active" : "mde-slash-item"
            }
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => pick(item.kind)}
          >
            {item.label}
          </button>
        ))
      )}
    </div>,
    document.body,
  );
}
