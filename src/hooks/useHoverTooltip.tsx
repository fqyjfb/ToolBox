import { type MouseEvent, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

/**
 * 图标悬浮提示：渲染到 body 并使用固定定位，
 * 避免提示被带滚动条的容器裁剪。
 */
export const useHoverTooltip = () => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showTooltip = useCallback((e: MouseEvent<Element>, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ x: rect.left + rect.width / 2, y: rect.top - 6, text });
  }, []);

  const hideTooltip = useCallback(() => setTooltip(null), []);

  const tooltipNode = tooltip
    ? createPortal(
        <span
          className="quicklaunch-title quicklaunch-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </span>,
        document.body
      )
    : null;

  return { tooltipNode, showTooltip, hideTooltip };
};
