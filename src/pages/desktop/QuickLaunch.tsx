
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Rocket, Folder, Monitor, AppWindow } from 'lucide-react';
import { DndContext, closestCenter, pointerWithin, CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent, DragOverlay as DndDragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDndSensors } from '../../hooks/useDndSensors';
import {
  QuickLaunchCategory,
  QuickLaunchItem,
  QuickLaunchSortMode,
  loadApps,
  ensureAppIconsCached,
  loadDesktopOrder,
  saveDesktopOrder,
  reconcileDesktopOrder,
  applySubsetOrder,
  sortAppsByMode,
  toAppKey,
  toFolderKey,
} from '../../utils/quickLaunch';
import { useNavSearch } from '../../contexts/NavSearchContext';
import { useToastStore } from '../../store/toastStore';
import { useQuickLaunchScanStore } from '../../store/quickLaunchScanStore';
import localStorageService, { STORAGE_KEYS } from '../../services/localStorageService';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import Select from '../../components/ui/Select';
import { logDebug, logInfo, logWarn } from '../../services/loggerService';
import { useIsCompactMode } from '../../store/windowModeStore';
import { AppTileVisual, DesktopAppTile } from '../../components/quicklaunch/DesktopAppTile';
import { DesktopFolderTile, FolderTileVisual } from '../../components/quicklaunch/DesktopFolderTile';
import FolderPopup, { FOLDER_POPUP_PREFIX } from '../../components/quicklaunch/FolderPopup';
import { buildDesktopTiles, repositionKey, writeBackSlots } from '../../components/quicklaunch/desktopTiles';
import { DesktopTile } from '../../components/quicklaunch/types';
import { QuickLaunchHotkeyDialog } from './quickLaunch/QuickLaunchHotkeyDialog';
import { QuickLaunchRepairDialog } from './quickLaunch/QuickLaunchRepairDialog';
import { buildContextMenuItems } from './quickLaunch/contextMenuItems';
import { useQuickLaunchActions } from './quickLaunch/useQuickLaunchActions';
import './QuickLaunch.css';
import {
  getDragPointer,
  resolveFolderDropIntent,
  type OpenFolderInfo,
} from './quickLaunch/dndLogic';

const QuickLaunch: React.FC = () => {
  const { searchQuery, isSearchActive } = useNavSearch();
  const addToast = useToastStore(state => state.addToast);
  // 小窗模式：分类栏改单行横向滚动、工具栏独立成行，避免头部占满整个可视高度
  const isCompact = useIsCompactMode();
  const [apps, setApps] = useState<QuickLaunchItem[]>([]);
  const [categories, setCategories] = useState<QuickLaunchCategory[]>([]);
  // 桌面磁贴排列顺序（文件夹 cat:<id> 与未分类应用 app:<id> 混合）；渲染前对账，增删/扫描无需维护
  const [desktopOrder, setDesktopOrder] = useState<string[]>(loadDesktopOrder);
  // 当前展开的文件夹（分类 id）
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<QuickLaunchSortMode>(() => {
    const saved = localStorageService.getString(STORAGE_KEYS.QUICK_LAUNCH_SORT_MODE) as QuickLaunchSortMode | undefined;
    // 默认按使用频率，历史选择的模式（含自定义）直接沿用
    return saved || 'launchCount';
  });
  // 应用打开方式：勾选=单击启动（默认），未勾选=双击启动
  const [singleClickLaunch, setSingleClickLaunch] = useState(() =>
    localStorageService.getString(STORAGE_KEYS.QUICK_LAUNCH_SINGLE_CLICK) !== 'false'
  );
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [customPath, setCustomPath] = useState('');
  // 添加应用时归属的文件夹（'' = 未分类）
  const [addTargetCategory, setAddTargetCategory] = useState('');
  const [editingApp, setEditingApp] = useState<QuickLaunchItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<QuickLaunchCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'app' | 'category' | 'empty';
    targetId?: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'empty'
  });
  const [iconSize, setIconSize] = useState<'small' | 'medium'>(() => {
    const saved = localStorageService.getString(STORAGE_KEYS.QUICK_LAUNCH_ICON_SIZE);
    return (saved === 'small' || saved === 'medium') ? saved : 'medium';
  });
  const [showText, setShowText] = useState<boolean>(() => {
    const saved = localStorageService.getString(STORAGE_KEYS.QUICK_LAUNCH_SHOW_TEXT);
    return saved === undefined ? true : saved === 'true';
  });
  const [isDragOver, setIsDragOver] = useState(false);
  // 扫描状态由全局 store 管理，页面切换不中断、不重置
  const { isScanningDesktop, isScanningInstalled, progress, scanVersion, scanDesktop, scanInstalled } = useQuickLaunchScanStore();
  // P2: 热键设置 Modal
  const [showHotkeyDialog, setShowHotkeyDialog] = useState(false);
  const [hotkeyTargetApp, setHotkeyTargetApp] = useState<QuickLaunchItem | null>(null);
  const [hotkeyInput, setHotkeyInput] = useState('');
  // P2: 失效修复 Modal
  const [showInvalidDialog, setShowInvalidDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [invalidApps, setInvalidApps] = useState<QuickLaunchItem[]>([]);

  const sensors = useDndSensors();
  // 拖拽刚结束时浏览器仍会派发 click，用此守卫避免误启动 / 误展开
  const didDragRef = useRef(false);
  // 拖拽预览（DragOverlay 复用磁贴展示层，不重复实现）
  const [activeTile, setActiveTile] = useState<DesktopTile | null>(null);
  // 拖拽应用中、指针停在文件夹磁贴中心区域的文件夹键：仅该键高亮提示「松手归入」
  const [groupArmedKey, setGroupArmedKey] = useState<string | null>(null);

  useEffect(() => {
    const savedApps = loadApps();
    if (savedApps.length > 0) {
      setTimeout(() => setApps(savedApps), 0);
      ensureAppIconsCached(savedApps).catch(() => {});
      // P2: 恢复已保存的全局热键
      const appsWithHotkeys = savedApps.filter(app => app.hotkey && app.path);
      for (const app of appsWithHotkeys) {
        window.electron?.registerQuickLaunchHotkey({
          appId: app.id,
          accelerator: app.hotkey!,
          appPath: app.path,
        }).catch(() => {});
      }
      if (appsWithHotkeys.length > 0) {
        logInfo(`[QuickLaunch] 恢复 ${appsWithHotkeys.length} 个全局热键`, 'hotkey');
      }
    }

    const savedCategories = localStorageService.get<QuickLaunchCategory[]>(STORAGE_KEYS.QUICK_LAUNCH_CATEGORIES, []);
    if (savedCategories.length > 0) {
      setTimeout(() => setCategories(savedCategories), 0);
    } else {
      const defaultCategories: QuickLaunchCategory[] = [
        { id: '1', name: '常用', color: 'var(--color-category-1)' },
        { id: '2', name: '开发', color: 'var(--color-category-2)' },
        { id: '3', name: '设计', color: 'var(--color-category-3)' },
      ];
      setTimeout(() => setCategories(defaultCategories), 0);
      localStorageService.set(STORAGE_KEYS.QUICK_LAUNCH_CATEGORIES, defaultCategories);
    }
  }, []);

  useEffect(() => {
    localStorageService.setString(STORAGE_KEYS.QUICK_LAUNCH_ICON_SIZE, iconSize);
  }, [iconSize]);

  useEffect(() => {
    localStorageService.setString(STORAGE_KEYS.QUICK_LAUNCH_SHOW_TEXT, String(showText));
  }, [showText]);

  useEffect(() => {
    localStorageService.setString(STORAGE_KEYS.QUICK_LAUNCH_SORT_MODE, sortMode);
  }, [sortMode]);

  useEffect(() => {
    localStorageService.setString(STORAGE_KEYS.QUICK_LAUNCH_SINGLE_CLICK, String(singleClickLaunch));
  }, [singleClickLaunch]);

  useEffect(() => {
    localStorageService.set(STORAGE_KEYS.QUICK_LAUNCH_APPS, apps);
  }, [apps]);

  useEffect(() => {
    localStorageService.set(STORAGE_KEYS.QUICK_LAUNCH_CATEGORIES, categories);
  }, [categories]);

  useEffect(() => {
    saveDesktopOrder(desktopOrder);
  }, [desktopOrder]);

  // 扫描完成（含扫描期间切换页面后返回）时刷新列表
  useEffect(() => {
    if (scanVersion > 0) {
      setApps(loadApps());
    }
  }, [scanVersion]);

  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, isOpen: false }));
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // ── 业务操作 hooks ─────────────────────────────────────────────────────────
  const {
    handleLaunch, handleRemove, handleAddCustom, handleSelectFile, handleDropFiles,
    handleRename, handleMoveToCategory, handleSaveRename, handleSelectWorkingDir,
    handleAddCategory, handleEditCategory, handleSaveCategory, handleDeleteCategory,
    handleContextMenu, handleCloseContextMenu, handleAddApp, handleClearAll, confirmClearAll,
    handleSetHotkey, handleHotkeyKeyDown, handleSaveHotkey,
    handleExportConfig, handleImportConfig,
    handleRemoveInvalidApps, handleRepairInvalidApps, handleRelocateApp, handleRemoveFromInvalid,
  } = useQuickLaunchActions({
    apps, categories, customPath, addTargetCategory, editingApp, editingCategory,
    newCategoryName, openFolderId, desktopOrder, hotkeyTargetApp, hotkeyInput,
    setApps, setCategories, setDesktopOrder, setOpenFolderId,
    setEditingApp, setEditingCategory, setNewCategoryName,
    setShowAddDialog, setShowEditDialog, setShowCategoryDialog,
    setShowHotkeyDialog, setShowClearConfirm, setShowInvalidDialog,
    setInvalidApps, setHotkeyTargetApp, setHotkeyInput,
    setCustomPath, setAddTargetCategory, setContextMenu, addToast,
    selectFile: async () => (await window.electron?.selectFile()) ?? undefined,
    selectFolder: async () => (await window.electron?.selectFolder()) ?? undefined,
    getFileIcon: async (path: string) => (await window.electron?.getFileIcon?.(path)) ?? undefined,
    openFile: (path: string) => window.electron?.openFile?.(path),
    launchAppWithOptions: (opts) => (window.electron?.launchAppWithOptions?.({ ...opts, windowMode: opts.windowMode as 'normal' | 'minimized' | 'maximized' | undefined }) ?? Promise.resolve({ success: true })),
    registerQuickLaunchHotkey: (opts) => (window.electron?.registerQuickLaunchHotkey?.(opts) ?? Promise.resolve(undefined)),
    unregisterQuickLaunchHotkey: (appId: string) => (window.electron?.unregisterQuickLaunchHotkey?.(appId) as Promise<void> | undefined) ?? Promise.resolve(),
    fileExists: async (path: string) => (await window.electron?.fileExists?.(path)) ?? undefined,
    exportQuickLaunchConfig: (content: string) => window.electron?.exportQuickLaunchConfig(content) as Promise<{ success: boolean; filePath?: string; error?: string } | undefined>,
    importQuickLaunchConfig: () => window.electron?.importQuickLaunchConfig() as Promise<{ success: true; apps: QuickLaunchItem[]; categories: QuickLaunchCategory[] } | { success: false; error: string } | undefined>,
  });

  // 桌面网格拖拽容器 ref（handleDrop 和 handleDragOver 等共用）
  const dragContainerRef = useRef<HTMLDivElement>(null);

  // ── DND：桌面网格文件拖入处理 ────────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  // 仅当真正离开容器（而非在子元素间移动）时才取消高亮，避免闪烁
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragContainerRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  // 从 dataTransfer 解析出本地路径（桌面网格与文件夹弹层共用）
  const collectDroppedPaths = useCallback(async (e: React.DragEvent): Promise<string[]> => {
    logDebug(`[QuickLaunch] 检查 dataTransfer 内容`, 'drag-drop');

    const files = e.dataTransfer.files;
    const filePaths: string[] = [];

    if (files && files.length > 0) {
      logDebug(`[QuickLaunch] 处理 dataTransfer.files (数量: ${files.length})`, 'drag-drop');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = await window.electron?.getFileOrFolderPath(file);
        logDebug(`[QuickLaunch] File ${i}: name=${file.name}, path=${filePath}`, 'drag-drop');
        if (filePath) {
          filePaths.push(filePath);
        }
      }
    }

    return filePaths;
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const startTime = Date.now();
    logDebug(`[QuickLaunch] 开始处理拖拽事件`, 'drag-drop');

    try {
      const filePaths = await collectDroppedPaths(e);
      logInfo(`[QuickLaunch] 收集到 ${filePaths.length} 个文件待处理`, 'drag-drop');

      if (filePaths.length > 0) {
        handleDropFiles(filePaths);
        logInfo(`[QuickLaunch] 成功添加 ${filePaths.length} 个应用`, 'drag-drop');
      } else {
        logWarn(`[QuickLaunch] 未找到有效路径`, 'drag-drop');
      }

      const duration = Date.now() - startTime;
      logDebug(`[QuickLaunch] 拖拽处理完成，耗时 ${duration}ms`, 'drag-drop');

    } catch (error) {
      logWarn(`[QuickLaunch] 拖拽处理异常: ${(error as Error).message}`, 'drag-drop');
    }
  }, [collectDroppedPaths]);

  // 文件夹弹层是 fixed 遮罩层，不在桌面网格的 onDrop 覆盖范围内。
  // 必须 preventDefault，否则 Electron 下拖入文件会触发浏览器默认导航（页面跳走）。
  const handlePopupFileDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  // 搜索激活时切换为平铺结果视图（忽略文件夹，等同旧「全部 + 搜索」）
  const isFlatSearch = isSearchActive && searchQuery.trim().length > 0;

  const searchMatchedApps = useMemo(() => {
    if (!isFlatSearch) return [];
    const query = searchQuery.trim().toLowerCase();
    return apps.filter(app =>
      app.name.toLowerCase().includes(query) ||
      app.path.toLowerCase().includes(query) ||
      (app.alias?.toLowerCase().includes(query) ?? false) ||
      (app.keywords?.toLowerCase().includes(query) ?? false)
    );
  }, [isFlatSearch, searchQuery, apps]);

  // 顺序对账：丢掉已删除项、补齐新增项（扫描 / 导入 / 新增都不需要维护顺序数组）
  const orderedKeys = useMemo(
    () => reconcileDesktopOrder(desktopOrder, categories, apps),
    [desktopOrder, categories, apps]
  );

  const { tiles: orderedTiles, slotKeys } = useMemo(
    () => buildDesktopTiles(orderedKeys, categories, apps, sortMode),
    [orderedKeys, categories, apps, sortMode]
  );

  const tiles = useMemo<DesktopTile[]>(() => {
    if (isFlatSearch) {
      return searchMatchedApps.map((app): DesktopTile => ({ kind: 'app', app }));
    }
    return orderedTiles;
  }, [isFlatSearch, searchMatchedApps, orderedTiles]);

  // 只登记可拖拽磁贴：智能文件夹固定只读，不参与排序
  const dndItemKeys = useMemo(
    () => tiles.flatMap((tile) => {
      if (tile.kind === 'folder') return [toFolderKey(tile.category.id)];
      if (tile.kind === 'app') return [toAppKey(tile.app.id)];
      return [];
    }),
    [tiles]
  );

  // 无应用时所有文件夹均为空，直接显示引导空态
  const hasContent = apps.length > 0;

  // 当前展开的文件夹（可能已失效，失效时视为未展开）
  const openFolder = useMemo<OpenFolderInfo | null>(() => {
    if (!openFolderId) return null;

    const category = categories.find(c => c.id === openFolderId);
    if (!category) return null;
    const members = apps.filter(app => app.categoryId === category.id);
    return {
      key: openFolderId,
      title: category.name,
      apps: sortMode === 'custom' ? members : sortAppsByMode(members, sortMode),
      category,
    };
  }, [openFolderId, apps, categories, sortMode]);

  // 弹层打开时禁用桌面磁贴拖拽：其 droppable 会让 pointerWithin 误命中被遮罩挡住的磁贴
  const desktopDragDisabled = isFlatSearch || openFolder !== null;

  // 弹层内右键：交给文件夹专属菜单处理
  const handlePopupContextMenu = useCallback((e: React.MouseEvent) => {
    if (!openFolder) return;
    handleContextMenu(e, 'category', openFolder.category.id);
  }, [openFolder, handleContextMenu]);

  const handleFolderFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!openFolder) return;
    const filePaths = await collectDroppedPaths(e);
    if (filePaths.length > 0) {
      handleDropFiles(filePaths, openFolder.category.id);
    }
  }, [collectDroppedPaths, openFolder]);

  /** 桌面磁贴排序：写回槽位（保留已归入文件夹的隐藏键）并锁定为自定义排序 */
  const reorderDesktopTiles = useCallback((fromKey: string, toKey: string) => {
    const from = slotKeys.indexOf(fromKey);
    const to = slotKeys.indexOf(toKey);
    if (from === -1 || to === -1) return;
    const nextOrdered = writeBackSlots(orderedKeys, slotKeys, arrayMove(slotKeys, from, to));
    setDesktopOrder(nextOrdered);
    setSortMode('custom');
  }, [slotKeys, orderedKeys]);

  /** 把磁贴插到指定文件夹槽位的前/后（归属不变），用于拖到文件夹边缘时把应用落到两个文件夹之间 */
  const insertTileAdjacentToFolder = useCallback((tileKey: string, folderKey: string, before: boolean) => {
    const folderIndex = slotKeys.indexOf(folderKey);
    if (folderIndex === -1 || !slotKeys.includes(tileKey)) return;
    const anchorKey = before ? folderKey : slotKeys[folderIndex + 1] ?? null;
    // 已处于目标位置时不产生无谓写入
    if (anchorKey === tileKey) return;
    setDesktopOrder(writeBackSlots(orderedKeys, slotKeys, repositionKey(slotKeys, tileKey, anchorKey)));
    setSortMode('custom');
  }, [slotKeys, orderedKeys]);

  /** 文件夹内应用排序：只置换该子集在 apps 中的落位，其余应用位置不变 */
  const reorderFolderApps = useCallback((categoryId: string, activeId: string, overId: string) => {
    const ids = apps.filter(app => app.categoryId === categoryId).map(app => app.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from === -1 || to === -1) return;
    setApps(prev => applySubsetOrder(prev, arrayMove(ids, from, to)));
    setSortMode('custom');
  }, [apps]);

  /** 移动应用到目标容器：'' = 回到桌面（未分类），并把顺序键落到 anchor 之前 */
  const moveAppToContainer = useCallback((appId: string, categoryId: string, anchorKey: string | null) => {
    setApps(prev => prev.map(app => (app.id === appId ? { ...app, categoryId } : app)));
    setDesktopOrder(prev => repositionKey(prev, toAppKey(appId), anchorKey));
  }, []);

  // 桌面态碰撞检测：指针精确停到磁贴内优先命中该磁贴；落在磁贴间隙时兜底取最近磁贴。
  // 命中文件夹后由 handleDragEnd 按「指针在中心区域=归入 / 在边缘或间隙=插入相邻槽位」分流，
  // 因此间隙兜底可以包含 cat 键，让「拖到两个文件夹之间」也能落到正确的插入位置。
  const desktopCollisionDetection = useCallback<CollisionDetection>((args) => {
    const within = pointerWithin(args);
    if (within.length > 0) return within;
    return closestCenter(args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    didDragRef.current = true;
    setGroupArmedKey(null);
    const key = String(event.active.id);
    if (key.startsWith('cat:')) {
      const id = key.slice(4);
      setActiveTile(tiles.find(t => t.kind === 'folder' && t.category.id === id) ?? null);
      return;
    }
    const app = apps.find(a => a.id === key.slice(4));
    setActiveTile(app ? { kind: 'app', app } : null);
  }, [tiles, apps]);

  // 拖拽中仅对「应用落在文件夹磁贴中心区域」高亮该文件夹，边缘区域不提示归入（松手为插入排序）
  const handleDragMove = useCallback((event: DragMoveEvent) => {
    const { over } = event;
    if (!String(event.active.id).startsWith('app:') || !over || !String(over.id).startsWith('cat:')) {
      setGroupArmedKey(null);
      return;
    }
    const intent = resolveFolderDropIntent(getDragPointer(event.activatorEvent, event.delta), over.rect);
    setGroupArmedKey(intent === 'group' ? String(over.id) : null);
  }, []);

  const endDrag = useCallback(() => {
    setActiveTile(null);
    setGroupArmedKey(null);
    // click 与 pointerup 同处一个任务，延后一拍复位即可拦截拖拽后的误触发
    setTimeout(() => { didDragRef.current = false; }, 0);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    endDrag();

    const { active, over } = event;
    const activeKey = String(active.id);
    const overKey = over ? String(over.id) : null;

    // A. 弹层打开且落在面板外（遮罩）→ 移出该文件夹
    if (overKey === null) {
      if (openFolder && activeKey.startsWith('app:')) {
        moveAppToContainer(activeKey.slice(4), '', null);
      }
      return;
    }
    if (activeKey === overKey) return;

    const activeApp = activeKey.startsWith('app:')
      ? apps.find(a => a.id === activeKey.slice(4))
      : undefined;
    const overApp = overKey.startsWith('app:')
      ? apps.find(a => a.id === overKey.slice(4))
      : undefined;

    // B. 归入文件夹 / 插入到文件夹相邻槽位
    if (activeApp) {
      // 弹层面板是显式投放目标，始终归入
      if (overKey.startsWith(FOLDER_POPUP_PREFIX)) {
        const categoryId = overKey.slice(FOLDER_POPUP_PREFIX.length);
        moveAppToContainer(activeApp.id, categoryId, null);
        addToast({ type: 'success', message: `已移入「${categories.find(c => c.id === categoryId)?.name ?? '文件夹'}」` });
        return;
      }
      // 桌面文件夹磁贴：中心区域归入，边缘区域按相邻槽位插入排序（可落到两个文件夹之间）
      if (overKey.startsWith('cat:') && over) {
        const categoryId = overKey.slice(4);
        const intent = resolveFolderDropIntent(getDragPointer(event.activatorEvent, event.delta), over.rect);
        if (intent === 'group') {
          moveAppToContainer(activeApp.id, categoryId, null);
          addToast({ type: 'success', message: `已移入「${categories.find(c => c.id === categoryId)?.name ?? '文件夹'}」` });
        } else {
          insertTileAdjacentToFolder(activeKey, overKey, intent === 'insert-before');
        }
        return;
      }
    }

    // C. 应用落在应用
    if (activeApp && overApp) {
      if (activeApp.categoryId === overApp.categoryId) {
        if (activeApp.categoryId) {
          reorderFolderApps(activeApp.categoryId, activeApp.id, overApp.id);
        } else {
          reorderDesktopTiles(activeKey, overKey);
        }
        return;
      }
      // 跨容器：移动到目标应用所在容器，并落到其位置
      moveAppToContainer(activeApp.id, overApp.categoryId, overKey);
      return;
    }

    // D. 磁贴排序（文件夹 / 桌面应用）
    reorderDesktopTiles(activeKey, overKey);
  }, [openFolder, apps, categories, addToast, moveAppToContainer, insertTileAdjacentToFolder, reorderFolderApps, reorderDesktopTiles, endDrag]);

  const getContextMenuItems = useCallback((): ContextMenuItem[] =>
    buildContextMenuItems({
      type: contextMenu.type,
      targetId: contextMenu.targetId,
      apps,
      categories,
      iconSize,
      showText,
      singleClickLaunch,
      sortMode,
      setSortMode,
      isScanningDesktop,
      isScanningInstalled,
      addToast,
      handleLaunch,
      handleRename,
      handleSetHotkey,
      handleMoveToCategory,
      handleRemove,
      handleEditCategory,
      handleDeleteCategory,
      handleAddApp,
      handleAddCategory,
      handleClearAll,
      handleRemoveInvalidApps,
      handleRepairInvalidApps,
      handleExportConfig,
      handleImportConfig,
      handleCloseContextMenu,
      scanDesktop,
      scanInstalled,
      setIconSize,
      setShowText,
      setSingleClickLaunch,
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [
    contextMenu.type, contextMenu.targetId,
    apps, categories, iconSize, showText, singleClickLaunch,
    isScanningDesktop, isScanningInstalled,
    addToast, handleLaunch, handleRename, handleSetHotkey,
    handleMoveToCategory, handleRemove, handleEditCategory, handleDeleteCategory,
    handleAddApp, handleAddCategory, handleClearAll,
    handleRemoveInvalidApps, handleRepairInvalidApps,
    handleExportConfig, handleImportConfig, handleCloseContextMenu,
    scanDesktop, scanInstalled, setIconSize, setShowText, setSingleClickLaunch,
  ]);

  const renderTile = (tile: DesktopTile) => {
    if (tile.kind === 'app') {
      return (
        <DesktopAppTile
          key={toAppKey(tile.app.id)}
          app={tile.app}
          iconSize={iconSize}
          showText={showText}
          disabled={desktopDragDisabled}
          singleClick={singleClickLaunch}
          didDragRef={didDragRef}
          onLaunch={handleLaunch}
          onContextMenu={(e) => handleContextMenu(e, 'app', tile.app.id)}
        />
      );
    }
    if (tile.kind === 'folder') {
      return (
        <DesktopFolderTile
          key={toFolderKey(tile.category.id)}
          category={tile.category}
          apps={tile.apps}
          iconSize={iconSize}
          showText={showText}
          disabled={desktopDragDisabled}
          groupArmed={groupArmedKey === toFolderKey(tile.category.id)}
          didDragRef={didDragRef}
          onOpen={() => setOpenFolderId(tile.category.id)}
          onContextMenu={(e) => handleContextMenu(e, 'category', tile.category.id)}
        />
      );
    }
  };

  // 小窗下收窄最小列宽：一行排得下更多应用（小图标 4 个 / 中图标 3 个），减少纵向滚动
  const appGridClass = iconSize === 'small'
    ? (isCompact
        ? 'grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-2 auto-rows-quick-launch-sm'
        : 'grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 auto-rows-quick-launch-sm')
    : (isCompact
        ? 'grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2.5 auto-rows-quick-launch-lg'
        : 'grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3.5 auto-rows-quick-launch-lg');

  return (
    <div
        className="h-full flex flex-col"
        onContextMenu={(e) => handleContextMenu(e, 'empty')}
      >        
      <div
        ref={dragContainerRef}
        className={`quick-launch-scroll flex-1 overflow-auto flex flex-col transition-colors duration-200 ${
          isDragOver ? 'bg-toast-success-bg' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {hasContent ? (
          <DndContext
            sensors={sensors}
            // 弹层打开时用 pointerWithin：面板空白命中面板，面板外（遮罩）无命中 → 移出文件夹
            // 桌面态用自定义检测：精确停入才算"归入"，避免路径上路过文件夹时误判
            collisionDetection={openFolder ? pointerWithin : desktopCollisionDetection}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={endDrag}
          >
            <SortableContext items={dndItemKeys} strategy={rectSortingStrategy}>
              <div className={`grid ${appGridClass} min-h-quick-launch transition-colors duration-200 ${
                isDragOver ? 'border-2 border-dashed border-green-400 rounded-lg p-4' : ''
              }`}>
                {tiles.map(renderTile)}
              </div>
            </SortableContext>

            {openFolder && (
              <FolderPopup
                folderKey={openFolder.key}
                title={openFolder.title}
                apps={openFolder.apps}
                iconSize={iconSize}
                showText={showText}
                singleClick={singleClickLaunch}
                didDragRef={didDragRef}
                onLaunch={handleLaunch}
                onAppContextMenu={(e, appId) => handleContextMenu(e, 'app', appId)}
                onFolderContextMenu={handlePopupContextMenu}
                onAddApp={() => handleAddApp(openFolder.category.id)}
                onClose={() => setOpenFolderId(null)}
                onFileDragOver={handlePopupFileDragOver}
                onFileDrop={handleFolderFileDrop}
              />
            )}

            <DndDragOverlay>
              {activeTile && (
                <div className={`flex flex-col items-center justify-center rounded-md shadow-lg bg-surface-secondary w-full cursor-grabbing ${
                  iconSize === 'small' ? 'h-quick-launch-sm' : 'h-quick-launch-lg'
                }`}>
                  {activeTile.kind === 'folder' && (
                    <FolderTileVisual
                      category={activeTile.category}
                      apps={activeTile.apps}
                      iconSize={iconSize}
                      showText={showText}
                    />
                  )}
                  {activeTile.kind === 'app' && (
                    <AppTileVisual app={activeTile.app} iconSize={iconSize} showText={showText} />
                  )}
                </div>
              )}
            </DndDragOverlay>

            {tiles.length === 0 && (
              <div className="flex flex-col flex-1 items-center justify-center text-gray-400">
                <p className="text-sm">未找到匹配的应用</p>
              </div>
            )}
          </DndContext>
        ) : (
          <div className={`flex flex-col flex-1 items-center justify-center text-gray-400 transition-all duration-200 ${
            isDragOver ? 'border-2 border-dashed border-green-400 rounded-lg p-8' : ''
          }`}>
            <Rocket size={64} className={`mb-4 transition-opacity duration-200 ${isDragOver ? 'opacity-100 text-green-500' : 'opacity-50'}`} />
            <p className="text-lg">{isDragOver ? '松开鼠标添加应用' : '暂无快启动应用'}</p>
            <p className="text-sm">{isDragOver ? '支持拖拽多个应用' : '右键点击空白处添加应用'}</p>
          </div>
        )}
        {(isScanningInstalled || isScanningDesktop) && (
          <div className="quick-launch-scan-bar">
            {isScanningDesktop
              ? <Monitor size={14} className="quick-launch-scan-icon" />
              : <AppWindow size={14} className="quick-launch-scan-icon" />}
            <div className="quick-launch-scan-track">
              <div className="quick-launch-scan-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="quick-launch-scan-text">{progress}%</span>
          </div>
        )}
      </div>

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={getContextMenuItems()}
        onClose={handleCloseContextMenu}
      />

      <Modal
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        title="添加快启动应用"
        confirmText="添加"
        onConfirm={handleAddCustom}
        confirmDisabled={!customPath.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">
              应用路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="输入应用程序路径..."
                className="flex-1 px-4 py-2 border-content rounded-lg bg-surface text-content-primary placeholder-text-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleSelectFile}
                className="px-4 py-2 bg-menu-hover hover:bg-menu-hover rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">
              文件夹
            </label>
            <Select
              value={addTargetCategory}
              onChange={(v) => setAddTargetCategory(v)}
              options={[
                { value: '', label: '未分类（放在桌面）' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
              className="w-full px-4 py-2 border border-content rounded-lg bg-surface-secondary text-content-primary focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        title="编辑应用"
        confirmText="保存"
        onConfirm={handleSaveRename}
        confirmDisabled={!editingApp?.name.trim()}
      >
        {editingApp && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-content-primary mb-2">
                应用名称
              </label>
              <input
                type="text"
                value={editingApp.name}
                onChange={(e) => setEditingApp({ ...editingApp, name: e.target.value })}
                className="w-full px-4 py-2 border border-content rounded-lg bg-surface-secondary text-content-primary focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-2">
                别名（可选，用于搜索）
              </label>
              <input
                type="text"
                value={editingApp.alias ?? ''}
                onChange={(e) => setEditingApp({ ...editingApp, alias: e.target.value })}
                placeholder="如：PS、Photoshop"
                className="w-full px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-content-primary mb-2">
                关键词（可选，空格分隔）
              </label>
              <input
                type="text"
                value={editingApp.keywords ?? ''}
                onChange={(e) => setEditingApp({ ...editingApp, keywords: e.target.value })}
                placeholder="如：图像 编辑 设计"
                className="w-full px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* 启动选项 */}
            <div className="pt-4">
              <p className="text-xs text-content-secondary mb-3">启动选项（可选）</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-content-primary mb-2">
                    启动参数
                  </label>
                  <input
                    type="text"
                    value={editingApp.args ?? ''}
                    onChange={(e) => setEditingApp({ ...editingApp, args: e.target.value })}
                    placeholder="如：--profile=Default"
                    className="w-full px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-primary mb-2">
                    工作目录
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingApp.workingDir ?? ''}
                      onChange={(e) => setEditingApp({ ...editingApp, workingDir: e.target.value })}
                      placeholder="应用启动时的工作目录"
                      className="flex-1 px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={handleSelectWorkingDir}
                      className="px-3 py-2 bg-menu-hover hover:bg-menu-hover rounded-lg transition-colors"
                      title="选择目录"
                    >
                      <Folder size={18} className="text-content-primary" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingApp.runAsAdmin ?? false}
                      onChange={(e) => setEditingApp({ ...editingApp, runAsAdmin: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-content-primary">以管理员身份运行</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-content-primary mb-2">
                    窗口模式
                  </label>
                  <Select
                    value={editingApp.windowMode ?? 'normal'}
                    onChange={(v) => setEditingApp({ ...editingApp, windowMode: v as 'normal' | 'minimized' | 'maximized' })}
                    options={[
                      { value: 'normal', label: '正常' },
                      { value: 'minimized', label: '最小化' },
                      { value: 'maximized', label: '最大化' },
                    ]}
                    className="w-full px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCategoryDialog}
        onClose={() => setShowCategoryDialog(false)}
        title={editingCategory ? '重命名文件夹' : '新建文件夹'}
        confirmText={editingCategory ? '保存' : '添加'}
        onConfirm={handleSaveCategory}
        confirmDisabled={!newCategoryName.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">
              文件夹名称
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="输入分类名称..."
              className="w-full px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </Modal>

      {/* 热键设置 */}
      <QuickLaunchHotkeyDialog
        isOpen={showHotkeyDialog}
        hotkeyTargetApp={hotkeyTargetApp}
        hotkeyInput={hotkeyInput}
        onClose={() => {
          setShowHotkeyDialog(false);
          setHotkeyTargetApp(null);
          setHotkeyInput('');
        }}
        onConfirm={handleSaveHotkey}
        onHotkeyKeyDown={handleHotkeyKeyDown}
        onClear={() => setHotkeyInput('')}
      />

      {/* 清空应用二次确认 */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearAll}
        title="确认清空"
        message="确定要清空全部应用吗？此操作不可恢复。"
        confirmText="清空"
        cancelText="取消"
      />

      {/* 失效应用修复 */}
      <QuickLaunchRepairDialog
        isOpen={showInvalidDialog}
        invalidApps={invalidApps}
        onClose={() => {
          setShowInvalidDialog(false);
          setInvalidApps([]);
        }}
        onRelocate={handleRelocateApp}
        onRemove={handleRemoveFromInvalid}
      />
    </div>
  );
};

export default QuickLaunch;