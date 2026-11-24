import React, { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Copy, Palette, PinOff } from 'lucide-react';
import type { StickyNote, StickyNoteBounds, StickyNoteColor } from '../../../types/stickyNote';
import ContextMenu from '../../../components/ui/ContextMenu';
import { STICKY_NOTE_COLORS } from './stickyNoteColors';

/** 便签墙窗口渲染端 clientId：便签墙内所有 update 带上它，让主进程 broadcast 可过滤自身回声。
 *  模块级常量（不是 useRef），StickyNoteWall 和 StickyNoteCard 共享同一份。 */
export const WALL_CLIENT_ID = `wall_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

type Mode = 'view' | 'editing';

interface StickyNoteCardProps {
  note: StickyNote;
  /** 便签墙窗口左上角的桌面坐标：卡片存储绝对坐标，渲染时需换算 */
  origin: { x: number; y: number };
  wallApi: NonNullable<Window['stickyWallAPI']>;
  /** 位置/尺寸变更后持久化（绝对桌面坐标） */
  onBoundsChange: (id: string, bounds: Partial<StickyNoteBounds>) => void;
  /** 拖拽开始/结束时通知墙：墙据此持续上报 hit-rect（拖拽中 transform 改变但 notes 不变，需主动驱动） */
  onDragStateChange?: (dragging: boolean) => void;
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const RESIZE_HOT_ZONE = 8;
const DRAG_THRESHOLD = 4;
const IDLE_SAVE_DELAY = 800;
/** 收尾位置安全阈值：与最后一次 pointermove 偏差超过该值视为异常事件坐标，回退到最后一次移动位置 */
const MAX_END_JUMP = 1200;
/** 非编辑态截断预览长度，主进程 MAX_CONTENT=20000 但墙内展示前 2000 字符 */
const PREVIEW_MAX_LEN = 2000;

const StickyNoteCard = ({ note, origin, wallApi, onBoundsChange, onDragStateChange }: StickyNoteCardProps) => {
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState(note.content);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [hint, setHint] = useState('');

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // 右键菜单
  const [menu, setMenu] = useState({ open: false, x: 0, y: 0 });
  const hintTimerRef = useRef<number | null>(null);

  const noteRef = useRef(note);
  const originRef = useRef(origin);
  const modeRef = useRef<Mode>('view');
  const draftRef = useRef(note.content);
  const lastSavedRef = useRef(note.content);
  const savingPromiseRef = useRef<Promise<boolean> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // 拖拽 refs（left/top 为窗口内坐标）
  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0, startY: 0,
    left: 0, top: 0,
    curLeft: 0, curTop: 0,
    // 最后一次 pointermove 的累积位置：收尾时若事件坐标不可信，作为兜底基准
    lastMoveLeft: 0, lastMoveTop: 0,
    moved: false,
    // 拖拽序号：收尾是异步的（可能要取系统光标），期间若已开始新拖拽则丢弃旧提交
    gen: 0,
  });

  // 拖拽合帧：每帧最多写一次 transform
  const dragFrameRef = useRef(0);

  // 调整尺寸 refs
  const resizeStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    originWidth: 0,
    lastDx: 0, // 最后一次 pointermove 的 dx，供 lostpointercapture 时使用
  });

  // 调整尺寸合帧：每帧最多写一次 width
  const resizeFrameRef = useRef(0);
  const pendingWidthRef = useRef(0);

  noteRef.current = note;
  originRef.current = origin;
  modeRef.current = mode;
  draftRef.current = draft;
  lastSavedRef.current = note.content;

  // 拖拽期间用 transform 位移，避免每帧写 left/top 触发布局
  const applyDragTransform = useCallback(() => {
    const ds = dragStateRef.current;
    const el = rootRef.current;
    if (!el || !ds.moved) return;
    el.style.transform = `translate3d(${ds.curLeft - ds.left}px, ${ds.curTop - ds.top}px, 0)`;
  }, []);

  // 退出编辑统一出口：解除穿透强制位 + 把窗口挂回桌面层（恢复"Win+D 可见但不遮挡应用"）
  const exitEditing = useCallback(() => {
    setMode('view');
    void wallApi.setDragActive(false);
    void wallApi.setEditing(false);
  }, [wallApi]);

  const beginEdit = useCallback(async () => {
    if (modeRef.current === 'editing') return;
    // 先解挂桌面层并让 BrowserWindow 拿到系统键盘焦点，否则 textarea 收不到输入
    await wallApi.setEditing(true);
    setDraft(lastSavedRef.current);
    setSaveError('');
    setMode('editing');
    // 进入编辑模式 → forceInteractive
    void wallApi.setDragActive(true);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [wallApi]);

  const commitEdit = useCallback((options?: { exitOnSuccess?: boolean }): Promise<boolean> => {
    if (modeRef.current !== 'editing') return Promise.resolve(true);

    const content = draftRef.current;
    if (!content.trim()) {
      setDraft(lastSavedRef.current);
      exitEditing();
      return Promise.resolve(false);
    }
    if (content === lastSavedRef.current) {
      exitEditing();
      return Promise.resolve(true);
    }

    if (savingPromiseRef.current) {
      return savingPromiseRef.current.then(() => commitEdit(options));
    }

    setSaving(true);
    setSaveError('');
    // P1-5 乐观并发：把当前已知的 updatedAt 传给主进程，冲突时提示刷新
    const knownUpdatedAt = noteRef.current.updatedAt;
    const task = wallApi.update({
      id: noteRef.current.id,
      content,
      clientId: WALL_CLIENT_ID,
      updatedAt: knownUpdatedAt,
    })
      .then(async (result) => {
        if (!result.ok) {
          // P1-3 保存失败 → 写草稿兜底，下次编辑时自动恢复
          await wallApi.saveDraft(noteRef.current.id, content);
          if ((result as { conflict?: boolean }).conflict) {
            setSaveError(`${result.error || '此便签已被其他窗口修改'}，请刷新后重试`);
          } else {
            setSaveError(result.error || '保存失败（已存为草稿）');
          }
          return false;
        }
        lastSavedRef.current = content;
        // 保存成功 → 主进程会清草稿，这里再清一次确保
        void wallApi.clearDraft(noteRef.current.id);
        if (options?.exitOnSuccess !== false) {
          exitEditing();
        }
        return true;
      })
      .catch(async (error: unknown) => {
        // 网络/IO 异常 → 写草稿兜底
        await wallApi.saveDraft(noteRef.current.id, content);
        setSaveError(error instanceof Error ? `${error.message}（已存为草稿）` : '保存失败（已存为草稿）');
        return false;
      })
      .finally(() => {
        savingPromiseRef.current = null;
        setSaving(false);
      });
    savingPromiseRef.current = task;
    return task;
  }, [wallApi, exitEditing]);

  // 卸载前 flush
  useEffect(() => {
    return () => {
      if (dragFrameRef.current) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = 0;
      }
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = 0;
      }
      if (modeRef.current === 'editing') {
        // 同步保存（主进程 API 无法在卸载时 await，尽力而为）
        void commitEdit();
      }
      void wallApi.setDragActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 空闲兜底保存
  useEffect(() => {
    if (mode !== 'editing' || saving) return;
    if (draft === lastSavedRef.current) return;
    const timer = window.setTimeout(() => {
      void commitEdit({ exitOnSuccess: false });
    }, IDLE_SAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [mode, draft, saving, commitEdit]);

  // 窗口失焦兜底
  useEffect(() => {
    const handleBlur = () => {
      if (modeRef.current === 'editing') void commitEdit();
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [commitEdit]);

  // ── 拖拽 ──
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    // 编辑中不触发拖拽（否则会抢走 textarea 的选词）
    if (modeRef.current === 'editing') return;
    // 右侧热区交给 resize 处理
    const target = event.target as HTMLElement;
    if (target.closest('.sticky-resize-handle')) return;

    const root = rootRef.current;
    const left = root?.offsetLeft ?? 0;
    const top = root?.offsetTop ?? 0;
    const ds = dragStateRef.current;
    ds.active = true;
    ds.gen += 1;
    ds.pointerId = event.pointerId;
    ds.startX = event.clientX;
    ds.startY = event.clientY;
    ds.left = left;
    ds.top = top;
    ds.curLeft = left;
    ds.curTop = top;
    ds.lastMoveLeft = left;
    ds.lastMoveTop = top;
    ds.moved = false;
    // 注意：这里不立即 setPointerCapture，否则 Chromium 会把 click/dblclick
    // 目标重定向到捕获元素，导致子节点的双击编辑失效。超过阈值后再捕获。
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds.active) return;

    const dx = event.clientX - ds.startX;
    const dy = event.clientY - ds.startY;

    if (!ds.moved && Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
      ds.moved = true;
      setIsDragging(true);
      onDragStateChange?.(true);
      void wallApi.setDragActive(true);
      // 用 ref 而非 event.currentTarget：document 兜底监听时 currentTarget 是 document
      try {
        rootRef.current?.setPointerCapture(ds.pointerId);
      } catch {
        // 指针已失效时抛 NotFoundError，忽略即可，document 监听仍能继续驱动
      }
    }

    if (ds.moved) {
      ds.curLeft = Math.round(ds.left + dx);
      ds.curTop = Math.round(ds.top + dy);
      ds.lastMoveLeft = ds.curLeft;
      ds.lastMoveTop = ds.curTop;
      // 合帧：指针事件只记录坐标，每帧最多写一次 transform
      if (dragFrameRef.current) return;
      dragFrameRef.current = requestAnimationFrame(() => {
        dragFrameRef.current = 0;
        applyDragTransform();
      });
    }
  }, [applyDragTransform, wallApi, onDragStateChange]);

  // pointerup / pointercancel / lostpointercapture 共用收尾，必须幂等
  const handlePointerEnd = useCallback((event: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds.active) return;
    ds.active = false;
    if (!ds.moved) return;

    const gen = ds.gen;

    // 只有 pointerup 的 event 坐标可靠。pointercancel / lostpointercapture 的
    // clientX/clientY 不可信（Chromium 或系统取消指针时常为 0），若直接套公式会
    // 得到极端负坐标，被主进程 clipBoundsToWorkArea 裁到 workArea 边缘，表现为
    // 便签瞬移到屏幕边缘或消失。这两类必须取主进程系统光标位置反推。
    const coordsReliable = event.type === 'pointerup'
      && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);

    const resolveFinalPosition = async () => {
      // 默认基准：最后一次 pointermove 的累积位置（拖拽期间持续更新）
      let nextLeft = ds.lastMoveLeft;
      let nextTop = ds.lastMoveTop;

      if (coordsReliable) {
        nextLeft = Math.round(ds.left + (event.clientX - ds.startX));
        nextTop = Math.round(ds.top + (event.clientY - ds.startY));
      } else {
        try {
          const res = await wallApi.getCursorScreenPoint();
          if (res.ok && res.point) {
            // 系统光标是屏幕 DIP，减去窗口 origin 得到窗口内坐标
            const clientX = res.point.x - originRef.current.x;
            const clientY = res.point.y - originRef.current.y;
            nextLeft = Math.round(ds.left + (clientX - ds.startX));
            nextTop = Math.round(ds.top + (clientY - ds.startY));
          }
        } catch {
          // 静默：沿用最后一次 pointermove 位置
        }
      }

      // 安全网：坐标非法或与最后一次移动位置偏差过大时回退，避免任何异常事件
      // 把便签甩到屏幕边缘（主进程裁剪会把它固化成"消失"）。
      const jumped = !Number.isFinite(nextLeft) || !Number.isFinite(nextTop)
        || Math.hypot(nextLeft - ds.lastMoveLeft, nextTop - ds.lastMoveTop) > MAX_END_JUMP;
      if (jumped) {
        nextLeft = ds.lastMoveLeft;
        nextTop = ds.lastMoveTop;
      }

      return { nextLeft, nextTop };
    };

    void resolveFinalPosition().then(({ nextLeft, nextTop }) => {
      // 异步期间若已开始新的拖拽，丢弃本次提交，避免覆盖新拖拽状态；
      // 但拖拽计数必须归还，否则便签墙的 rAF 上报循环会常驻
      if (ds.gen !== gen) {
        onDragStateChange?.(false);
        return;
      }

      if (dragFrameRef.current) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = 0;
      }

      ds.moved = false;
      ds.pointerId = -1;
      setIsDragging(false);
      onDragStateChange?.(false);

      // 先同步提交新位置让 React 用新 left/top 完成重渲染，再清 transform：
      // 两步在同一帧内完成，卡片从"transform 位移"无缝切到"left/top 定位"，
      // 不会出现先回跳原位置再跳到新位置的闪烁。
      flushSync(() => {
        onBoundsChange(noteRef.current.id, {
          x: originRef.current.x + nextLeft,
          y: originRef.current.y + nextTop,
        });
      });
      const el = rootRef.current;
      if (el) el.style.transform = '';

      // 穿透空窗防护：等两帧再解除强制位。
      // 第 1 帧 React 用新 bounds 重渲染并触发 reportHitRects（rAF）；
      // 第 2 帧 hit-rect IPC 已到主进程，此时解除强制位看门狗不会用旧矩形误判切穿透。
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { void wallApi.setDragActive(false); });
      });
    });
  }, [onBoundsChange, wallApi, onDragStateChange]);

  // ── 调整宽度 ──
  const handleResizeDown = useCallback((event: React.PointerEvent) => {
    if (modeRef.current === 'editing') return;
    event.stopPropagation();

    const bounds = noteRef.current.bounds;
    const rs = resizeStateRef.current;
    rs.active = true;
    rs.pointerId = event.pointerId;
    rs.startX = event.clientX;
    rs.originWidth = bounds?.width ?? 280;
    rs.lastDx = 0;

    pendingWidthRef.current = rs.originWidth;
    setIsResizing(true);
    void wallApi.setDragActive(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [wallApi]);

  const handleResizeMove = useCallback((event: React.PointerEvent) => {
    const rs = resizeStateRef.current;
    if (!rs.active) return;
    const dx = event.clientX - rs.startX;
    rs.lastDx = dx;
    pendingWidthRef.current = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(rs.originWidth + dx)));
    // 合帧：指针事件只记录目标值，每帧最多写一次 width
    if (resizeFrameRef.current) return;
    resizeFrameRef.current = requestAnimationFrame(() => {
      resizeFrameRef.current = 0;
      if (rootRef.current) {
        rootRef.current.style.width = `${pendingWidthRef.current}px`;
      }
    });
  }, []);

  // pointerup / pointercancel / lostpointercapture 共用的幂等收尾
  const finalizeResize = useCallback((event?: React.PointerEvent) => {
    const rs = resizeStateRef.current;
    if (!rs.active) return;
    rs.active = false;

    // 只有 pointerup 的 event 坐标可靠；pointercancel / lostpointercapture 常为 0，
    // 直接套公式会把宽度算到最小值，必须沿用最后一次 pointermove 的位移
    const dx = event?.type === 'pointerup' && Number.isFinite(event.clientX)
      ? event.clientX - rs.startX
      : rs.lastDx;
    const finalWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(rs.originWidth + dx)));

    // 取消待执行的 rAF 合帧，避免收尾后又写一次过期 width
    if (resizeFrameRef.current) {
      cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = 0;
    }
    if (rootRef.current) {
      rootRef.current.style.width = `${finalWidth}px`;
    }

    rs.pointerId = -1;
    setIsResizing(false);
    onBoundsChange(noteRef.current.id, { width: finalWidth });
    // 与拖拽收尾一致：等新命中矩形上报生效后再解除强制位，避免穿透空窗
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { void wallApi.setDragActive(false); });
    });
  }, [onBoundsChange, wallApi]);

  // 输入兜底：Win10 桌面层子窗口会丢失 pointer capture，事件不再派发到卡片元素，
  // 表现为快速拖拽时便签脱离鼠标、卡住、松手后位置跳变。改为在 document 上接管
  // 拖拽/缩放的 move 与 end，只要窗口还能收到输入就能持续跟随并正常收尾。
  // 同时覆盖 Alt+Tab / Win+D 收不到 pointerup 的失焦场景。
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (resizeStateRef.current.active) {
        if (event.pointerId === resizeStateRef.current.pointerId) {
          handleResizeMove(event as unknown as React.PointerEvent);
        }
        return;
      }
      if (event.pointerId === dragStateRef.current.pointerId) {
        handlePointerMove(event as unknown as React.PointerEvent);
      }
    };
    const onEnd = (event: PointerEvent) => {
      if (resizeStateRef.current.active) {
        if (event.pointerId === resizeStateRef.current.pointerId) {
          finalizeResize(event as unknown as React.PointerEvent);
        }
        return;
      }
      if (event.pointerId === dragStateRef.current.pointerId) {
        handlePointerEnd(event as unknown as React.PointerEvent);
      }
    };
    const onBlur = () => {
      finalizeResize();
      if (dragStateRef.current.active) {
        handlePointerEnd({ type: 'lostpointercapture' } as React.PointerEvent);
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onBlur);
    };
  }, [finalizeResize, handlePointerEnd, handlePointerMove, handleResizeMove]);

  // ── 键盘 ──
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(lastSavedRef.current);
      setSaveError('');
      exitEditing();
      return;
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      if (event.nativeEvent.isComposing) return;
      event.preventDefault();
      void commitEdit();
    }
  }, [commitEdit, exitEditing]);

  // ── 操作：取消钉住 / 复制 / 右键菜单 ──
  const handleUnpin = useCallback(async () => {
    const ok = await commitEdit();
    if (!ok) return;
    try {
      await wallApi.unpin(noteRef.current.id);
    } catch {
      // 窗口销毁时 invoke 可能被中断
    }
  }, [commitEdit, wallApi]);

  const closeMenu = useCallback(() => setMenu({ open: false, x: 0, y: 0 }), []);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    // 编辑中不弹菜单，避免和文本选择/输入法冲突
    if (modeRef.current === 'editing') return;
    setMenu({ open: true, x: event.clientX, y: event.clientY });
  }, []);

  // 菜单渲染在 body 下（卡片外），需要临时保持窗口可交互
  useEffect(() => {
    if (!menu.open) return;
    void wallApi.setDragActive(true);
    return () => {
      void wallApi.setDragActive(false);
    };
  }, [menu.open, wallApi]);

  const handleCopy = useCallback(async () => {
    const result = await wallApi.copyText(noteRef.current.content);
    setHint(result.ok ? '已复制' : '复制失败');
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint(''), 1200);
  }, [wallApi]);

  // 切换配色：走 update 通道，主进程广播后便签墙与主窗口同步刷新
  const handleColorChange = useCallback((color: StickyNoteColor) => {
    void wallApi.update({ id: noteRef.current.id, color, clientId: WALL_CLIENT_ID });
  }, [wallApi]);

  useEffect(() => () => {
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
  }, []);

  const colorClass = `sticky-wall-card-${note.color}`;

  // 绝对桌面坐标 → 窗口内坐标（画布原点 = 窗口左上角）
  const style: React.CSSProperties = {
    left: Math.max(0, (note.bounds?.x ?? 80) - origin.x),
    top: Math.max(0, (note.bounds?.y ?? 80) - origin.y),
    width: note.bounds?.width ?? 280,
  };

  // 非编辑态截断预览：主进程 MAX_CONTENT=20000 但墙内展示前 PREVIEW_MAX_LEN 字符
  const previewContent = note.content.length > PREVIEW_MAX_LEN
    ? `${note.content.slice(0, PREVIEW_MAX_LEN)}…`
    : note.content;

  return (
    <div
      ref={rootRef}
      className={`sticky-wall-card ${colorClass} ${isDragging ? 'sticky-wall-card--dragging' : ''} ${isResizing ? 'sticky-wall-card--resizing' : ''}`}
      style={style}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onLostPointerCapture={handlePointerEnd}
    >
      {mode === 'editing' ? (
        <textarea
          ref={textareaRef}
          className="sticky-wall-card-textarea"
          value={draft}
          placeholder="开始记录…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commitEdit()}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div
          className="sticky-wall-card-content"
          title="双击编辑"
          onDoubleClick={beginEdit}
        >
          {previewContent}
        </div>
      )}

      {/* 操作浮层：仅 hover 时显示 */}
      {mode === 'view' && (
        <div className="sticky-wall-card-actions" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="sticky-wall-card-action"
            title="取消钉住"
            aria-label="取消钉住"
            onClick={() => void handleUnpin()}
          >
            ✕
          </button>
        </div>
      )}

      {/* 宽度调整热区：move/up/cancel 统一由 document 兜底监听处理，避免捕获丢失后失效 */}
      <div
        className="sticky-resize-handle"
        onPointerDown={handleResizeDown}
        onLostPointerCapture={finalizeResize}
        style={{ width: RESIZE_HOT_ZONE }}
      />

      {saveError && (
        <div className="sticky-wall-card-error">{saveError}</div>
      )}

      {hint && <div className="sticky-wall-card-hint">{hint}</div>}

      <ContextMenu
        isOpen={menu.open}
        x={menu.x}
        y={menu.y}
        onClose={closeMenu}
        items={[
          {
            id: 'copy',
            label: '复制',
            icon: <Copy size={16} />,
            onClick: () => {
              void handleCopy();
            },
          },
          {
            id: 'color',
            label: '颜色',
            icon: <Palette size={16} />,
            subMenu: STICKY_NOTE_COLORS.map((option) => ({
              id: `color-${option.value}`,
              label: option.label,
              icon: (
                <span
                  className={`sticky-color-dot sticky-color-${option.value}`}
                  aria-hidden="true"
                />
              ),
              onClick: () => handleColorChange(option.value),
            })),
          },
          { id: 'divider', divider: true },
          {
            id: 'unpin',
            label: '取消',
            icon: <PinOff size={16} />,
            className: 'danger',
            onClick: () => {
              void handleUnpin();
            },
          },
        ]}
      />
    </div>
  );
};

export default React.memo(StickyNoteCard);
