import { useCallback, useEffect, useRef, useState } from 'react';

/** 鼠标从触发器移动到菜单面板的容错时间（ms）：这段时间内移回菜单会取消关闭 */
const CLOSE_DELAY = 180;

/**
 * 悬浮菜单（hover menu）的统一交互实现，供下拉/子菜单类组件共用：
 * - 鼠标进入触发器立即展开，离开后延迟关闭，中途移回菜单会取消关闭；
 * - 同一时刻最多展开一个菜单，用 key 区分触发器；
 * - 组件卸载时自动清理定时器。
 *
 * 使用约定（两者缺一不可，否则鼠标会在空隙处触发关闭）：
 * 1. 把 getTriggerProps(key) 绑在「触发器 + 菜单面板」的共同容器上；
 * 2. 菜单面板外层用 padding（如 pt-1）而不是 margin 与触发器保持视觉间距，
 *    让触发器与面板之间没有鼠标无法跨越的空隙。
 */
export const useHoverMenu = () => {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  /** 立即关闭（选中项、点击外部等场景） */
  const closeMenu = useCallback(() => {
    cancelClose();
    setOpenKey(null);
  }, [cancelClose]);

  /** 点击触发器手动开合 */
  const toggleMenu = useCallback((key: string) => {
    cancelClose();
    setOpenKey((prev) => (prev === key ? null : key));
  }, [cancelClose]);

  /** 绑定到「触发器 + 菜单面板」的共同容器 */
  const getTriggerProps = useCallback(
    (key: string) => ({
      onMouseEnter: () => {
        cancelClose();
        setOpenKey(key);
      },
      onMouseLeave: () => {
        cancelClose();
        closeTimerRef.current = setTimeout(() => {
          closeTimerRef.current = null;
          setOpenKey(null);
        }, CLOSE_DELAY);
      },
    }),
    [cancelClose],
  );

  useEffect(() => cancelClose, [cancelClose]);

  return { openKey, closeMenu, toggleMenu, getTriggerProps };
};
