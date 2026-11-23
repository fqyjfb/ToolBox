import { useCallback, useEffect, useRef, useState } from 'react';
import type { StickyNote, StickyNoteBounds } from '../../../types/stickyNote';
import StickyNoteCard, { WALL_CLIENT_ID } from './StickyNoteCard';
import './StickyNote.css';

/**
 * 便签墙：单透明 BrowserWindow 承载全部钉住便签卡片。
 *
 * 穿透判定两层：
 *   快速路径：每次 mousemove 用 elementFromPoint 判断光标是否落在卡片/右键菜单上，
 *            命中 → 窗口可交互；未命中 → 窗口穿透。
 *   主进程看门狗：依据卡片矩形 + 系统光标纠偏，覆盖 mousemove 转发丢失
 *            （桌面层子窗口/触摸设备）导致的永久穿透。
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

    let hitFrame = 0;
    let lastPoint = { x: 0, y: 0 };

    const sync = (over: boolean) => {
      if (over === overInteractiveRef.current) return;
      overInteractiveRef.current = over;
      void wallApi.setInteractive(over);
    };

    const hitTest = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      return Boolean(el?.closest('.sticky-wall-card, .context-menu-container'));
    };

    // 合帧：指针事件只记录坐标，每帧最多做一次 elementFromPoint（强制布局）
    const handleMove = (event: MouseEvent) => {
      lastPoint = { x: event.clientX, y: event.clientY };
      if (hitFrame) return;
      hitFrame = requestAnimationFrame(() => {
        hitFrame = 0;
        sync(hitTest(lastPoint.x, lastPoint.y));
      });
    };

    // 鼠标移出窗口（如移向任务栏）不会再有 mousemove，必须兜底恢复穿透
    const handleLeave = () => {
      if (hitFrame) {
        cancelAnimationFrame(hitFrame);
        hitFrame = 0;
      }
      sync(false);
    };

    document.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    return () => {
      if (hitFrame) cancelAnimationFrame(hitFrame);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
    };
  }, [wallApi]);

  // 窗口失焦时本地去重缓存可能与主进程不一致，复位后等下一次 mousemove 重新同步
  useEffect(() => {
    const handleBlur = () => {
      overInteractiveRef.current = false;
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, []);

  // ── 上报卡片命中矩形：主进程看门狗据此判断系统光标是否落在便签上 ──
  // 渲染层矩形是窗口内 CSS 像素（= 屏幕 DIP），加上窗口原点即为屏幕 DIP 绝对坐标，
  // 与 screen.getCursorScreenPoint() 口径一致。
  const reportHitRects = useCallback(() => {
    if (!wallApi) return;
    const rects = Array.from(document.querySelectorAll('.sticky-wall-card')).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        left: origin.x + rect.left,
        top: origin.y + rect.top,
        right: origin.x + rect.right,
        bottom: origin.y + rect.bottom,
      };
    });
    void wallApi.setHitRects(rects);
  }, [wallApi, origin]);

  useEffect(() => {
    // 等一帧让卡片完成定位再测量
    const frame = requestAnimationFrame(reportHitRects);
    window.addEventListener('resize', reportHitRects);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', reportHitRects);
    };
  }, [reportHitRects, notes]);

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

  // ── 订阅变更广播：过滤自身 clientId，按 action 局部更新 ──
  useEffect(() => {
    if (!wallApi) return;
    return wallApi.onChanged((payload: { action?: string; id?: string; clientId?: string }) => {
      // 忽略自己发起的变更（主进程 broadcast 会带回发起方 clientId）
      if (payload.clientId && payload.clientId === WALL_CLIENT_ID) return;

      // 只对钉住便签有意义的变更做局部更新
      switch (payload.action) {
        case 'removed':
          setNotes((prev) => prev.filter((n) => n.id !== payload.id));
          break;
        case 'created':
        case 'pinned-changed':
          // 新建或钉住状态变更：可能改变钉住列表整体结构，重新拉取稳妥
          void loadPinned();
          break;
        case 'updated':
          // 内容/颜色更新：调单条 get，如果该便签仍钉住则局部替换
          if (!payload.id) break;
          void wallApi.get(payload.id).then((result) => {
            if (!result.ok || !result.note || !result.note.pinned) {
              // 被更新的便签已取消钉住：从列表移除
              setNotes((prev) => prev.filter((n) => n.id !== payload.id));
              return;
            }
            const updatedNote = result.note;
            setNotes((prev) => prev.map((n) => (n.id === payload.id ? updatedNote : n)));
          }).catch(() => {
            // get 失败回退全量
            void loadPinned();
          });
          break;
        default:
          void loadPinned();
      }
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
