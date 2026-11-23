import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Palette, PinOff } from 'lucide-react';
import type { StickyNote, StickyNoteBounds, StickyNoteColor } from '../../../types/stickyNote';
import ContextMenu from '../../../components/ui/ContextMenu';
import { STICKY_NOTE_COLORS } from './stickyNoteColors';

type Mode = 'view' | 'editing';

interface StickyNoteCardProps {
  note: StickyNote;
  /** 便签墙窗口左上角的桌面坐标：卡片存储绝对坐标，渲染时需换算 */
  origin: { x: number; y: number };
  wallApi: NonNullable<Window['stickyWallAPI']>;
  /** 位置/尺寸变更后持久化（绝对桌面坐标） */
  onBoundsChange: (id: string, bounds: Partial<StickyNoteBounds>) => void;
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const RESIZE_HOT_ZONE = 8;
const DRAG_THRESHOLD = 4;
const IDLE_SAVE_DELAY = 800;

const StickyNoteCard = ({ note, origin, wallApi, onBoundsChange }: StickyNoteCardProps) => {
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
    moved: false,
  });

  // 拖拽合帧：每帧最多写一次 transform
  const dragFrameRef = useRef(0);

  // 调整尺寸 refs
  const resizeStateRef = useRef({
    startX: 0,
    originWidth: 0,
  });

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
    const task = wallApi.update({ id: noteRef.current.id, content })
      .then((result) => {
        if (!result.ok) {
          setSaveError(result.error || '保存失败');
          return false;
        }
        lastSavedRef.current = content;
        if (options?.exitOnSuccess !== false) {
          exitEditing();
        }
        return true;
      })
      .catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : '保存失败');
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
    ds.pointerId = event.pointerId;
    ds.startX = event.clientX;
    ds.startY = event.clientY;
    ds.left = left;
    ds.top = top;
    ds.curLeft = left;
    ds.curTop = top;
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
      void wallApi.setDragActive(true);
      (event.currentTarget as HTMLElement).setPointerCapture(ds.pointerId);
    }

    if (ds.moved) {
      ds.curLeft = Math.round(ds.left + dx);
      ds.curTop = Math.round(ds.top + dy);
      // 合帧：指针事件只记录坐标，每帧最多写一次 transform
      if (dragFrameRef.current) return;
      dragFrameRef.current = requestAnimationFrame(() => {
        dragFrameRef.current = 0;
        applyDragTransform();
      });
    }
  }, [applyDragTransform, wallApi]);

  // pointerup / pointercancel / lostpointercapture 共用收尾，必须幂等
  const handlePointerEnd = useCallback((event: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds.active) return;
    ds.active = false;
    if (!ds.moved) return;

    // lostpointercapture 没有可靠坐标，沿用最后一次 pointermove
    if (event.type !== 'lostpointercapture') {
      ds.curLeft = Math.round(ds.left + (event.clientX - ds.startX));
      ds.curTop = Math.round(ds.top + (event.clientY - ds.startY));
    }
    if (dragFrameRef.current) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
    }
    const el = rootRef.current;
    if (el) el.style.transform = '';

    ds.moved = false;
    ds.pointerId = -1;
    setIsDragging(false);
    // 窗口内坐标 → 绝对桌面坐标后持久化
    onBoundsChange(noteRef.current.id, {
      x: originRef.current.x + ds.curLeft,
      y: originRef.current.y + ds.curTop,
    });
    // 等新命中矩形上报后再解除强制位，避免新旧矩形之间出现穿透空窗
    requestAnimationFrame(() => { void wallApi.setDragActive(false); });
  }, [onBoundsChange, wallApi]);

  // ── 调整宽度 ──
  const handleResizeDown = useCallback((event: React.PointerEvent) => {
    if (modeRef.current === 'editing') return;
    event.stopPropagation();

    const bounds = noteRef.current.bounds;
    resizeStateRef.current = {
      startX: event.clientX,
      originWidth: bounds?.width ?? 280,
    };

    setIsResizing(true);
    void wallApi.setDragActive(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, [wallApi]);

  const handleResizeMove = useCallback((event: React.PointerEvent) => {
    if (!isResizing) return;
    const rs = resizeStateRef.current;
    const dx = event.clientX - rs.startX;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(rs.originWidth + dx)));
    if (rootRef.current) {
      rootRef.current.style.width = `${newWidth}px`;
    }
  }, [isResizing]);

  const handleResizeUp = useCallback((event: React.PointerEvent) => {
    if (!isResizing) return;
    const rs = resizeStateRef.current;
    const dx = event.clientX - rs.startX;
    const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(rs.originWidth + dx)));
    onBoundsChange(noteRef.current.id, { width: newWidth });
    setIsResizing(false);
    void wallApi.setDragActive(false);
  }, [isResizing, onBoundsChange, wallApi]);

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
    void wallApi.update({ id: noteRef.current.id, color });
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

  return (
    <div
      ref={rootRef}
      className={`sticky-wall-card ${colorClass} ${isDragging ? 'sticky-wall-card--dragging' : ''} ${isResizing ? 'sticky-wall-card--resizing' : ''}`}
      style={style}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
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
          {note.content}
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

      {/* 宽度调整热区 */}
      <div
        className="sticky-resize-handle"
        onPointerDown={handleResizeDown}
        onPointerMove={handleResizeMove}
        onPointerUp={handleResizeUp}
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

export default StickyNoteCard;
