import { type MouseEvent, useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { AlmanacDate } from '../components/home/AlmanacPanel';

// 黄历浮层按需加载：AlmanacPanel -> utils/almanac -> tyme4ts。
// 静态导入会把 tyme4ts 带进首屏包体，而浮层只在悬浮/打开日历时才需要，
// 改为 lazy 后 tyme4ts 只在用户真正看到黄历时才加载。
const AlmanacPopover = lazy(() =>
  import('../components/home/AlmanacPanel').then((m) => ({ default: m.AlmanacPopover })),
);

interface AlmanacHoverTarget {
  rect: DOMRect;
  date: AlmanacDate;
}

/**
 * 黄历悬浮提示：延迟展示 + 渲染到 body，与 useHoverTooltip 同一套思路，
 * 只是承载的是富内容面板而非纯文本。
 */
export const useAlmanacHover = (delay = 200) => {
  const [target, setTarget] = useState<AlmanacHoverTarget | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setTarget(null);
  }, [clearTimer]);

  const show = useCallback((event: MouseEvent<Element>, date: AlmanacDate) => {
    clearTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    timerRef.current = window.setTimeout(() => setTarget({ rect, date }), delay);
  }, [clearTimer, delay]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    show,
    hide,
    // 按日期做 key：切换日期时重新挂载浮层，保证每次都以真实尺寸重新定位
    popover: target ? (
      <Suspense fallback={null}>
        <AlmanacPopover
          key={`${target.date.year}-${target.date.month}-${target.date.day}`}
          rect={target.rect}
          date={target.date}
        />
      </Suspense>
    ) : null,
  };
};
