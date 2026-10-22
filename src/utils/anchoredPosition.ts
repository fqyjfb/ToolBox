/**
 * 浮层定位：给定锚点矩形与浮层实测尺寸，算出既不裁剪、又不越界的坐标。
 * 供黄历浮层、天气详情浮层、右键菜单共用，避免各处各写一套 clamp / 翻转。
 */
export interface AnchoredRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type AnchoredPlacement = 'bottom' | 'top' | 'left' | 'right' | 'cursor';

export interface AnchoredPositionResult {
  x: number;
  y: number;
  /** 空间不足时的最大可视高度（内部滚动），空间充足时不返回 */
  maxHeight?: number;
  placement: AnchoredPlacement;
}

export interface ResolveAnchoredPositionOptions {
  /** 触发元素（或鼠标点）的矩形 */
  anchor: AnchoredRect;
  /** 浮层实测宽度 / 高度 */
  width: number;
  height: number;
  viewport: { width: number; height: number };
  /** 浮层与锚点的间距 */
  gap?: number;
  /** 与视口边缘的安全边距 */
  margin?: number;
  /** 依次尝试的摆放方位，取第一个放得下的 */
  placements?: AnchoredPlacement[];
  /** 结果不得与锚点矩形相交（压住锚点会导致 mouseleave → 闪烁） */
  avoidAnchor?: boolean;
  /** 传入后启用高度自适应：空间不足时收敛到该值以上并内部滚动 */
  minVisibleHeight?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

const overlapsAnchor = (x: number, y: number, width: number, height: number, anchor: AnchoredRect) =>
  !(x + width <= anchor.left || anchor.right <= x || y + height <= anchor.top || anchor.bottom <= y);

export function resolveAnchoredPosition({
  anchor,
  width,
  height,
  viewport,
  gap = 8,
  margin = 8,
  placements = ['bottom', 'top'],
  avoidAnchor = false,
  minVisibleHeight,
}: ResolveAnchoredPositionOptions): AnchoredPositionResult {
  const clampX = (value: number) => clamp(value, margin, viewport.width - width - margin);

  const candidates = placements.map(placement => {
    switch (placement) {
      case 'top':
        return { placement, x: anchor.left + anchor.width / 2 - width / 2, y: anchor.top - height - gap, space: anchor.top - gap - margin };
      case 'left':
        return { placement, x: anchor.left - width - gap, y: anchor.top, space: viewport.height - anchor.top - margin };
      case 'right':
        return { placement, x: anchor.right + gap, y: anchor.top, space: viewport.height - anchor.top - margin };
      case 'cursor':
        // 左上角对齐鼠标点，仅在越界时回收（右键菜单）
        return { placement, x: anchor.left, y: anchor.top, space: viewport.height - anchor.top - margin };
      default:
        return { placement, x: anchor.left + anchor.width / 2 - width / 2, y: anchor.bottom + gap, space: viewport.height - anchor.bottom - gap - margin };
    }
  });

  // 高度自适应模式：先取放得下的一侧，都不够时取空间最大的一侧并内部滚动
  if (minVisibleHeight !== undefined) {
    const fitting = candidates.find(candidate => height <= candidate.space);
    const chosen = fitting ?? candidates.reduce((best, current) => (current.space > best.space ? current : best));
    const maxHeight = Math.max(minVisibleHeight, Math.min(height, chosen.space));
    const visibleHeight = Math.min(height, maxHeight);
    const y = chosen.placement === 'top'
      ? Math.max(margin, anchor.top - gap - visibleHeight)
      : chosen.placement === 'bottom'
        ? Math.max(margin, Math.min(anchor.bottom + gap, viewport.height - margin - visibleHeight))
        : clamp(chosen.y, margin, viewport.height - visibleHeight - margin);

    return { x: clampX(chosen.x), y, maxHeight, placement: chosen.placement };
  }

  for (const candidate of candidates) {
    const x = clampX(candidate.x);
    const y = clamp(candidate.y, margin, viewport.height - height - margin);
    if (avoidAnchor && overlapsAnchor(x, y, width, height, anchor)) continue;
    return { x, y, placement: candidate.placement };
  }

  const fallback = candidates[0];
  return {
    x: clampX(fallback.x),
    y: clamp(fallback.y, margin, viewport.height - height - margin),
    placement: fallback.placement,
  };
}
