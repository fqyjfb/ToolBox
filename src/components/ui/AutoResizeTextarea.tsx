import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

export interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 内容为空时保持的最小行数 */
  minRows?: number;
  /** 最大行数，超过后高度固定并显示细纵向滚动条 */
  maxRows?: number;
}

/**
 * 高度自适应的多行输入框：
 * 高度随内容在 minRows ~ maxRows 之间自动增长，超过 maxRows 后固定高度并内部滚动。
 */
const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ minRows = 2, maxRows = 6, className = '', ...rest }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    const setRef = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }
      },
      [ref]
    );

    const resize = useCallback(() => {
      const el = innerRef.current;
      if (!el) return;
      const computed = window.getComputedStyle(el);
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.5;
      const extraHeight =
        parseFloat(computed.paddingTop) +
        parseFloat(computed.paddingBottom) +
        parseFloat(computed.borderTopWidth) +
        parseFloat(computed.borderBottomWidth);
      const minHeight = lineHeight * minRows + extraHeight;
      const maxHeight = lineHeight * maxRows + extraHeight;

      el.style.height = 'auto';
      const contentHeight = el.scrollHeight;
      el.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
      el.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
    }, [minRows, maxRows]);

    // 内容变化（输入/外部赋值）与首次挂载时同步高度
    useLayoutEffect(() => {
      resize();
    }, [resize, rest.value]);

    // 宽度变化（窗口缩放等）导致换行变化时重算高度
    useEffect(() => {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [resize]);

    return (
      <textarea
        {...rest}
        ref={setRef}
        rows={minRows}
        className={`scrollbar-thin ${className}`}
      />
    );
  }
);

AutoResizeTextarea.displayName = 'AutoResizeTextarea';

export default AutoResizeTextarea;
