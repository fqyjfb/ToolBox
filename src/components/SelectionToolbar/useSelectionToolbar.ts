import { useCallback, useEffect, useRef, useState } from 'react';

export interface SelectionInfo {
  text: string;
  /** 选区矩形（视口坐标），textarea 选区由镜像 div 测出 */
  rect: { left: number; top: number; right: number; bottom: number };
  source: 'dom' | 'textarea';
}

/** 排除区：标记元素及其后代不弹全局工具条（密码框 / readonly 输入控件一并排除） */
const EXCLUDE_SELECTOR =
  '[data-selection-toolbar-disable], input[type="password"], [readonly]';

/** 镜像 div 需要从 textarea 复制的排版属性（保证换行与 textarea 逐像素一致） */
const MIRROR_TEXT_STYLE_KEYS = [
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'letterSpacing',
  'wordSpacing',
  'lineHeight',
  'textIndent',
  'textTransform',
  'tabSize',
] as const;

export interface SelectionToolbarState {
  info: SelectionInfo | null;
  /** 主动隐藏工具条（textarea 选区清不掉 DOM 选区，动作收尾需显式调用） */
  hide: () => void;
}

/**
 * 全局选区监听 hook。
 *
 * 机制与 MarkdownEditor/InlineToolbar.tsx 同源（selectionchange + 矩形定位），
 * 差异点：作用域为全文档、支持 textarea 选区（镜像测量）、带排除区与拖拽抑制。
 *
 * 显示条件：开关开启、选区非折叠且 trim() 非空、锚点不在排除区。
 * 隐藏时机：选区折叠 / Escape / 任意滚动 / resize / 窗口 blur / 拖拽未松开。
 */
export function useSelectionToolbar(options: {
  enabled: boolean;
}): SelectionToolbarState {
  const { enabled } = options;
  const [info, setInfo] = useState<SelectionInfo | null>(null);
  const hide = useCallback(() => setInfo(null), []);

  // 回调一律 ref 持有：identity 变化不应触发重复订阅（与 InlineToolbar 一致）
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const draggingRef = useRef(false);

  useEffect(() => {
    /** textarea 选区矩形：镜像 div 复刻排版后测选中 span 的包围盒 */
    const measureTextareaSelection = (
      textarea: HTMLTextAreaElement,
    ): SelectionInfo['rect'] | null => {
      const computed = window.getComputedStyle(textarea);
      const mirror = document.createElement('div');
      const s = mirror.style;
      s.position = 'fixed';
      s.left = '-9999px';
      s.top = '0';
      s.visibility = 'hidden';
      s.margin = '0';
      s.whiteSpace = 'pre-wrap';
      s.wordWrap = 'break-word';
      s.overflowWrap = 'break-word';
      s.borderStyle = 'solid';
      for (const key of MIRROR_TEXT_STYLE_KEYS) {
        s[key] = computed[key];
      }
      s.paddingTop = computed.paddingTop;
      s.paddingRight = computed.paddingRight;
      s.paddingBottom = computed.paddingBottom;
      s.paddingLeft = computed.paddingLeft;
      s.borderTopWidth = computed.borderTopWidth;
      s.borderRightWidth = computed.borderRightWidth;
      s.borderBottomWidth = computed.borderBottomWidth;
      s.borderLeftWidth = computed.borderLeftWidth;
      // border-box + clientWidth（含内边距、不含滚动条）+ 复制边框 → 内容宽度与 textarea 一致
      s.width = `${
        textarea.clientWidth +
        parseFloat(computed.borderLeftWidth) +
        parseFloat(computed.borderRightWidth)
      }px`;

      const { value, selectionStart, selectionEnd } = textarea;
      const before = document.createElement('span');
      before.textContent = value.slice(0, selectionStart);
      const selected = document.createElement('span');
      selected.textContent = value.slice(selectionStart, selectionEnd);
      mirror.append(before, selected);
      document.body.append(mirror);

      const mirrorRect = mirror.getBoundingClientRect();
      const selRect = selected.getBoundingClientRect();
      mirror.remove();
      if (selRect.width === 0 && selRect.height === 0) return null;

      const textareaRect = textarea.getBoundingClientRect();
      return {
        left:
          textareaRect.left + (selRect.left - mirrorRect.left) - textarea.scrollLeft,
        top:
          textareaRect.top + (selRect.top - mirrorRect.top) - textarea.scrollTop,
        right:
          textareaRect.left +
          (selRect.left - mirrorRect.left) -
          textarea.scrollLeft +
          selRect.width,
        bottom:
          textareaRect.top +
          (selRect.top - mirrorRect.top) -
          textarea.scrollTop +
          selRect.height,
      };
    };

    const sync = () => {
      if (!enabledRef.current || draggingRef.current) {
        hide();
        return;
      }

      // textarea 分支：window.getSelection() 读不到控件内选区，走 activeElement
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement) {
        const hasSelection =
          active.selectionEnd > active.selectionStart &&
          !active.closest(EXCLUDE_SELECTOR);
        if (hasSelection) {
          const text = active.value.slice(
            active.selectionStart,
            active.selectionEnd,
          );
          const rect = text.trim() ? measureTextareaSelection(active) : null;
          if (rect) {
            setInfo({ text, rect, source: 'textarea' });
            return;
          }
        }
        hide();
        return;
      }

      // DOM 选区分支
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        hide();
        return;
      }
      const text = selection.toString();
      const node = selection.anchorNode;
      const element =
        node instanceof Element ? node : (node?.parentElement ?? null);
      if (!text.trim() || !element || element.closest(EXCLUDE_SELECTOR)) {
        hide();
        return;
      }
      const domRect = selection.getRangeAt(0).getBoundingClientRect();
      if (domRect.width === 0 && domRect.height === 0) {
        hide();
        return;
      }
      setInfo({
        text,
        rect: {
          left: domRect.left,
          top: domRect.top,
          right: domRect.right,
          bottom: domRect.bottom,
        },
        source: 'dom',
      });
    };

    // capture：同时接收文档级选区与 textarea 元素级 selectionchange
    const onPointerDown = (event: PointerEvent) => {
      // 按在工具条自身（排除区属性标记）上不算拖拽，避免点击按钮时误隐藏
      if (
        event.target instanceof Element &&
        event.target.closest(EXCLUDE_SELECTOR)
      ) {
        return;
      }
      draggingRef.current = true;
      hide();
    };
    const onPointerUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      sync();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide(); // 仅隐藏自身，不拦截事件
    };

    document.addEventListener('selectionchange', sync, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('keydown', onKeyDown);
    // 滚动 / 缩放 / 失焦一律隐藏，避免位置漂移（全局工具条跨滚动容器，比 InlineToolbar 更严格）
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);

    return () => {
      document.removeEventListener('selectionchange', sync, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('pointerup', onPointerUp, true);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
    };
  }, [hide]);

  // 开关关闭时立即隐藏（onSettingChanged 实时下发）
  useEffect(() => {
    if (!enabled) hide();
  }, [enabled, hide]);

  return { info, hide };
}
