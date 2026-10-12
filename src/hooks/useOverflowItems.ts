import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface UseOverflowItemsOptions {
  /** 关闭时不做收拢，全部显示（大窗/宽屏保持原样） */
  enabled?: boolean;
  /** 为「更多」按钮预留的宽度 */
  reserveWidth?: number;
  /** 尚未实测过宽度的项的估算宽度 */
  fallbackWidth?: number;
}

interface UseOverflowItemsResult<T> {
  /** 挂到只放分类项的横向容器上（需 flex-1 min-w-0，宽度由父级决定） */
  containerRef: React.RefObject<HTMLDivElement | null>;
  visible: T[];
  overflow: T[];
}

/**
 * 分类 / 标签栏的空间自适应：按容器实际宽度计算能放下几项，放不下的收进「更多」下拉。
 * 与网址导航页一致：窄屏不再横向铺满或横向滚动，超出的走下拉弹窗。
 */
export const useOverflowItems = <T>(
  items: T[],
  getKey: (item: T) => string,
  options: UseOverflowItemsOptions = {}
): UseOverflowItemsResult<T> => {
  const { enabled = true, reserveWidth = 48, fallbackWidth = 80 } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const widthCache = useRef(new Map<string, number>());
  // null 表示还没测量：先全量渲染一次，拿到各项真实宽度后再收拢
  const [visibleCount, setVisibleCount] = useState<number | null>(null);

  // 用 ref 持有最新值，measure 的依赖保持稳定，避免因数组每次渲染都新建而反复触发
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getKeyRef = useRef(getKey);
  getKeyRef.current = getKey;

  const keys = items.map(getKey).join('|');

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const currentItems = itemsRef.current;
    const currentGetKey = getKeyRef.current;

    // 已渲染的项取实测宽度并缓存，后续即使被收进下拉也能参与计算
    Array.from(container.children).forEach((child, index) => {
      const item = currentItems[index];
      const width = (child as HTMLElement).offsetWidth;
      if (item !== undefined && width > 0) {
        widthCache.current.set(currentGetKey(item), width);
      }
    });

    const gap = parseFloat(getComputedStyle(container).columnGap) || 0;
    const available = container.clientWidth - reserveWidth;

    let total = 0;
    let count = 0;
    for (const item of currentItems) {
      const width = widthCache.current.get(currentGetKey(item)) ?? fallbackWidth;
      const next = total + (count > 0 ? gap : 0) + width;
      // 至少保留一项，避免容器过窄时一个都不显示
      if (count > 0 && next > available) break;
      total = next;
      count += 1;
    }

    setVisibleCount(count);
  }, [reserveWidth, fallbackWidth]);

  useLayoutEffect(() => {
    if (!enabled) {
      setVisibleCount(null);
      return;
    }
    measure();
  }, [enabled, keys, measure]);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);
    window.addEventListener('resize', measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled, keys, measure]);

  if (!enabled || visibleCount === null) {
    return { containerRef, visible: items, overflow: [] };
  }

  const count = Math.max(1, Math.min(visibleCount, items.length));
  return { containerRef, visible: items.slice(0, count), overflow: items.slice(count) };
};
