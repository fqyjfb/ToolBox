import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  type Collision,
  type CollisionDetection,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Trash2, ExternalLink, Copy, X, Plus, Minus, Cloud } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import { WEATHER_TOOL_ID, type HomeToolItem } from '../../utils/homeTools';
import { STORAGE_KEYS } from '../../services/localStorageService';
import { useHomeToolsStore } from '../../store/homeToolsStore';
import { loadHomeBookmarks, removeHomeBookmark, type HomeBookmark } from '../../utils/homeBookmarks';
import { loadHomeCardOrder, saveHomeCardOrder } from '../../utils/homeCardOrder';
import { isElectron } from '../../utils/environment';
import { openUrl } from '../../services/browserService';
import { useToastStore } from '../../store/toastStore';
import { useDndSensors } from '../../hooks/useDndSensors';
import { useHoverTooltip } from '../../hooks/useHoverTooltip';
import { DISPLAY_LIMITS } from '../../constants/timers';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
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
// 卡片让位的位移动画时长（FLIP），与松手落位的手感保持一致
const LAYOUT_TRANSITION_MS = 160;

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

const Home: React.FC = () => {
  const isDesktop = isElectron();

  const [sixtySecondsData, setSixtySecondsData] = useState<string[] | null>(null);
  const [sixtySecondsLoading, setSixtySecondsLoading] = useState(false);
  const [sixtySecondsError, setSixtySecondsError] = useState('');

  const [moyuData, setMoyuData] = useState<MoyuData | null>(null);
  const [moyuLoading, setMoyuLoading] = useState(true);
  const [moyuError, setMoyuError] = useState('');

  const { favorites } = useHomeFavorites();
  const { apps: homeQuickLaunchApps, launchApp: handleLaunchApp, removeApp: handleRemoveHomeQuickLaunch } = useHomeQuickLaunch();

  const [homeBookmarks, setHomeBookmarks] = useState<HomeBookmark[]>([]);
  const homeTools = useHomeToolsStore(state => state.homeTools);
  const removeHomeTool = useHomeToolsStore(state => state.removeTool);
  const hydrateHomeTools = useHomeToolsStore(state => state.hydrate);

  // 拖拽顺序（HOME_CARD_ORDER）；首次进入为空，按数据源顺序排
  const [order, setOrder] = useState<string[]>(loadHomeCardOrder);
  const [grid, setGrid] = useState<GridMetrics>({ columns: MIN_COLUMNS, unit: MIN_UNIT });
  const [activeId, setActiveId] = useState<string | null>(null);
  // 拖拽中的预览顺序（所见即所得）；null 表示未拖拽或尚未产生位移
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; cardId: string | null }>({
    isOpen: false,
    x: 0,
    y: 0,
    cardId: null,
  });

  const gridRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const addToast = useToastStore(state => state.addToast);
  const sensors = useDndSensors();
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
      list.push({ id: `tool-${tool.id}`, type: 'tool', tool, colSpan: 2, rowSpan: 2 });
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
  }, [homeTools, homeQuickLaunchApps, homeBookmarks, favorites]);

  const cardMap = useMemo(() => new Map(cards.map(card => [card.id, card])), [cards]);

  // 顶部时钟的农历文案复用摸鱼日报数据，避免再引一套农历库
  const moyuLunar = useMemo(() => {
    const lunar = moyuData?.date.lunar;
    return lunar ? `${lunar.monthCN}${lunar.dayCN}` : undefined;
  }, [moyuData]);

  // 持久化顺序对账：剔除已删除 / 重复的 id，新增元素追加到末尾。
  // 去重是必须的 —— 重复的 id 会让网格渲染出多张相同的卡片
  const orderedIds = useMemo(() => {
    const seen = new Set<string>();
    const kept: string[] = [];

    for (const id of order) {
      if (!cardMap.has(id) || seen.has(id)) continue;
      seen.add(id);
      kept.push(id);
    }
    for (const card of cards) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      kept.push(card.id);
    }

    return kept;
  }, [order, cards, cardMap]);

  // 拖拽中直接渲染预览顺序：网格里卡片尺寸不一，只有真实重排才能让用户
  // 提前看到最终落点；预览与数据源不一致时（拖拽中卡片被移除）回退到实时顺序
  const displayIds = useMemo(() => {
    if (!previewIds) return orderedIds;

    const available = new Set(orderedIds);
    const kept = previewIds.filter(id => available.has(id));
    return kept.length === orderedIds.length ? kept : orderedIds;
  }, [previewIds, orderedIds]);

  const displayCards = useMemo(
    () => displayIds.map(id => cardMap.get(id)).filter((card): card is HomeCard => !!card),
    [displayIds, cardMap]
  );

  // 拖拽浮层渲染的卡片内容
  const activeCard = useMemo(
    () => (activeId ? displayCards.find(card => card.id === activeId) ?? null : null),
    [activeId, displayCards]
  );

  const persistOrder = useCallback((next: string[]) => {
    setOrder(next);
    saveHomeCardOrder(next);
  }, []);

  // 重排位移动画（FLIP）：把「卡片瞬间换格」补成平滑位移。
  // 变换只写在卡片内层，网格单元自身不带 transform，命中判定读到的始终是准确位置
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
        layer.style.transition = `transform ${LAYOUT_TRANSITION_MS}ms ease`;
        layer.style.transform = '';
      }
    }

    slotPositionsRef.current = next;
  }, [displayIds, activeId]);

  // 命中判定直接读网格单元的实时矩形：预览会真实重排，dnd-kit 缓存的投放区矩形
  // 仍是拖拽开始时的旧值，用它会把目标算到已经让位的卡片上。
  // 网格单元彼此不重叠，指针只会命中一张卡片；命中拖拽源自身时视为无目标
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const container = gridRef.current;
    const point = args.pointerCoordinates;
    if (!container || !point) return [];

    const hits: Collision[] = [];
    for (const slot of Array.from(container.querySelectorAll<HTMLElement>('.home-sortable'))) {
      const id = slot.dataset.cardId;
      if (!id || id === args.active.id) continue;

      const rect = slot.getBoundingClientRect();
      if (point.x < rect.left || point.x > rect.right) continue;
      if (point.y < rect.top || point.y > rect.bottom) continue;
      hits.push({ id });
    }
    return hits;
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    hideTooltip();
  }, [hideTooltip]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || over.id === active.id) return;

    animateLayoutRef.current = true;
    setPreviewIds(prev => {
      const base = prev ?? orderedIds;
      const from = base.indexOf(String(active.id));
      const to = base.indexOf(String(over.id));
      if (from === -1 || to === -1 || from === to) return prev;
      return arrayMove(base, from, to);
    });
  }, [orderedIds]);

  const handleDragEnd = useCallback(() => {
    const next = displayIds;
    setActiveId(null);
    setPreviewIds(null);
    animateLayoutRef.current = false;
    // 指针停在网格间隙时没有预览顺序，保持原样
    if (next !== orderedIds) persistOrder(next);
  }, [displayIds, orderedIds, persistOrder]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setPreviewIds(null);
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
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, cardId });
  }, [cardMap]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false, cardId: null }));
  }, []);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    const card = contextMenu.cardId ? cardMap.get(contextMenu.cardId) : undefined;
    if (!card) return [];

    // 工具卡片：与工具中心共用同一份数据源，移出首页后工具中心的角标同步消失
    if (card.type === 'tool') {
      return [
        {
          id: 'open',
          label: '打开工具',
          icon: <ExternalLink className="w-4 h-4" />,
          onClick: () => navigateToTool(card.tool.path),
        },
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
  }, [contextMenu.cardId, cardMap, copyUrl, navigateToTool, addToast, removeHomeTool, handleRemoveHomeQuickLaunch, handleRemoveHomeBookmark]);

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
        className="home-mixed-grid"
        style={{
          gridTemplateColumns: `repeat(${grid.columns}, ${grid.unit}px)`,
          gridAutoRows: `${grid.unit}px`,
        }}
        onWheel={hideTooltip}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {displayCards.map((card) => (
            <SortableCard
              key={card.id}
              id={card.id}
              colSpan={Math.min(card.colSpan, grid.columns)}
              rowSpan={card.rowSpan}
            >
              {renderCardContent(card)}
            </SortableCard>
          ))}

          {/* 浮层跟随光标，网格按预览顺序实时让位，松手即落位。
              关掉落回动画：卡片已在目标位置，动画只会多出一张重影 */}
          <DragOverlay dropAnimation={null}>
            {activeCard ? renderDragPreview(activeCard) : null}
          </DragOverlay>
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
    </div>
  );
};

export default React.memo(Home);
