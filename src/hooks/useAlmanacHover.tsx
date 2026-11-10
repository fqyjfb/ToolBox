/* 本文件是 hook，内含按需加载的浮层组件定义，react-refresh 规则不适用 */
/* eslint-disable react-refresh/only-export-components */
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
 *
 * 同时支持「点击持久显示」：
 * - showClick 触发后 popover 不受 mouseleave 影响；
 * - hideClick 在点击其它区域 / 外部调用时关闭。
 */
export const useAlmanacHover = (delay = 200) => {
  const [hoverTarget, setHoverTarget] = useState<AlmanacHoverTarget | null>(null);
  const [pinnedTarget, setPinnedTarget] = useState<AlmanacHoverTarget | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setHoverTarget(null);
  }, [clearTimer]);

  const show = useCallback((event: MouseEvent<Element>, date: AlmanacDate) => {
    clearTimer();
    const rect = event.currentTarget.getBoundingClientRect();
    timerRef.current = window.setTimeout(() => setHoverTarget({ rect, date }), delay);
  }, [clearTimer, delay]);

  const showClick = useCallback((event: MouseEvent<Element>, date: AlmanacDate) => {
    clearTimer();
    setHoverTarget(null);
    const rect = event.currentTarget.getBoundingClientRect();
    setPinnedTarget({ rect, date });
  }, [clearTimer]);

  const hideClick = useCallback(() => {
    setPinnedTarget(null);
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // pinned 优先：一旦用户点击选中，悬浮交互让位给持久展示
  const target = pinnedTarget ?? hoverTarget;

  return {
    show,
    hide,
    showClick,
    hideClick,
    isPinned: pinnedTarget !== null,
    // 按日期做 key：切换日期时重新挂载浮层，保证每次都以真实尺寸重新定位
    popover: target ? (
      <Suspense fallback={null}>
        <AlmanacPopover
          key={`${target.date.year}-${target.date.month}-${target.date.day}-${pinnedTarget ? 'pinned' : 'hover'}`}
          rect={target.rect}
          date={target.date}
          pinned={pinnedTarget !== null}
        />
      </Suspense>
    ) : null,
  };
};
