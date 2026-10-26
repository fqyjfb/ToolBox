import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  DragMoveEvent,
  DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { Trash2, ExternalLink, Copy, X, Plus, Minus, Cloud, Edit } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import { WEATHER_TOOL_ID, ADDABLE_TOOL_IDS, type HomeToolItem, type AddableToolId } from '../../utils/homeTools';
import { STORAGE_KEYS } from '../../services/localStorageService';
import { useHomeToolsStore } from '../../store/homeToolsStore';
import { useAuthStore } from '../../store/AuthStore';
import { loadHomeBookmarks, removeHomeBookmark, type HomeBookmark } from '../../utils/homeBookmarks';
import { loadHomeCardOrder } from '../../utils/homeCardOrder';
import {
  applyMove,
  loadHomeCardLayout,
  reconcileLayout,
  saveHomeCardLayout,
  sortIdsByPosition,
  type Cell,
  type HomeCardLayout,
} from '../../utils/homeCardLayout';
import { isElectron } from '../../utils/environment';
import { openUrl } from '../../services/browserService';
import { useToastStore } from '../../store/toastStore';
import { logError } from '../../services/loggerService';
import { useDndSensors } from '../../hooks/useDndSensors';
import { useHoverTooltip } from '../../hooks/useHoverTooltip';
import { DISPLAY_LIMITS } from '../../constants/timers';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import SearchBar from '../../components/home/SearchBar';
import HomeClock from '../../components/home/HomeClock';
import FavoriteCard from '../../components/home/FavoriteCard';
import ToolCard from '../../components/home/ToolCard';
import NewsContainer from '../../components/home/NewsContainer';
import HomeBookmarkCard from '../../components/home/HomeBookmarkCard';
import { QuickLaunchIcon } from '../../components/home/QuickLaunchBar';
import WeatherCard from '../../components/home/WeatherCard';
import IconCard from '../../components/home/IconCard';
import SortableCard from '../../components/home/SortableCard';
import MoyuCard, { type MoyuVariant } from '../../components/home/MoyuCard';
import ExpandedToolCard from '../../components/home/ExpandedToolCard';
import ExpandedToolPreviewModal from '../../components/home/ExpandedToolPreviewModal';
import HomeToolAddModal from '../../components/home/HomeToolAddModal';
import type { PreviewItem } from '../../components/home/ExpandedToolCard';
import { todoServiceWrapper } from '../../services/TodoService';
import { memoService } from '../../services/MemoService';
import { reminderService } from '../../services/ReminderService';
import { quickReplyService } from '../../services/QuickReplyService';
import { clipboardService } from '../../services/ClipboardService';
import type { Todo } from '../../types/todo';
import type { Memo } from '../../types/memo';
import type { Reminder } from '../../types/reminder';
import type { QuickReply } from '../../types/quickReply';
import type { ClipboardItem } from '../../types/clipboard';
import { useHomeFavorites } from '../../hooks/useHomeFavorites';
import { useHomeQuickLaunch } from '../../hooks/useHomeQuickLaunch';
import type { QuickLaunchItem } from '../../utils/quickLaunch';
import type { MoyuData } from '../../types/hotNews';
import type { Bookmark } from '../../types/website';
import '../../components/home/HomeCards.css';
import './Home.css';

// 网格基准：1 单元 = 一个快启动图标卡片，行高与列宽始终相等，卡片不会变形
const GRID_GAP = 8;
const TARGET_UNIT = 48;
const MAX_UNIT = 48;
const MIN_UNIT = 36;
const MIN_COLUMNS = 4;
const MAX_COLUMNS = 32;
// 卡片让位的位移动画（FLIP），与松手落位的手感保持一致
const LAYOUT_TRANSITION_MS = 160;
// 减速曲线：起步快、落位轻，比 ease 更接近桌面图标的手感
const LAYOUT_TRANSITION_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
// 落点迟滞：指针要越过格子边界一定比例才换格，避免停在边界上来回抖动
const SNAP_HYSTERESIS = 0.2;
// 有预览数据时按「2 倍宽 × 3 行」展示的扩展工具；工具 id 的合法值由 ADDABLE_TOOL_IDS 派生
const isAddableToolId = (id: string): id is AddableToolId =>
  (ADDABLE_TOOL_IDS as readonly string[]).includes(id);

/** 各工具一条数据的称呼，用于新增 / 删除菜单与提示文案 */
const TOOL_ITEM_LABEL: Record<AddableToolId, string> = {
  todo: '任务',
  memo: '备忘录',
  reminder: '提醒',
  'quick-reply': '快捷回复',
  'cloud-clipboard': '项目',
};

interface BaseCard {
  id: string;
  colSpan: number;
  rowSpan: number;
}

type HomeCard =
  | (BaseCard & { type: 'news' })
  | (BaseCard & { type: 'moyu'; variant: MoyuVariant })
  | (BaseCard & { type: 'tool'; tool: HomeToolItem })
  | (BaseCard & { type: 'quicklaunch'; app: QuickLaunchItem })
  | (BaseCard & { type: 'bookmark'; bookmark: HomeBookmark })
  | (BaseCard & { type: 'favorite'; favorite: Bookmark });

interface GridMetrics {
  columns: number;
  unit: number;
}

// 先按目标单元尺寸算出能放下多少列，再反推单元尺寸：单元恒等于 TARGET_UNIT（除非窄到放不下），
// 列数随宽度增长，因此宽屏也能填满，不会在两侧留大片空白
const measureGrid = (width: number): GridMetrics => {
  const fitted = Math.floor((width + GRID_GAP) / (TARGET_UNIT + GRID_GAP));
  const columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, fitted));
  const unit = Math.floor(Math.min(MAX_UNIT, (width - (columns - 1) * GRID_GAP) / columns));
  return { columns, unit: Math.max(MIN_UNIT, unit) };
};

// 键盘拖拽：一次方向键移动一个网格单元，配合坐标吸附实现格子级搬运
const gridKeyboardCoordinates = (step: number): KeyboardCoordinateGetter =>
  (event, { currentCoordinates }) => {
    const offset = { x: 0, y: 0 };
    switch (event.code) {
      case 'ArrowRight': offset.x = step; break;
      case 'ArrowLeft': offset.x = -step; break;
      case 'ArrowDown': offset.y = step; break;
      case 'ArrowUp': offset.y = -step; break;
      default: return undefined;
    }
    return { x: currentCoordinates.x + offset.x, y: currentCoordinates.y + offset.y };
  };

const clampIndex = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

// 单轴吸附：previous 是上一次落点，指针没有明确进入新格子时就保持不变（迟滞）
const snapAxis = (raw: number, previous: number | undefined, min: number, max: number): number => {
  const nearest = clampIndex(Math.round(raw), min, max);
  if (previous === undefined || nearest === previous) return nearest;
  if (Math.abs(raw - previous) < 0.5 + SNAP_HYSTERESIS) return clampIndex(previous, min, max);
  return nearest;
};

// 浮层当前矩形 → 最近的网格单元（0-based 左上角）：拖到哪就吸附到哪
const snapToCell = (
  rect: { left: number; top: number },
  box: { left: number; top: number; width: number },
  grid: GridMetrics,
  colSpan: number,
  maxRow: number,
  previous?: Cell,
): Cell => {
  const trackWidth = grid.columns * grid.unit + (grid.columns - 1) * GRID_GAP;
  // justify-content: center —— 轨道总宽小于容器时整体居中，需要补上左侧留白
  const originLeft = box.left + (box.width - trackWidth) / 2;
  const step = grid.unit + GRID_GAP;
  return {
    col: snapAxis((rect.left - originLeft) / step, previous?.col, 0, grid.columns - colSpan),
    row: snapAxis((rect.top - box.top) / step, previous?.row, 0, maxRow),
  };
};

const Home: React.FC = () => {
  const isDesktop = isElectron();
  const user = useAuthStore(state => state.user);
  const userId = user?.id ?? '';

  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [sixtySecondsLoading, setSixtySecondsLoading] = useState(false);
  const [sixtySecondsError, setSixtySecondsError] = useState('');

  const [moyuData, setMoyuData] = useState<MoyuData | null>(null);
  const [moyuLoading, setMoyuLoading] = useState(true);
  const [moyuError, setMoyuError] = useState('');

  const [previewData, setPreviewData] = useState<Record<string, { items: PreviewItem[]; total: number }>>({});
  const [previewItem, setPreviewItem] = useState<{ toolName: string; item: PreviewItem } | null>(null);
  // 当前打开的新增弹窗对应的工具
  const [addToolId, setAddToolId] = useState<AddableToolId | null>(null);
  // 当前打开的编辑弹窗对应的工具与条目（来自卡片数据行右键的「编辑」）
  const [editingItem, setEditingItem] = useState<{ toolId: AddableToolId; item: PreviewItem } | null>(null);

  const { favorites } = useHomeFavorites();
  const { apps: homeQuickLaunchApps, launchApp: handleLaunchApp, removeApp: handleRemoveHomeQuickLaunch } = useHomeQuickLaunch();

  const [homeBookmarks, setHomeBookmarks] = useState<HomeBookmark[]>([]);
  const homeTools = useHomeToolsStore(state => state.homeTools);
  const removeHomeTool = useHomeToolsStore(state => state.removeTool);
  const hydrateHomeTools = useHomeToolsStore(state => state.hydrate);

  // 卡片坐标布局（HOME_CARD_LAYOUT）；首次进入为空，按老顺序 / 数据源顺序打包出初始坐标
  const [layout, setLayout] = useState<HomeCardLayout>(loadHomeCardLayout);
  const [grid, setGrid] = useState<GridMetrics>({ columns: MIN_COLUMNS, unit: MIN_UNIT });
  const [activeId, setActiveId] = useState<string | null>(null);
  // 拖拽中的预览布局（所见即所得）；null 表示未拖拽或尚未产生位移
  const [previewLayout, setPreviewLayout] = useState<HomeCardLayout | null>(null);
  // 老版本只存顺序：作为一次性迁移输入，迁移完成后布局以坐标为准
  const legacyOrder = useMemo(() => loadHomeCardOrder(), []);
  // itemId / toolId：右键命中卡片内某条预览数据时携带，用于该条数据的「新增 / 编辑 / 删除」
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    cardId: string | null;
    itemId: string | null;
    toolId: AddableToolId | null;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    cardId: null,
    itemId: null,
    toolId: null,
  });

  const gridRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const addToast = useToastStore(state => state.addToast);
  const sensors = useDndSensors(gridKeyboardCoordinates(grid.unit + GRID_GAP));
  const { tooltipNode, showTooltip, hideTooltip } = useHoverTooltip();

  const searchTypes = [
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd=%s%', placeholder: '百度一下' },
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s%', placeholder: 'Google搜索' },
    { id: '360', name: '360', url: 'https://www.so.com/s?q=%s%', placeholder: '360搜索' },
    { id: 'sogou', name: '搜狗', url: 'https://www.sogou.com/web?query=%s%', placeholder: '搜狗搜索' },
    { id: 'bing', name: 'Bing', url: 'https://cn.bing.com/search?q=%s%', placeholder: 'Bing搜索' },
    { id: 'shenma', name: '神马', url: 'https://yz.m.sm.cn/s?q=%s%', placeholder: '神马搜索' }
  ];

  // forceRefresh 仅用于用户主动重试/刷新；首次进入走 cacheService 的缓存，避免每次
  // 回到首页都打网络并闪一次 loading
  const fetchSixtySeconds = useCallback(async (forceRefresh = false) => {
    setSixtySecondsLoading(true);
    setSixtySecondsError('');

    try {
      const data = await hotNewsApi.getSixtySecondsData({ forceRefresh });
      if (data) {
        setSixtySecondsData(data.data.news);
      } else {
        setSixtySecondsError('获取数据失败，请稍后重试');
      }
    } catch {
      setSixtySecondsError('网络错误，请检查网络连接后重试');
    } finally {
      setSixtySecondsLoading(false);
    }
  }, []);

  const handleRetrySixtySeconds = useCallback(() => {
    void fetchSixtySeconds(true);
  }, [fetchSixtySeconds]);

  // 摸鱼数据统一在首页拉一次，三张摸鱼卡片共用，避免重复请求
  const fetchMoyuData = useCallback(async () => {
    setMoyuLoading(true);
    setMoyuError('');
    try {
      const data = await hotNewsApi.getMoyuData();
      if (data?.data) {
        setMoyuData(data.data);
      } else {
        setMoyuError('获取数据失败');
      }
    } catch {
      setMoyuError('网络错误');
    } finally {
      setMoyuLoading(false);
    }
  }, []);

  const fetchHomeBookmarks = useCallback(async () => {
    setHomeBookmarks(await loadHomeBookmarks());
  }, []);

  const handleRemoveHomeBookmark = useCallback(async (id: string) => {
    setHomeBookmarks(prev => prev.filter(bookmark => bookmark.id !== id));
    await removeHomeBookmark(id);
  }, []);

  const navigateToTool = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  useEffect(() => {
    fetchSixtySeconds();
    void fetchMoyuData();
    if (isDesktop) {
      void fetchHomeBookmarks();
    }
  }, [fetchSixtySeconds, fetchMoyuData, fetchHomeBookmarks, isDesktop]);

  // 插件窗口改动首页网址后，回到主窗口即刷新
  useEffect(() => {
    if (!isDesktop) return;
    const handleFocus = () => { void fetchHomeBookmarks(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchHomeBookmarks, isDesktop]);

  // 扩展卡片数据：加载各功能最近条目用于预览（新增成功后复用同一份逻辑刷新）
  const fetchPreview = useCallback(async () => {
    if (!isDesktop || !userId) return;
    const next: typeof previewData = {};
    try {
      const [todoRes, memoRes, reminderRes, quickReplyRes, clipboardRes] = await Promise.all([
        todoServiceWrapper.todo.getTodos(userId, { is_completed: false }, 1, 10),
        memoService.getMemos(userId, undefined, 1, 10),
        reminderService.getReminders(userId),
        quickReplyService.getQuickReplies(userId, undefined, 1, 10),
        clipboardService.getItems(userId, undefined, 1, 10),
      ]);
      next['tool-todo'] = { items: ((todoRes.data?.data) ?? []).slice(0, 6).map((t: Todo) => ({
        id: t.id, title: t.title, subtitle: t.status, detail: t.description ?? undefined, type: 'todo' as const, raw: t,
      })), total: todoRes.data?.total ?? 0 };
      next['tool-memo'] = { items: (memoRes.list ?? []).slice(0, 6).map((m: Memo) => ({
        id: m.id, title: m.title, detail: m.content || undefined, type: 'memo' as const, raw: m,
      })), total: memoRes.total ?? 0 };
      next['tool-reminder'] = { items: (reminderRes.data ?? []).slice(0, 6).map((r: Reminder) => ({
        id: r.id, title: r.title, subtitle: r.remind_time ? new Date(r.remind_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined, detail: r.content || undefined, type: 'reminder' as const, raw: r,
      })), total: reminderRes.data?.length ?? 0 };
      next['tool-quick-reply'] = { items: (quickReplyRes.list ?? []).slice(0, 6).map((q: QuickReply) => ({
        id: q.id, title: q.content, subtitle: q.category?.name, type: 'quick-reply' as const, raw: q,
      })), total: quickReplyRes.total ?? 0 };
      next['tool-cloud-clipboard'] = { items: (clipboardRes.list ?? []).slice(0, 6).map((c: ClipboardItem) => ({
        id: c.id, title: c.content, subtitle: c.category?.name, type: 'clipboard' as const, raw: c,
      })), total: clipboardRes.total ?? 0 };
    } catch {
      // 静默失败：按无数据处理，卡片回落常规尺寸
      for (const id of ADDABLE_TOOL_IDS) next[`tool-${id}`] = { items: [], total: 0 };
    }
    setPreviewData(next);
  }, [isDesktop, userId]);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const toggleTodo = useCallback(async (itemId: string) => {
    if (!userId) return;
    // 预览弹窗内的条目可能已被移出卡片列表（标记完成即移除），优先取弹窗自身的状态
    const current = previewItem?.item.id === itemId
      ? previewItem.item
      : previewData['tool-todo']?.items.find(i => i.id === itemId);
    if (!current) return;
    const nextCompleted = current.subtitle !== '已完成';
    await todoServiceWrapper.todo.updateTodoStatus(userId, itemId, nextCompleted);
    setPreviewData(prev => {
      const entry = prev['tool-todo'] ?? { items: [], total: 0 };
      if (nextCompleted) {
        // 卡片只展示待办：标记完成后立即移出列表，数量同步减一
        return {
          ...prev,
          ['tool-todo']: { items: entry.items.filter(i => i.id !== itemId), total: Math.max(0, entry.total - 1) },
        };
      }
      const items = entry.items.some(i => i.id === itemId)
        ? entry.items.map(i => (i.id === itemId ? { ...i, subtitle: '待办' } : i))
        : [{ ...current, subtitle: '待办' }, ...entry.items].slice(0, 6);
      return { ...prev, ['tool-todo']: { items, total: entry.total + 1 } };
    });
    if (previewItem?.item.id === itemId) {
      setPreviewItem(prev => prev ? { ...prev, item: { ...prev.item, subtitle: nextCompleted ? '已完成' : '待办' } } : null);
    }
  }, [userId, previewData, previewItem]);

  // 挂载时对齐一次磁盘（插件窗口改动过首页工具），并跟随其它窗口的改动
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.HOME_TOOLS) {
        hydrateHomeTools();
      }
    };

    hydrateHomeTools();
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [hydrateHomeTools]);

  // 列数随可用宽度自适应，单元尺寸锁定在 [MIN_UNIT, MAX_UNIT]，卡片始终保持方形比例
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      const next = measureGrid(width);
      setGrid(prev => (prev.columns === next.columns && prev.unit === next.unit ? prev : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 扩展工具只有在「已加载且有内容」时才占用扩展尺寸；无数据时回落到常规工具卡尺寸，
  // 未加载（undefined）仍保持扩展尺寸，避免数据到达时整页抖动
  const expandedToolIds = useMemo(() => {
    if (!isDesktop || !userId) return new Set<string>();
    return new Set(
      ADDABLE_TOOL_IDS.filter(id => (previewData[`tool-${id}`]?.items.length ?? -1) !== 0)
    );
  }, [isDesktop, userId, previewData]);

  // 所有元素（新闻 / 摸鱼 / 工具 / 快启动 / 网址收藏 / 网页收藏）都是独立卡片。
  // 天气卡不再写死在这里，它由首页工具列表里的「天气预报」驱动，与工具中心联动
  const cards = useMemo<HomeCard[]>(() => {
    const list: HomeCard[] = [
      { id: 'news', type: 'news', colSpan: 6, rowSpan: 5 },
      { id: 'moyu-calendar', type: 'moyu', variant: 'calendar', colSpan: 2, rowSpan: 3 },
      { id: 'moyu-holiday', type: 'moyu', variant: 'holiday', colSpan: 2, rowSpan: 3 },
      { id: 'moyu-quote', type: 'moyu', variant: 'quote', colSpan: 2, rowSpan: 2 },
      { id: 'moyu-progress', type: 'moyu', variant: 'progress', colSpan: 2, rowSpan: 2 },
      { id: 'moyu-countdown', type: 'moyu', variant: 'countdown', colSpan: 2, rowSpan: 2 },
    ];

    homeTools.forEach(tool => {
      const isExpanded = expandedToolIds.has(tool.id);
      list.push({ id: `tool-${tool.id}`, type: 'tool', tool, colSpan: isExpanded ? 4 : 2, rowSpan: isExpanded ? 3 : 2 });
    });
    homeQuickLaunchApps.forEach(app => {
      list.push({ id: `ql-${app.id}`, type: 'quicklaunch', app, colSpan: 1, rowSpan: 1 });
    });
    homeBookmarks.forEach(bookmark => {
      list.push({ id: `bm-${bookmark.id}`, type: 'bookmark', bookmark, colSpan: 1, rowSpan: 1 });
    });
    favorites.slice(0, DISPLAY_LIMITS.FAVORITES).forEach(favorite => {
      list.push({ id: `fav-${favorite.id}`, type: 'favorite', favorite, colSpan: 1, rowSpan: 1 });
    });

    return list;
  }, [homeTools, homeQuickLaunchApps, homeBookmarks, favorites, expandedToolIds]);

  const cardMap = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards]);

  // 顶部时钟的农历文案复用摸鱼日报数据，避免再引一套农历库
  const moyuLunar = useMemo(() => {
    const lunar = moyuData?.date.lunar;
    return lunar ? `${lunar.monthCN}${lunar.dayCN}` : undefined;
  }, [moyuData]);

  // 坐标布局：持久化坐标 + 当前卡片 + 当前列数 → 一份可直接渲染的完整布局
  // （剔除失效 id、夹紧越界列、新增卡片补位、冲突就近让位）
  const renderLayout = useMemo(
    () => reconcileLayout(cards, legacyOrder, layout, grid.columns),
    [cards, legacyOrder, layout, grid.columns]
  );

  // 拖拽中直接渲染预览布局（所见即所得）。预览同样走一次收敛，保证卡片在拖拽中
  // 增删（数据刷新）也不会漏渲染或残留失效 id
  const activeLayout = useMemo(
    () => (previewLayout ? reconcileLayout(cards, legacyOrder, previewLayout, grid.columns) : renderLayout),
    [previewLayout, cards, legacyOrder, grid.columns, renderLayout]
  );

  // DOM 顺序跟随坐标：Tab 焦点顺序与视觉阅读顺序保持一致
  const displayIds = useMemo(() => sortIdsByPosition(activeLayout), [activeLayout]);

  const displayCards = useMemo(
    () => displayIds.map(id => cardMap.get(id)).filter((card): card is HomeCard => !!card),
    [displayIds, cardMap]
  );

  // 拖拽浮层渲染的卡片内容
  const activeCard = useMemo(
    () => (activeId ? displayCards.find(card => card.id === activeId) ?? null : null),
    [activeId, displayCards]
  );

  // 落点的行上界：已用行数 + 一个最高卡片，避免误拖撑出大片空白
  const maxDropRow = useMemo(() => {
    const maxRowSpan = cards.reduce((max, card) => Math.max(max, card.rowSpan), 1);
    let bottom = 0;
    for (const [id, cell] of Object.entries(activeLayout)) {
      const card = cardMap.get(id);
      if (card) bottom = Math.max(bottom, cell.row + card.rowSpan);
    }
    return bottom + maxRowSpan;
  }, [activeLayout, cards, cardMap]);

  // 重排位移动画（FLIP）：把「卡片瞬间换格」补成平滑位移。
  // 变换只写在卡片内层，网格单元自身不带 transform，读取到的始终是准确位置
  const animateLayoutRef = useRef(false);
  const slotPositionsRef = useRef(new Map<string, { left: number; top: number }>());

  useLayoutEffect(() => {
    const container = gridRef.current;
    if (!container) return;

    const shouldAnimate = animateLayoutRef.current;
    animateLayoutRef.current = false;

    const previous = slotPositionsRef.current;
    const next = new Map<string, { left: number; top: number }>();
    const moved: HTMLElement[] = [];

    for (const slot of Array.from(container.querySelectorAll<HTMLElement>('.home-sortable'))) {
      const id = slot.dataset.cardId;
      if (!id) continue;

      // offsetLeft/offsetTop 不受内层 transform 与页面滚动影响
      const position = { left: slot.offsetLeft, top: slot.offsetTop };
      next.set(id, position);

      const layer = slot.firstElementChild as HTMLElement | null;
      const old = previous.get(id);
      if (!shouldAnimate || !layer || !old) continue;

      const dx = old.left - position.left;
      const dy = old.top - position.top;
      if (!dx && !dy) continue;

      moved.push(layer);
      layer.style.transition = 'none';
      layer.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    }

    if (moved.length > 0) {
      // 一次强制回流，让「回到旧位置」成为动画起点，而不是直接跳到新位置
      void container.offsetHeight;
      for (const layer of moved) {
        layer.style.transition = `transform ${LAYOUT_TRANSITION_MS}ms ${LAYOUT_TRANSITION_EASING}`;
        layer.style.transform = '';
      }
    }

    slotPositionsRef.current = next;
  }, [activeLayout, displayIds]);

  // 落点以「单元格」为粒度：既是「同一格不重复计算」的依据，也是吸附迟滞的基准
  const dragTargetRef = useRef<Cell | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    dragTargetRef.current = null;
    hideTooltip();
  }, [hideTooltip]);

  // 自由布局靠指针吸附到单元格，不依赖投放目标，因此用每次移动都会触发的 onDragMove
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const container = gridRef.current;
    // translated = 起始矩形 + 指针位移，与容器当前的 getBoundingClientRect 同处
    // 视口坐标系，两者相减即为卡片在网格内容里的偏移（自动滚动时依然成立）
    const rect = event.active.rect.current.translated ?? event.active.rect.current.initial;
    const id = String(event.active.id);
    const card = cardMap.get(id);
    if (!container || !rect || !card) return;

    const target = snapToCell(
      rect,
      container.getBoundingClientRect(),
      grid,
      Math.min(card.colSpan, grid.columns),
      maxDropRow,
      dragTargetRef.current ?? undefined,
    );

    if (dragTargetRef.current?.col === target.col && dragTargetRef.current?.row === target.row) return;
    dragTargetRef.current = target;

    animateLayoutRef.current = true;
    setPreviewLayout(applyMove(activeLayout, cards, displayIds, id, target, grid.columns));
  }, [cardMap, grid, activeLayout, cards, displayIds, maxDropRow]);

  const handleDragEnd = useCallback(() => {
    const next = previewLayout;
    setActiveId(null);
    setPreviewLayout(null);
    dragTargetRef.current = null;
    animateLayoutRef.current = false;
    // 没产生过落点变化（例如原地按下又松开）时保持原布局
    if (next) {
      setLayout(next);
      saveHomeCardLayout(next);
    }
  }, [previewLayout]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setPreviewLayout(null);
    dragTargetRef.current = null;
    animateLayoutRef.current = false;
  }, []);

  const copyUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      addToast({ type: 'success', message: '网址已复制到剪贴板' });
    } catch {
      addToast({ type: 'error', message: '复制失败' });
    }
  }, [addToast]);

  const openContextMenu = useCallback((e: React.MouseEvent, cardId: string) => {
    const card = cardMap.get(cardId);
    // 仅工具 / 快启动 / 网址收藏带右键菜单，其余卡片保留系统菜单
    if (!card || (card.type !== 'tool' && card.type !== 'quicklaunch' && card.type !== 'bookmark')) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, cardId, itemId: null, toolId: null });
  }, [cardMap]);

  /** 卡片内某条预览数据的右键：stopPropagation 避免同时弹出卡片自身的菜单 */
  const openItemContextMenu = useCallback((e: React.MouseEvent, toolId: AddableToolId, item: PreviewItem) => {
    if (!userId) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, cardId: null, itemId: item.id, toolId });
  }, [userId]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false, cardId: null, itemId: null, toolId: null }));
  }, []);

  const { confirmDialog, handleOpenConfirmDialog, handleCloseConfirmDialog } = useConfirmDialog(closeContextMenu);

  /** 删除卡片数据行：与各工具页一样走同一个 service（提醒的删除会连带注销计划任务） */
  const handleDeleteItem = useCallback(async (toolId: AddableToolId, itemId: string) => {
    if (!userId) return;
    try {
      switch (toolId) {
        case 'todo':
          await todoServiceWrapper.todo.deleteTodo(userId, itemId);
          break;
        case 'memo':
          await memoService.deleteMemo(userId, itemId);
          break;
        case 'reminder':
          await reminderService.deleteReminder(userId, itemId);
          break;
        case 'quick-reply':
          await quickReplyService.deleteQuickReply(userId, itemId);
          break;
        case 'cloud-clipboard':
          await clipboardService.deleteItem(userId, itemId);
          break;
      }
      addToast({ type: 'success', message: `${TOOL_ITEM_LABEL[toolId]}已删除` });
      void fetchPreview();
    } catch (error) {
      logError('删除首页卡片条目失败', 'Home', error as Error);
      addToast({ type: 'error', message: '删除失败' });
    }
  }, [userId, addToast, fetchPreview]);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    // 卡片内某条数据右键：新增 / 编辑 / 删除，功能与各工具页内的一致
    if (contextMenu.itemId && contextMenu.toolId) {
      const toolId = contextMenu.toolId;
      const item = previewData[`tool-${toolId}`]?.items.find(i => i.id === contextMenu.itemId);
      if (!item) return [];
      return [
        {
          id: 'item-add',
          label: '新增',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => setAddToolId(toolId),
        },
        {
          id: 'item-edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => setEditingItem({ toolId, item }),
        },
        { id: 'item-divider', divider: true },
        {
          id: 'item-delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleOpenConfirmDialog(
            '删除确认',
            `确定要删除这条${TOOL_ITEM_LABEL[toolId]}吗？`,
            () => void handleDeleteItem(toolId, item.id),
          ),
        },
      ];
    }

    const card = contextMenu.cardId ? cardMap.get(contextMenu.cardId) : undefined;
    if (!card) return [];

    // 工具卡片：与工具中心共用同一份数据源，移出首页后工具中心的角标同步消失
    if (card.type === 'tool') {
      const toolId = card.tool.id;
      return [
        {
          id: 'open',
          label: '打开工具',
          icon: <ExternalLink className="w-4 h-4" />,
          onClick: () => navigateToTool(card.tool.path),
        },
        // 支持直接新增的工具：与卡片右上角「+」按钮走同一个入口
        ...(isAddableToolId(toolId) && userId
          ? [{
              id: 'add-item',
              label: `新增${TOOL_ITEM_LABEL[toolId]}`,
              icon: <Plus className="w-4 h-4" />,
              onClick: () => setAddToolId(toolId),
            }]
          : []),
        {
          id: 'add',
          label: '添加工具',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => {
            navigateToTool('/tools');
            addToast({ type: 'info', message: '在工具中心右键工具，选择「加入首页」' });
          },
        },
        { id: 'divider-tool', divider: true },
        {
          id: 'remove',
          label: '移出首页',
          icon: <Minus className="w-4 h-4" />,
          onClick: () => {
            removeHomeTool(card.tool.id);
            addToast({ type: 'success', message: `已将「${card.tool.name}」移出首页` });
          },
        },
      ];
    }

    if (card.type === 'quicklaunch') {
      return [
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleRemoveHomeQuickLaunch(card.app.id),
        },
      ];
    }

    if (card.type === 'bookmark') {
      const { bookmark } = card;
      return [
        {
          id: 'open',
          label: '打开',
          icon: <ExternalLink className="w-4 h-4" />,
          onClick: () => openUrl(bookmark.url),
        },
        {
          id: 'copy-url',
          label: '复制网址',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => void copyUrl(bookmark.url),
        },
        { id: 'divider1', divider: true },
        {
          id: 'remove',
          label: '从首页移除',
          icon: <X className="w-4 h-4" />,
          onClick: () => void handleRemoveHomeBookmark(bookmark.id),
        },
      ];
    }

    return [];
  }, [
    contextMenu.cardId, contextMenu.itemId, contextMenu.toolId, previewData, cardMap, copyUrl,
    navigateToTool, addToast, removeHomeTool, handleRemoveHomeQuickLaunch, handleRemoveHomeBookmark,
    userId, handleDeleteItem, handleOpenConfirmDialog,
  ]);

  const renderCardContent = (card: HomeCard) => {
    switch (card.type) {
      case 'news':
        return (
          <NewsContainer
            sixtySecondsLoading={sixtySecondsLoading}
            sixtySecondsError={sixtySecondsError}
            sixtySecondsData={sixtySecondsData}
            onRetrySixtySeconds={handleRetrySixtySeconds}
          />
        );
      case 'tool':
        // 天气工具在首页用专用天气卡展示（自带实时天气与悬浮详情），其余工具用通用工具卡
        if (card.tool.id === WEATHER_TOOL_ID) {
          return (
            <WeatherCard
              onClick={() => navigateToTool(card.tool.path)}
              onContextMenu={(e) => openContextMenu(e, card.id)}
            />
          );
        }
        const toolId = card.tool.id;
        if (isAddableToolId(toolId) && expandedToolIds.has(toolId)) {
          return (
            <ExpandedToolCard
              tool={card.tool}
              items={previewData[`tool-${toolId}`]?.items ?? []}
              totalCount={previewData[`tool-${toolId}`]?.total ?? 0}
              onClick={() => navigateToTool(card.tool.path)}
              onAdd={() => setAddToolId(toolId)}
              onItemTap={(item) => {
                setPreviewItem({ toolName: card.tool.name, item });
              }}
              onContextMenu={(e) => openContextMenu(e, card.id)}
              onItemContextMenu={(e, item) => openItemContextMenu(e, toolId, item)}
            />
          );
        }
        if (isAddableToolId(toolId)) {
          // 无数据时回落常规卡片尺寸；已登录时保留新增入口
          return (
            <ToolCard
              tool={card.tool}
              onClick={() => navigateToTool(card.tool.path)}
              onAdd={userId ? () => setAddToolId(toolId) : undefined}
              onContextMenu={(e) => openContextMenu(e, card.id)}
            />
          );
        }
        return (
          <ToolCard
            tool={card.tool}
            onClick={() => navigateToTool(card.tool.path)}
            onContextMenu={(e) => openContextMenu(e, card.id)}
          />
        );
      case 'moyu':
        return (
          <MoyuCard
            variant={card.variant}
            data={moyuData}
            loading={moyuLoading}
            error={moyuError}
            onRetry={() => void fetchMoyuData()}
          />
        );
      case 'quicklaunch':
        return (
          <IconCard
            icon={<QuickLaunchIcon app={card.app} className="home-icon-card__icon" />}
            onClick={() => handleLaunchApp(card.app.path)}
            onContextMenu={(e) => openContextMenu(e, card.id)}
            onMouseEnter={(e) => showTooltip(e, card.app.name)}
            onMouseLeave={hideTooltip}
          />
        );
      case 'bookmark':
        return (
          <HomeBookmarkCard
            bookmark={card.bookmark}
            onOpen={() => openUrl(card.bookmark.url)}
            onContextMenu={(e) => openContextMenu(e, card.id)}
            onMouseEnter={(e) => showTooltip(e, card.bookmark.title)}
            onMouseLeave={hideTooltip}
          />
        );
      case 'favorite':
        return (
          <FavoriteCard
            bookmark={card.favorite}
            onOpen={() => openUrl(card.favorite.url)}
            onMouseEnter={(e) => showTooltip(e, card.favorite.title)}
            onMouseLeave={hideTooltip}
          />
        );
    }
  };

  // 拖拽浮层的内容：天气卡自带取数逻辑，在浮层里重新挂载会重复发请求，改用静态占位
  const renderDragPreview = (card: HomeCard) => {
    if (card.type === 'tool' && card.tool.id === WEATHER_TOOL_ID) {
      return (
        <div className="home-card weather-card weather-card--center" style={{ backgroundColor: '#6366f1' }}>
          <Cloud className="w-5 h-5 text-white" />
        </div>
      );
    }
    return renderCardContent(card);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* 时间日期：跟随内容滚动，只有搜索框常驻顶部 */}
      <HomeClock lunar={moyuLunar} />

      {/* 搜索框固定在顶部：不参与拖拽，网格滚动时始终可见 */}
      <div className="sticky top-0 z-30 flex flex-col items-center gap-2 mb-2 flex-shrink-0 py-1 backdrop-blur-sm">
        <SearchBar searchTypes={searchTypes} />
      </div>

      <div
        ref={gridRef}
        className={activeId ? 'home-mixed-grid home-mixed-grid--dragging' : 'home-mixed-grid'}
        style={{
          gridTemplateColumns: `repeat(${grid.columns}, ${grid.unit}px)`,
          gridAutoRows: `${grid.unit}px`,
        }}
        onWheel={hideTooltip}
      >
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {displayCards.map((card) => (
            <SortableCard
              key={card.id}
              id={card.id}
              col={activeLayout[card.id].col}
              row={activeLayout[card.id].row}
              colSpan={Math.min(card.colSpan, grid.columns)}
              rowSpan={card.rowSpan}
            >
              {renderCardContent(card)}
            </SortableCard>
          ))}

          {/* 浮层跟随光标，网格按预览布局实时让位，松手即落位。
              关掉落回动画：卡片已在目标位置，动画只会多出一张重影。
              浮层必须挂到 body：页面被 PageTransition 包了一层 transform 动画，
              该层会成为 position: fixed 的包含块，而浮层的 top/left 用的是视口坐标，
              于是整体被平移了「内容区左上角的偏移量」——正好约一个网格单元，
              表现为卡片拖到光标右下方一格。挂到 body 才能按视口锚定，与光标对齐。 */}
          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeCard ? <div className="home-drag-overlay">{renderDragPreview(activeCard)}</div> : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getContextMenuItems()}
        onClose={closeContextMenu}
      />

      {tooltipNode}
      {previewItem && (
        <ExpandedToolPreviewModal
          isOpen
          onClose={() => setPreviewItem(null)}
          toolName={previewItem.toolName}
          item={previewItem.item}
          onToggleTodo={previewItem.item.type === 'todo' ? toggleTodo : undefined}
        />
      )}

      <HomeToolAddModal
        toolId={editingItem ? editingItem.toolId : addToolId}
        editingItem={editingItem ? editingItem.item : null}
        onClose={() => {
          setAddToolId(null);
          setEditingItem(null);
        }}
        onCreated={() => { void fetchPreview(); }}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCloseConfirmDialog}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};

export default React.memo(Home);
