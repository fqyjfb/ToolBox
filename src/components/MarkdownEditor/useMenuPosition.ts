import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface MenuPosition {
  top: number;
  left: number;
}

const GAP = 10;
const EDGE = 12;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * 浮层定位：锚点右侧优先，放不下则翻到左侧，最后夹紧进视口。
 *
 * 返回的 ref 需挂到浮层根节点上（用于测量真实尺寸）。
 */
export interface MenuPoint {
  x: number;
  y: number;
}

/**
 * 浮层定位：锚点右侧优先，放不下则翻到左侧，最后夹紧进视口。
 *
 * @param point 传入时用鼠标坐标做锚点（右键菜单场景），否则用 anchorRef 的元素矩形。
 */
export function useMenuPosition(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  point?: MenuPoint | null,
): {
  ref: React.RefObject<HTMLDivElement | null>;
  position: MenuPosition | null;
  recompute: () => void;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [tick, setTick] = useState(0);

  const recompute = useCallback(() => setTick((v) => v + 1), []);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!open || (!anchor && !point)) {
      setPosition(null);
      return;
    }
    const rect = point
      ? ({
          top: point.y,
          left: point.x,
          right: point.x,
          bottom: point.y,
          width: 0,
          height: 0,
        } as DOMRect)
      : anchor!.getBoundingClientRect();
    const el = ref.current;
    const width = el?.offsetWidth ?? 336;
    const height = el?.offsetHeight ?? 320;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 右 → 左 → 夹紧
    let left = rect.right + GAP;
    if (left + width + EDGE > viewportWidth) {
      left = rect.left - width - GAP;
    }
    left = clamp(left, EDGE, Math.max(EDGE, viewportWidth - width - EDGE));

    const top = clamp(rect.top, EDGE, Math.max(EDGE, viewportHeight - height - EDGE));

    setPosition({ top, left });
    // point 由调用方的 state 持有（引用稳定，非内联对象），可整体作为依赖
  }, [anchorRef, open, tick, point]);

  return { ref, position, recompute };
}

/**
 * 浮层关闭时机：Escape / 外部 pointerdown / resize / scroll(capture)。
 * `refs` 内的元素被视为「内部」，点击其内部不关闭。
 */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  refs: Array<React.RefObject<HTMLElement | null>>,
): void {
  useEffect(() => {
    if (!open) return;

    const isInside = (target: Node | null): boolean => {
      if (!target) return false;
      return refs.some((r) => r.current?.contains(target) ?? false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!isInside(event.target as Node | null)) onClose();
    };
    const onScrollOrResize = (event: Event) => {
      // resize 永远关闭；scroll 只在面板外部滚动时关闭
      // （面板内部的滚动容器如子菜单需要正常滚动，不应关闭）
      if (event.type === 'resize') {
        onClose();
        return;
      }
      const scrollTarget = event.target as Node | null;
      if (isInside(scrollTarget)) return;
      onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, onClose, refs]);
}
