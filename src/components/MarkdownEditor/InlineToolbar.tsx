import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  ChevronDown,
  Code,
  Italic,
  Link2,
  RemoveFormatting,
  Strikethrough,
} from "lucide-react";
import type { SourceBlock } from "@/lib/markdown";
import {
  blockToken,
  currentConvertKind,
  TYPE_ITEMS,
  type ConvertKind,
} from "./blockConvert";
import type { InlineFormat } from "./inlineFormat";

export interface InlineToolbarProps {
  /** 编辑器根元素：选区必须落在其中才显示 */
  rootRef: React.RefObject<HTMLElement | null>;
  onFormat: (format: InlineFormat, selectedText: string) => void;
  onLink: (selectedText: string) => void;
  /** 返回选区所在块；用于「块类型」入口的当前项高亮与转换目标 */
  resolveActiveBlock?: () => SourceBlock | null;
  /** 块类型转换；`block` 为选区所在块；返回值 = patch 是否生效 */
  onConvert?: (kind: ConvertKind, block: SourceBlock | null) => boolean;
  /** 工具栏显隐回调：上层据此决定是否隐藏 gutter（避免浮层互相遮挡） */
  onVisibleChange?: (visible: boolean) => void;
}

interface Anchor {
  x: number;
  y: number;
}

/**
 * 选区工具栏：选中文字时浮出。
 *
 * 结构布局：
 *   [块类型 ▾] │ B I S │ </> 🔗 │ ⌫清除格式
 *
 * 定位不用 `useMenuPosition`（那是「锚点右侧优先」的菜单定位），这里需要
 * **选区上方水平居中**，故直接按选区矩形算 + `translate(-50%, -100%)`。
 */
export function InlineToolbar({
  rootRef,
  onFormat,
  onLink,
  resolveActiveBlock,
  onConvert,
  onVisibleChange,
}: InlineToolbarProps) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [selected, setSelected] = useState("");
  const [block, setBlock] = useState<SourceBlock | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);
  const typesRef = useRef<HTMLDivElement | null>(null);
  const prevVisibleRef = useRef(false);
  // 回调一律用 ref 持有：identity 变化不应触发重复订阅
  const resolveRef = useRef(resolveActiveBlock);
  resolveRef.current = resolveActiveBlock;
  const onVisibleChangeRef = useRef(onVisibleChange);
  onVisibleChangeRef.current = onVisibleChange;

  useEffect(() => {
    const sync = () => {
      const selection = window.getSelection();
      let visible = false;
      let text = "";
      let rect: DOMRect | null = null;
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        text = selection.toString();
        if (text.trim()) {
          const node = selection.anchorNode;
          const element =
            node instanceof Element ? node : (node?.parentElement ?? null);
          if (element && rootRef.current?.contains(element)) {
            // 表格区域内选区 → 不显示 InlineToolbar（表格有自己的行列结构工具条，
            // B/I/S 等 inline 格式作用在 td 文本上会污染 Markdown 序列化）
            if (element.closest('.mde-block-table, .mde-table-shell, td, th')) {
              visible = false;
            } else {
              rect = selection.getRangeAt(0).getBoundingClientRect();
              visible = true;
            }
          }
        }
      }
      if (visible && rect) {
        setAnchor({ x: rect.left + rect.width / 2, y: rect.top });
        setSelected(text);
        setBlock(resolveRef.current?.() ?? null);
      } else {
        setAnchor(null);
        setBlock(null);
        setTypesOpen(false);
      }
      if (visible !== prevVisibleRef.current) {
        prevVisibleRef.current = visible;
        onVisibleChangeRef.current?.(visible);
      }
    };

    document.addEventListener("selectionchange", sync);
    return () => document.removeEventListener("selectionchange", sync);
  }, [rootRef]);

  // 块类型菜单：Escape / 外部 pointerdown 关闭
  useEffect(() => {
    if (!typesOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTypesOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && typesRef.current?.contains(event.target)) {
        return;
      }
      setTypesOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [typesOpen]);

  if (!anchor) return null;

  // 夹紧进视口，避免工具栏被裁掉（含块类型入口后宽度变大，留 120px 余量）
  const left = Math.min(Math.max(anchor.x, 120), window.innerWidth - 120);
  const top = Math.max(anchor.y - 8, 60);

  // 🔴 用 mousedown + preventDefault 保住选区：默认行为会先清空选区再触发 click
  const guard = (event: React.MouseEvent) => event.preventDefault();

  const groups: ReadonlyArray<
    ReadonlyArray<{ icon: typeof Bold; title: string; run: () => void }>
  > = [
    [
      { icon: Bold, title: "加粗", run: () => onFormat("bold", selected) },
      { icon: Italic, title: "斜体", run: () => onFormat("italic", selected) },
      { icon: Strikethrough, title: "删除线", run: () => onFormat("strike", selected) },
    ],
    [
      { icon: Code, title: "行内代码", run: () => onFormat("code", selected) },
      { icon: Link2, title: "链接", run: () => onLink(selected) },
    ],
    [
      { icon: RemoveFormatting, title: "清除格式", run: () => onFormat("clear", selected) },
    ],
  ];

  const typeLabel = block ? blockToken(block) : "段落";
  const currentKind = block ? currentConvertKind(block) : null;

  return createPortal(
    <div
      className="mde-inline-toolbar mde-portal"
      style={{ left, top }}
      role="toolbar"
      aria-label="选区格式"
      onMouseDown={guard}
    >
      {onConvert ? (
        <div className="mde-inline-group" role="group" aria-label="块类型">
          <div className="mde-inline-type" ref={typesRef}>
            <button
              type="button"
              className="mde-inline-btn mde-inline-type-trigger"
              aria-haspopup="menu"
              aria-expanded={typesOpen}
              title={`块类型 · ${typeLabel}`}
              aria-label={`块类型 · ${typeLabel}`}
              onClick={() => setTypesOpen((v) => !v)}
            >
              <span className="mde-inline-type-token">{typeLabel}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {typesOpen ? (
              <div className="mde-inline-type-menu" role="menu" aria-label="块类型">
                <span className="mde-inline-type-heading">块类型</span>
                <div className="mde-inline-type-grid">
                  {TYPE_ITEMS.map((item) => {
                    const isCurrent = item.kind === currentKind;
                    return (
                      <button
                        key={item.kind}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isCurrent}
                        className={isCurrent ? "mde-type-item is-current" : "mde-type-item"}
                        onClick={() => {
                          // patch 被拒（文档已变化）时保持子菜单打开
                          if (onConvert(item.kind, block)) setTypesOpen(false);
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {groups.map((items, groupIndex) => (
        <div className="mde-inline-group" role="group" key={groupIndex}>
          {items.map(({ icon: Icon, title, run }) => (
            <button
              key={title}
              type="button"
              className="mde-inline-btn"
              title={title}
              aria-label={title}
              onClick={run}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      ))}
    </div>,
    document.body,
  );
}

export default InlineToolbar;
