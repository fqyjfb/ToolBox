import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronRight,
  ClipboardList,
  Copy,
  Image as ImageIcon,
  Minus,
  Plus,
  Table2,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SourceBlock } from '@/lib/markdown';
import {
  blockToken,
  currentConvertKind,
  TYPE_ITEMS,
  typeIcon,
  type ConvertKind,
} from './blockConvert';
import { TablePicker } from './TablePicker';
import { useDismiss, useMenuPosition, type MenuPoint } from './useMenuPosition';
import './MarkdownEditor.css';

/** 「在下方插入」子菜单的 hover 关闭延时 */
const SUBMENU_CLOSE_DELAY = 220;

/** 类型网格：独立组件（避免 react-hooks/static-components 规则报错） */
function TypeGrid({
  onPick,
  compact = false,
  currentKind = null,
}: {
  onPick: (kind: ConvertKind) => void;
  compact?: boolean;
  currentKind?: ConvertKind | null;
}) {
  return (
    <div className={`mde-type-grid${compact ? ' is-compact' : ''}`}>
      {TYPE_ITEMS.map((item) => {
        const Icon = typeIcon(item.kind);
        return (
          <button
            key={item.kind}
            type="button"
            className="mde-type-item"
            role="menuitemradio"
            aria-checked={!compact && item.kind === currentKind}
            onClick={() => onPick(item.kind)}
          >
            <Icon size={compact ? 16 : 18} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 通用插入项：表格（尺寸选择器）、分割线、会议记录模板、图片 */
type CommonInsertKind = 'table' | 'divider' | 'meeting-notes' | 'image';
const COMMON_INSERT_ITEMS: ReadonlyArray<{
  kind: CommonInsertKind;
  icon: LucideIcon;
  label: string;
}> = [
  { kind: 'table', icon: Table2, label: '表格' },
  { kind: 'divider', icon: Minus, label: '分割线' },
  { kind: 'meeting-notes', icon: ClipboardList, label: '会议记录' },
  { kind: 'image', icon: ImageIcon, label: '图片' },
];

type InsertHandler = (below: boolean) => boolean | void;

/** 通用插入网格：「插入块」面板与「在下方插入」子菜单共用，避免两处分支重复 */
function CommonInsertGrid({
  below,
  tableOpen,
  onToggleTable,
  onInsertTable,
  onInsertDivider,
  onInsertMeetingNotes,
  onInsertImage,
  onDone,
  keyPrefix = '',
  style,
}: {
  below: boolean;
  tableOpen: boolean;
  onToggleTable: () => void;
  onInsertTable?: (rows: number, cols: number, below: boolean) => boolean;
  onInsertDivider?: InsertHandler;
  onInsertMeetingNotes?: InsertHandler;
  onInsertImage?: InsertHandler;
  onDone: () => void;
  keyPrefix?: string;
  style?: React.CSSProperties;
}) {
  const handlers: Record<Exclude<CommonInsertKind, 'table'>, InsertHandler | undefined> = {
    divider: onInsertDivider,
    'meeting-notes': onInsertMeetingNotes,
    image: onInsertImage,
  };
  return (
    <div className="mde-type-grid is-compact" style={style}>
      {COMMON_INSERT_ITEMS.map((item) => {
        const Icon = item.icon;
        if (item.kind === 'table') {
          return (
            <button
              key={`${keyPrefix}table`}
              type="button"
              className="mde-type-item"
              aria-haspopup="dialog"
              aria-expanded={tableOpen}
              disabled={!onInsertTable}
              onClick={onToggleTable}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </button>
          );
        }
        const handler = handlers[item.kind];
        return (
          <button
            key={`${keyPrefix}${item.kind}`}
            type="button"
            className="mde-type-item"
            disabled={!handler}
            onClick={() => {
              if (handler?.(below) !== false) onDone();
            }}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export interface BlockMenuProps {
  /** 当前块：用于显示类型 token 与高亮菜单里的当前类型 */
  block: SourceBlock;
  /** 所属 .mde-block 根元素引用：块内 gutter 定位（不再 portal 到 body） */
  anchorRef: React.RefObject<HTMLElement | null>;
  onConvert: (kind: ConvertKind) => boolean;
  /** 在当前块**下方**插入新块并套用类型；返回值 = patch 是否生效 */
  onInsertBelow?: (kind: ConvertKind) => boolean;
  /** 空块：插入即**替换**当前块；返回值 = patch 是否生效 */
  onInsertHere?: (kind: ConvertKind) => boolean;
  /** 表格尺寸选定后插入；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertTable?: (rows: number, cols: number, below: boolean) => boolean;
  /** 插入分割线；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertDivider?: (below: boolean) => boolean;
  /** 插入会议记录模板；`below=false` 表示替换当前空块；返回值 = patch 是否生效 */
  onInsertMeetingNotes?: (below: boolean) => boolean;
  /** 打开「插入图片」弹窗；返回值与其它插入项一致（false = 不关闭菜单） */
  onInsertImage?: (below: boolean) => boolean | void;
  onDelete?: () => boolean;
  onDuplicate?: () => boolean;
  /** 选区工具栏可见时为 true：强制隐藏 gutter，避免浮层互相遮挡 */
  selectionActive?: boolean;
  /** 右键打开块菜单，默认 true（Electron 渲染进程没有系统右键菜单） */
  enableContextMenu?: boolean;
}

/**
 * ★块悬浮菜单（gutter + 面板）★
 *
 * 核心设计：
 * - gutter **永远挂载在块内**（absolute 定位），opacity 切换，永不卸载
 * - 显隐规则由 CSS 伪类控制：.mde-block:hover / :focus-within / .has-block-menu 时 opacity=1
 * - 「块之间 hover 竞争」由 .mde-canvas:has(.mde-block:hover) 统一压制其他块的 gutter
 * - 面板本身 portal 到 body（浮层可能超出视口），触发器 ref 直接取块内按钮 DOM
 *
 * 插入入口两段式：
 * - 空块：gutter 显示 `+`，点击直接打开**插入型**面板（替换该空块）。
 * - 非空块：面板内「在下方插入」hover 220ms 展开子菜单。
 */
export function BlockMenu({
  block,
  anchorRef,
  onConvert,
  onInsertBelow,
  onInsertHere,
  onInsertTable,
  onInsertDivider,
  onInsertMeetingNotes,
  onInsertImage,
  onDelete,
  onDuplicate,
  selectionActive,
  enableContextMenu = true,
}: BlockMenuProps) {
  const [open, setOpen] = useState(false);
  // 右键打开时以鼠标坐标为锚点；点击 gutter 按钮时为 null，用按钮本身做锚点
  const [point, setPoint] = useState<MenuPoint | null>(null);
  // 面板形态：空块点击 `+` 时为「插入到此处」，其余为类型转换面板
  const [hereMode, setHereMode] = useState(false);
  // 「在下方插入」子菜单
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const submenuTimer = useRef<number | null>(null);
  // gutter portal 位置 + 可见性（portal 到 body 避免侧边栏裁剪）
  const [gutterVisible, setGutterVisible] = useState(false);
  const [blockHover, setBlockHover] = useState(false);
  const [gutterPos, setGutterPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const gutterCloseTimer = useRef<number | null>(null);
  // 「在下方插入」子菜单：作为**独立浮层**弹出，定位所需 ref/state
  const insertTriggerRef = useRef<HTMLButtonElement | null>(null);
  const insertSubmenuRef = useRef<HTMLDivElement | null>(null);
  const [insertSubmenuPos, setInsertSubmenuPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const { ref: panelRef, position, recompute } = useMenuPosition(triggerRef, open, point);

  // 尺寸选择器内嵌展开/收起会改变面板高度：重测尺寸让 useMenuPosition 重新夹紧进视口
  useLayoutEffect(() => {
    recompute();
  }, [tableOpen, recompute]);

  const isEmpty = block.kind === 'blank' || block.expectedText.trim() === '';
  /** 空块且有插入回调时，gutter 渲染为 `+` */
  const canInsertHere = isEmpty && Boolean(onInsertHere);

  // open + selectionActive 传递到块根：open 时给 .mde-block 加 has-block-menu class 让 CSS 维持 gutter 可见
  useEffect(() => {
    const blockEl = anchorRef.current;
    if (!blockEl) return;
    blockEl.classList.toggle('has-block-menu', open);
    blockEl.classList.toggle('has-selection', Boolean(selectionActive));
  }, [open, selectionActive, anchorRef]);

  // gutter 可见性判定：open 强制可见，否则块 hover / gutter 自己 hover 都维持可见（两路 OR）
  // 加上 selectionActive 抑制（InlineToolbar 显示时隐藏）
  const shouldShowGutter =
    (open || blockHover || gutterVisible) && !selectionActive;

  // gutter 位置计算 + scroll/resize 实时更新（portal 到 body，fixed 定位）
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const compute = () => {
      if (!shouldShowGutter) {
        setGutterPos(null);
        return;
      }
      const rect = anchor.getBoundingClientRect();
      // 定位到块左边界外 40px，顶部对齐块顶 + 1px
      setGutterPos({ top: rect.top + 1, left: rect.left - 40 });
    };
    compute();
    // shouldShowGutter 变化时重新计算（块进入/退出 viewport 时）
    if (shouldShowGutter) {
      window.addEventListener('scroll', compute, true);
      window.addEventListener('resize', compute);
      return () => {
        window.removeEventListener('scroll', compute, true);
        window.removeEventListener('resize', compute);
      };
    }
  }, [shouldShowGutter, anchorRef]);

  const cancelGutterClose = useCallback(() => {
    if (gutterCloseTimer.current !== null) {
      window.clearTimeout(gutterCloseTimer.current);
      gutterCloseTimer.current = null;
    }
  }, []);

  const scheduleGutterClose = useCallback(() => {
    cancelGutterClose();
    gutterCloseTimer.current = window.setTimeout(() => {
      gutterCloseTimer.current = null;
      setBlockHover(false);
      setGutterVisible(false);
    }, 350);
  }, [cancelGutterClose]);

  // anchorRef（块根）hover：块 hover 立即可见，leave 时 350ms 缓冲给指针抵达 gutter
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const onEnter = () => {
      cancelGutterClose();
      setBlockHover(true);
    };
    const onLeave = () => scheduleGutterClose();
    anchor.addEventListener('mouseenter', onEnter);
    anchor.addEventListener('mouseleave', onLeave);
    return () => {
      anchor.removeEventListener('mouseenter', onEnter);
      anchor.removeEventListener('mouseleave', onLeave);
    };
  }, [anchorRef, cancelGutterClose, scheduleGutterClose]);

  // 卸载时清理 close 定时器
  useEffect(() => cancelGutterClose, [cancelGutterClose]);

  const clearSubmenuTimer = useCallback(() => {
    if (submenuTimer.current !== null) {
      window.clearTimeout(submenuTimer.current);
      submenuTimer.current = null;
    }
  }, []);

  useEffect(() => clearSubmenuTimer, [clearSubmenuTimer]);

  const openAtButton = useCallback(() => {
    setPoint(null);
    if (canInsertHere) {
      setHereMode(true);
      setSubmenuOpen(false);
      setOpen(true);
      return;
    }
    setHereMode(false);
    setOpen((v) => !v);
  }, [canInsertHere]);

  const close = useCallback(() => {
    setOpen(false);
    setSubmenuOpen(false);
    setTableOpen(false);
    clearSubmenuTimer();
  }, [clearSubmenuTimer]);

  // ref 对象 identity 恒定，故依赖写全也不会导致 useMemo 重算
  const dismissRefs = useMemo(() => [panelRef, triggerRef], [panelRef, triggerRef]);
  useDismiss(open, close, dismissRefs);

  // 右键接管：在所属块上监听，打开同一个块菜单（锚点 = 鼠标位置）
  useEffect(() => {
    if (!enableContextMenu) return;
    const blockElement = anchorRef.current;
    if (!blockElement) return;
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      setPoint({ x: event.clientX, y: event.clientY });
      setHereMode(canInsertHere);
      setSubmenuOpen(false);
      setOpen(true);
    };
    blockElement.addEventListener('contextmenu', onContextMenu);
    return () => blockElement.removeEventListener('contextmenu', onContextMenu);
  }, [enableContextMenu, canInsertHere, anchorRef]);

  const handleConvert = useCallback(
    (kind: ConvertKind) => {
      if (onConvert(kind) !== false) setOpen(false);
    },
    [onConvert],
  );

  const handleInsert = useCallback(
    (kind: ConvertKind, below: boolean) => {
      // patch 被拒（文档已变化）时保持菜单打开：菜单无条件关闭会让操作看起来"点了没反应"
      const ok = below ? onInsertBelow?.(kind) : onInsertHere?.(kind);
      if (ok !== false) close();
    },
    [onInsertBelow, onInsertHere, close],
  );

  const openSubmenu = useCallback(() => {
    clearSubmenuTimer();
    setSubmenuOpen(true);
  }, [clearSubmenuTimer]);

  const scheduleSubmenuClose = useCallback(() => {
    // 表格尺寸选择器展开期间保持子菜单打开（含键盘焦点移动场景），由外部点击/Escape 关闭
    if (tableOpen) return;
    clearSubmenuTimer();
    submenuTimer.current = window.setTimeout(() => {
      setSubmenuOpen(false);
      setTableOpen(false);
      submenuTimer.current = null;
    }, SUBMENU_CLOSE_DELAY);
  }, [clearSubmenuTimer, tableOpen]);

  // 「在下方插入」子菜单：作为**独立浮层**弹出。
  // 以面板右侧优先定位到其旁侧，放不下则翻到左侧，最后夹紧进视口。
  useLayoutEffect(() => {
    if (
      !submenuOpen ||
      !panelRef.current ||
      !insertTriggerRef.current ||
      !insertSubmenuRef.current
    ) {
      setInsertSubmenuPos(null);
      return;
    }
    const menuBox = panelRef.current.getBoundingClientRect();
    const triggerBox = insertTriggerRef.current.getBoundingClientRect();
    const subBox = insertSubmenuRef.current.getBoundingClientRect();
    const edge = 12;
    const gap = 2;
    const rightSide = menuBox.right + gap;
    const leftSide = menuBox.left - subBox.width - gap;
    const left =
      rightSide + subBox.width <= window.innerWidth - edge
        ? rightSide
        : Math.max(edge, leftSide);
    const top = Math.min(
      Math.max(edge, triggerBox.top),
      Math.max(edge, window.innerHeight - subBox.height - edge),
    );
    setInsertSubmenuPos({ left, top });
    // tableOpen 变化时以展开/收起后的实际高度重新夹紧，避免底部被视口裁剪
  }, [submenuOpen, tableOpen, open, panelRef]);

  const currentKind = currentConvertKind(block);
  const currentTypeLabel = hereMode ? null : blockToken(block);

  return (
    <>
      {/* gutter portal 到 body 避免侧边栏裁剪；fixed 定位跟随 viewport 实时更新 */}
      {shouldShowGutter && gutterPos
        ? createPortal(
            <div
              className="mde-gutter mde-portal"
              contentEditable={false}
              style={{ top: gutterPos.top, left: gutterPos.left }}
              onMouseEnter={() => {
                cancelGutterClose();
                setGutterVisible(true);
              }}
              onMouseLeave={() => scheduleGutterClose()}
            >
              <button
                ref={triggerRef}
                type="button"
                className={open ? 'mde-gutter-btn is-open' : 'mde-gutter-btn'}
                aria-label={
                  canInsertHere
                    ? '插入块'
                    : `块菜单（当前：${blockToken(block)}）`
                }
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={openAtButton}
                onMouseDown={(e) => e.preventDefault()}
              >
                {canInsertHere ? (
                  <Plus size={14} />
                ) : (
                  <span className="mde-gutter-token">{blockToken(block)}</span>
                )}
              </button>
            </div>,
            document.body,
          )
        : null}

      {open
        ? createPortal(
            <div
              ref={panelRef}
              className={`mde-block-panel mde-portal mde-block-command-menu ${
                hereMode ? 'is-insert-mode' : 'is-content-mode'
              }`}
              role="menu"
              aria-label={hereMode ? '插入块' : '块菜单'}
              onMouseEnter={() => cancelGutterClose()}
              onMouseLeave={() => scheduleGutterClose()}
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
              }}
            >
              {/* 顶部标题栏：sticky，左标题 + 右当前类型标记 */}
              <header className="mde-panel-heading">
                <span>{hereMode ? '插入块' : '块菜单'}</span>
                <strong>{hereMode ? '+' : currentTypeLabel ?? '段落'}</strong>
              </header>

              {hereMode ? (
                // —————— 空块/插入模式 ——————
                <>
                  <div className="mde-command-group">
                    <span className="mde-command-group-label">块类型</span>
                    <TypeGrid onPick={(kind) => handleInsert(kind, false)} />
                  </div>
                  {onInsertTable || onInsertImage ? (
                    <div className="mde-command-group">
                      <span className="mde-command-group-label">插入</span>
                      <CommonInsertGrid
                        below={false}
                        tableOpen={tableOpen}
                        onToggleTable={() => setTableOpen((v) => !v)}
                        onInsertTable={onInsertTable}
                        onInsertDivider={onInsertDivider}
                        onInsertMeetingNotes={onInsertMeetingNotes}
                        onInsertImage={onInsertImage}
                        onDone={close}
                      />
                    </div>
                  ) : null}
                  {tableOpen && onInsertTable ? (
                    // 尺寸选择器内嵌在面板内展开，不做独立浮层（避免 hover 链断裂与层级遮挡）
                    <TablePicker
                      onPick={(rows, cols) => {
                        if (onInsertTable(rows, cols, false)) close();
                      }}
                      onClose={() => setTableOpen(false)}
                    />
                  ) : null}
                </>
              ) : (
                // —————— 非空块/转换模式 ——————
                <>
                  <div className="mde-command-group">
                    <span className="mde-command-group-label">块类型</span>
                    <TypeGrid
                      onPick={handleConvert}
                      currentKind={currentKind}
                    />
                  </div>

                  {(onDuplicate || onDelete) ? (
                    <div className="mde-command-group">
                      <span className="mde-command-group-label">块操作</span>
                      <div className="mde-action-group">
                        {onDuplicate ? (
                          <button
                            type="button"
                            className="mde-action-item"
                            onClick={() => {
                              if (onDuplicate() !== false) close();
                            }}
                          >
                            <Copy size={14} />
                            复制块
                          </button>
                        ) : null}
                        {onDelete ? (
                          <button
                            type="button"
                            className="mde-action-item is-destructive"
                            onClick={() => {
                              if (onDelete() !== false) close();
                            }}
                          >
                            <Trash2 size={14} />
                            删除块
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {onInsertBelow ? (
                    <div
                      className="mde-command-group mde-insert-below-group"
                      onBlurCapture={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) {
                          scheduleSubmenuClose();
                        }
                      }}
                      onFocusCapture={openSubmenu}
                      onMouseEnter={openSubmenu}
                      onMouseLeave={scheduleSubmenuClose}
                    >
                      <button
                        ref={insertTriggerRef}
                        type="button"
                        role="menuitem"
                        aria-haspopup="menu"
                        aria-expanded={submenuOpen}
                        className={
                          submenuOpen
                            ? 'mde-insert-trigger is-open'
                            : 'mde-insert-trigger'
                        }
                        onClick={() => setSubmenuOpen((v) => !v)}
                      >
                        <Plus size={14} />
                        <span>在下方插入</span>
                        <ChevronRight size={14} />
                      </button>
                      {submenuOpen ? (
                        <div
                          ref={insertSubmenuRef}
                          className={
                            insertSubmenuPos
                              ? 'mde-insert-submenu is-open'
                              : 'mde-insert-submenu is-positioning'
                          }
                          style={insertSubmenuPos ?? undefined}
                          role="menu"
                          aria-label="在下方插入"
                          onMouseEnter={openSubmenu}
                          onMouseLeave={scheduleSubmenuClose}
                        >
                          <TypeGrid
                            compact
                            onPick={(kind) => handleInsert(kind, true)}
                          />
                          {/* 在下方插入：额外追加表格/分割线/会议记录/图片 */}
                          <CommonInsertGrid
                            keyPrefix="s-"
                            below
                            style={{ marginTop: 6 }}
                            tableOpen={tableOpen}
                            onToggleTable={() => setTableOpen((v) => !v)}
                            onInsertTable={onInsertTable}
                            onInsertDivider={onInsertDivider}
                            onInsertMeetingNotes={onInsertMeetingNotes}
                            onInsertImage={onInsertImage}
                            onDone={close}
                          />
                          {tableOpen && onInsertTable ? (
                            <TablePicker
                              onPick={(rows, cols) => {
                                if (onInsertTable(rows, cols, true)) close();
                              }}
                              onClose={() => setTableOpen(false)}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default BlockMenu;
