import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: React.ReactNode;
  /** 提示文案，为空则不展示提示 */
  title: string;
  position?: TooltipPosition;
  /** 触发层元素的类名，默认 inline-block（需要撑满父级或绝对定位时自行传入） */
  className?: string;
}

interface TriggerRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** 气泡与触发元素的间距 */
const GAP = 8;

// 气泡渲染到 body 并使用固定定位：侧边栏(overflow:hidden)、内容区(overflow-x:hidden)
// 等容器会裁剪绝对定位的浮层，portal + fixed 可保证提示始终完整可见
const PLACEMENT: Record<TooltipPosition, (r: TriggerRect) => React.CSSProperties> = {
  top: (r) => ({ top: r.top - GAP, left: r.left + r.width / 2, transform: 'translate(-50%, -100%)' }),
  bottom: (r) => ({ top: r.bottom + GAP, left: r.left + r.width / 2, transform: 'translate(-50%, 0)' }),
  left: (r) => ({ top: r.top + r.height / 2, left: r.left - GAP, transform: 'translate(-100%, -50%)' }),
  right: (r) => ({ top: r.top + r.height / 2, left: r.right + GAP, transform: 'translate(0, -50%)' }),
};

const ARROW_BASE: React.CSSProperties = {
  position: 'absolute',
  width: 0,
  height: 0,
  borderStyle: 'solid',
  borderWidth: 4,
};

// 箭头始终指向触发元素：气泡在上则箭头朝下，以此类推
const ARROW: Record<TooltipPosition, React.CSSProperties> = {
  top: { bottom: -8, left: '50%', transform: 'translateX(-50%)', borderColor: 'var(--color-tooltip-bg, dodgerblue) transparent transparent transparent' },
  bottom: { top: -8, left: '50%', transform: 'translateX(-50%)', borderColor: 'transparent transparent var(--color-tooltip-bg, dodgerblue) transparent' },
  left: { right: -8, top: '50%', transform: 'translateY(-50%)', borderColor: 'transparent transparent transparent var(--color-tooltip-bg, dodgerblue)' },
  right: { left: -8, top: '50%', transform: 'translateY(-50%)', borderColor: 'transparent var(--color-tooltip-bg, dodgerblue) transparent transparent' },
};

const Tooltip: React.FC<TooltipProps> = ({ children, title, position = 'top', className = 'inline-block' }) => {
  const [rect, setRect] = useState<TriggerRect | null>(null);
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback(() => {
    const el = triggerRef.current;
    if (!el || !title) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height });
    setActualPosition(position);
  }, [title, position]);

  const hideTooltip = useCallback(() => setRect(null), []);

  // 贴近视口边缘时自动翻转到对侧，避免提示被窗口裁掉
  useEffect(() => {
    if (!rect || !tooltipRef.current) return;
    const tipRect = tooltipRef.current.getBoundingClientRect();
    let next = position;
    if (position === 'top' && rect.top < tipRect.height + GAP) {
      next = 'bottom';
    } else if (position === 'bottom' && rect.bottom + tipRect.height > window.innerHeight - GAP) {
      next = 'top';
    } else if (position === 'left' && rect.left < tipRect.width + GAP) {
      next = 'right';
    } else if (position === 'right' && rect.right + tipRect.width > window.innerWidth - GAP) {
      next = 'left';
    }
    setActualPosition(next);
  }, [rect, position]);

  return (
    <>
      <div ref={triggerRef} className={className} onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
        {children}
      </div>
      {rect && title && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[1000] rounded-lg whitespace-nowrap text-button-text text-sm font-bold px-[7px] py-[3px] shadow-md pointer-events-none"
          style={{ ...PLACEMENT[actualPosition](rect), backgroundColor: 'var(--color-tooltip-bg, dodgerblue)' }}
        >
          {title}
          <span style={{ ...ARROW_BASE, ...ARROW[actualPosition] }} />
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
