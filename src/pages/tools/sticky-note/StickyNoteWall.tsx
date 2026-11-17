import { useCallback, useEffect, useRef, useState } from 'react';
import type { StickyNote, StickyNoteBounds } from '../../../types/stickyNote';
import StickyNoteCard from './StickyNoteCard';
import './StickyNote.css';

/**
 * 便签墙：单透明 BrowserWindow 承载全部钉住便签卡片。
 *
 * 穿透判定（渲染层单一事实来源，可自愈）：
 *   每次 mousemove 用 elementFromPoint 判断光标是否落在卡片/右键菜单上，
 *   命中 → 窗口可交互；未命中 → 窗口穿透。
 *   主进程 blur 只做安全兜底，下一次 mousemove 会自动纠正，不存在计数泄漏。
 */
const StickyNoteWall = () => {
  const wallApi = window.stickyWallAPI;

  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  // 便签墙窗口左上角对应的桌面坐标：卡片存储的是绝对坐标，渲染时减去它
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  // 上一次上报的命中结果，只在变化时发 IPC
  const overInteractiveRef = useRef(false);

  // ── 鼠标命中判定：单源、自愈 ──
  useEffect(() => {
    if (!wallApi) return;

    const sync = (over: boolean) => {
      if (over === overInteractiveRef.current) return;
      overInteractiveRef.current = over;
      void wallApi.setInteractive(over);
    };

    const hitTest = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return Boolean(el?.closest('.sticky-wall-card, .context-menu-container'));
    };

    const handleMove = (event: MouseEvent) => {
      sync(hitTest(event.clientX, event.clientY));
    };

    // 鼠标移出窗口（如移向任务栏）不会再有 mousemove，必须兜底恢复穿透
    const handleLeave = () => sync(false);

    document.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
    };
  }, [wallApi]);

  // 窗口失焦后主进程会强制穿透，这里同步本地缓存等待下一次 mousemove 修正
  useEffect(() => {
    const handleBlur = () => {
      overInteractiveRef.current = false;
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // ── 拉取钉住便签 ──
  const loadPinned = useCallback(async () => {
    if (!wallApi) return;
    try {
      const result = await wallApi.listPinned();
      if (result.ok && result.notes) {
        setNotes(result.notes);
        if (result.origin) setOrigin(result.origin);
      }
    } catch {
      // preload 尚未注入时静默失败
    } finally {
      setLoading(false);
    }
  }, [wallApi]);

  useEffect(() => {
    void loadPinned();
  }, [loadPinned]);

  // 显示器分辨率/排列变化：主进程重设画布后推送新的坐标原点
  useEffect(() => {
    if (!wallApi) return;
    return wallApi.onOriginChanged((next) => setOrigin(next));
  }, [wallApi]);

  // ── 订阅变更广播：主进程是唯一数据源，任何变更都重新拉取 ──
  useEffect(() => {
    if (!wallApi) return;
    return wallApi.onChanged(() => {
      void loadPinned();
    });
  }, [wallApi, loadPinned]);

  // ── bounds 变更回调：合并式持久化 ──
  const handleBoundsChange = useCallback(async (id: string, bounds: Partial<StickyNoteBounds>) => {
    if (!wallApi) return;
    // 乐观更新本地 state，避免等待 IPC roundtrip
    setNotes((prev) => prev.map((n) => (n.id === id
      ? { ...n, bounds: { ...(n.bounds ?? { width: 280, height: 200 }), ...bounds } as StickyNoteBounds }
      : n)));
    const result = await wallApi.saveBounds({ id, bounds });
    // 保存失败时回读磁盘真实值，避免本地状态与持久化不一致
    if (!result.ok) void loadPinned();
  }, [wallApi, loadPinned]);

  if (!wallApi) {
    return null;
  }

  if (loading) {
    return <div className="sticky-wall" />;
  }

  // 清空时主进程会销毁窗口，但渲染层先清理
  if (notes.length === 0) {
    return <div className="sticky-wall" />;
  }

  return (
    <div className="sticky-wall">
      {notes.map((note) => (
        <StickyNoteCard
          key={note.id}
          note={note}
          origin={origin}
          wallApi={wallApi}
          onBoundsChange={handleBoundsChange}
        />
      ))}
    </div>
  );
};

export default StickyNoteWall;
