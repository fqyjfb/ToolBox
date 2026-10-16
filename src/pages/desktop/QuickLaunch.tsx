import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Rocket, FolderPlus, Edit2, Trash2, Plus, Tag, Folder, Home, Monitor, Copy, AppWindow, Shield, FolderOpen, Keyboard, Download, Upload, Wrench, X, Check, Settings } from 'lucide-react';
import { DndContext, closestCenter, pointerWithin, CollisionDetection, DragEndEvent, DragMoveEvent, DragStartEvent, DragOverlay as DndDragOverlay, type ClientRect } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import { useDndSensors } from '../../hooks/useDndSensors';
import {
  QuickLaunchCategory,
  QuickLaunchItem,
  QuickLaunchSortMode,
  addHomeQuickLaunchApp,
  isAppInHomeQuickLaunch,
  loadApps,
  ensureAppIconsCached,
  generateAppId,
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
import './QuickLaunch.css';

/**
 * 文件夹磁贴中心区域内缩比例：磁贴中心区域松手=归入文件夹；
 * 边缘区域松手=把应用插入到该文件夹相邻的桌面槽位（可落在两个文件夹之间）。
 */
const FOLDER_CORE_INSET_RATIO = 0.25;

type FolderDropIntent = 'group' | 'insert-before' | 'insert-after';

/**
 * 取拖拽中的指针坐标：activatorEvent 是按下时的初始位置，叠加累计 delta 得到当前位置。
 * 键盘拖拽等无坐标输入返回 null（此时按归入处理，保持原有行为）。
 */
const getDragPointer = (
  activatorEvent: Event,
  delta: { x: number; y: number }
): { x: number; y: number } | null => {
  if (!('clientX' in activatorEvent)) return null;
  const { clientX, clientY } = activatorEvent as MouseEvent;
  return { x: clientX + delta.x, y: clientY + delta.y };
};

/**
 * 判定应用落在文件夹磁贴上的意图：
 * 指针处于磁贴中心区域 → 归入；处于边缘 → 按最近的一条边插入到该文件夹前/后。
 */
const resolveFolderDropIntent = (
  pointer: { x: number; y: number } | null,
  rect: ClientRect
): FolderDropIntent => {
  if (!pointer) return 'group';
  const insetX = rect.width * FOLDER_CORE_INSET_RATIO;
  const insetY = rect.height * FOLDER_CORE_INSET_RATIO;
  const inCore =
    pointer.x >= rect.left + insetX &&
    pointer.x <= rect.right - insetX &&
    pointer.y >= rect.top + insetY &&
    pointer.y <= rect.bottom - insetY;
  if (inCore) return 'group';
  const dLeft = pointer.x - rect.left;
  const dRight = rect.right - pointer.x;
  const dTop = pointer.y - rect.top;
  const dBottom = rect.bottom - pointer.y;
  return Math.min(dLeft, dTop) <= Math.min(dRight, dBottom) ? 'insert-before' : 'insert-after';
};

/** 当前展开的文件夹信息 */
interface OpenFolderInfo {
  key: string;
  title: string;
  apps: QuickLaunchItem[];
  /** 智能文件夹无对应分类 */
  category?: QuickLaunchCategory;
  readOnly: boolean;
}

const QuickLaunch: React.FC = () => {
  const { searchQuery, isSearchActive } = useNavSearch();
  const addToast = useToastStore(state => state.addToast);
  // 小窗模式：分类栏改单行横向滚动、工具栏独立成行，避免头部占满整个可视高度
  const isCompact = useIsCompactMode();
  const [apps, setApps] = useState<QuickLaunchItem[]>([]);
  const [categories, setCategories] = useState<QuickLaunchCategory[]>([]);
  // 桌面磁贴排列顺序（文件夹 cat:<id> 与未分类应用 app:<id> 混合）；渲染前对账，增删/扫描无需维护
  const [desktopOrder, setDesktopOrder] = useState<string[]>(loadDesktopOrder);
  // 当前展开的文件夹：真实分类为其 id，智能文件夹为 smart:<key>
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
    const savedApps = localStorageService.get<QuickLaunchItem[]>(STORAGE_KEYS.QUICK_LAUNCH_APPS, []);
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

  const getAppName = useCallback((path: string): string => {
    const name = path.split(/[\\/]/).pop() || path;
    return name.replace(/\.(exe|bat|cmd|lnk)$/i, '');
  }, []);

  const handleLaunch = useCallback((path: string) => {
    const targetApp = apps.find(a => a.path === path);
    const hasOptions = targetApp && (
      targetApp.args ||
      targetApp.workingDir ||
      targetApp.runAsAdmin ||
      (targetApp.windowMode && targetApp.windowMode !== 'normal')
    );

    if (hasOptions && window.electron?.launchAppWithOptions) {
      window.electron.launchAppWithOptions({
        path: targetApp!.path,
        args: targetApp!.args,
        workingDir: targetApp!.workingDir,
        runAsAdmin: targetApp!.runAsAdmin,
        windowMode: targetApp!.windowMode,
      }).then(result => {
        if (!result.success) {
          addToast({ type: 'error', message: `启动失败: ${result.error ?? '未知错误'}` });
        }
      }).catch(() => {
        // 回退到普通启动
        window.electron?.openFile(path);
      });
    } else {
      window.electron?.openFile(path);
    }

    // P0: 频率统计
    setApps(prev => prev.map(app =>
      app.path === path
        ? { ...app, launchCount: (app.launchCount ?? 0) + 1, lastLaunchedAt: Date.now() }
        : app
    ));
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [apps, addToast]);

  const handleRemove = useCallback((id: string) => {
    setApps(prev => prev.filter(app => app.id !== id));
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleAddCustom = useCallback(async () => {
    if (customPath.trim()) {
      const lowerPath = customPath.toLowerCase();
      const exists = apps.some(app => app.path.toLowerCase() === lowerPath);

      if (exists) {
        return;
      }

      const icon = await window.electron?.getFileIcon(customPath) || undefined;
      const newApp: QuickLaunchItem = {
        id: generateAppId(),
        name: getAppName(customPath),
        path: customPath,
        icon,
        // 默认未分类（直接落在桌面），在文件夹弹层内添加时归入该文件夹
        categoryId: addTargetCategory,
        addedAt: Date.now(),
      };
      setApps(prev => [...prev, newApp]);
      setCustomPath('');
      setShowAddDialog(false);
    }
  }, [customPath, getAppName, addTargetCategory, apps]);

  const handleSelectFile = useCallback(async () => {
    const result = await window.electron?.selectFile();
    if (result) {
      setCustomPath(result);
    }
  }, []);

  const handleDropFiles = useCallback(async (paths: string[], targetCategoryId = '') => {
    for (const filePath of paths) {
      const lowerPath = filePath.toLowerCase();
      const exists = apps.some(app => app.path.toLowerCase() === lowerPath);

      if (exists) {
        continue;
      }

      const icon = await window.electron?.getFileIcon(filePath) || undefined;
      const newApp: QuickLaunchItem = {
        id: generateAppId(),
        name: getAppName(filePath),
        path: filePath,
        icon,
        categoryId: targetCategoryId,
        addedAt: Date.now(),
      };
      setApps(prev => [...prev, newApp]);
    }
  }, [apps, getAppName]);

  const dragContainerRef = useRef<HTMLDivElement>(null);

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
  }, [handleDropFiles, collectDroppedPaths]);

  // 文件夹弹层是 fixed 遮罩层，不在桌面网格的 onDrop 覆盖范围内。
  // 必须 preventDefault，否则 Electron 下拖入文件会触发浏览器默认导航（页面跳走）。
  const handlePopupFileDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);



  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'app' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, type, targetId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleAddApp = useCallback((categoryId = '') => {
    setAddTargetCategory(categoryId);
    setShowAddDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  // 清空操作需二次确认，确认后执行
  const handleClearAll = useCallback(() => {
    setShowClearConfirm(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const confirmClearAll = useCallback(() => {
    setApps([]);
    addToast({ type: 'success', message: '已清空全部应用' });
  }, [addToast]);

  const handleRemoveInvalidApps = useCallback(async () => {
    const invalidAppIds: string[] = [];

    for (const app of apps) {
      const exists = await window.electron?.fileExists(app.path);
      if (!exists) {
        invalidAppIds.push(app.id);
      }
    }

    if (invalidAppIds.length > 0) {
      setApps(prev => prev.filter(app => !invalidAppIds.includes(app.id)));
      addToast({ type: 'success', message: `已移除 ${invalidAppIds.length} 个失效应用` });
    } else {
      addToast({ type: 'info', message: '所有应用均有效，无需清理' });
    }

    handleCloseContextMenu();
  }, [apps, addToast, handleCloseContextMenu]);

  // P2: 失效应用修复（带重新定位）
  const handleRepairInvalidApps = useCallback(async () => {
    const invalid: QuickLaunchItem[] = [];
    for (const app of apps) {
      const exists = await window.electron?.fileExists(app.path);
      if (!exists) invalid.push(app);
    }
    if (invalid.length === 0) {
      addToast({ type: 'info', message: '所有应用均有效，无需修复' });
    } else {
      setInvalidApps(invalid);
      setShowInvalidDialog(true);
    }
    handleCloseContextMenu();
  }, [apps, addToast, handleCloseContextMenu]);

  // 重新定位失效应用路径
  const handleRelocateApp = useCallback(async (appId: string) => {
    const target = invalidApps.find(a => a.id === appId);
    if (!target) return;
    const newPath = await window.electron?.selectFile();
    if (!newPath) return;

    const icon = await window.electron?.getFileIcon(newPath) || undefined;
    // 若用户曾手动改过 name，则保留；否则按新路径自动重命名
    const originalName = getAppName(target.path);
    const shouldRename = target.name === originalName;
    setApps(prev => prev.map(app =>
      app.id === appId
        ? { ...app, path: newPath, name: shouldRename ? getAppName(newPath) : app.name, icon }
        : app
    ));
    setInvalidApps(prev => prev.filter(a => a.id !== appId));
    addToast({ type: 'success', message: '应用路径已更新' });
  }, [invalidApps, addToast, getAppName]);

  // 从失效列表直接移除
  const handleRemoveFromInvalid = useCallback((appId: string) => {
    setApps(prev => prev.filter(app => app.id !== appId));
    setInvalidApps(prev => prev.filter(a => a.id !== appId));
  }, []);

  // P2: 热键设置
  const handleSetHotkey = useCallback((app: QuickLaunchItem) => {
    setHotkeyTargetApp(app);
    setHotkeyInput(app.hotkey ?? '');
    setShowHotkeyDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  // 热键录制：捕获 keydown 转为 accelerator 字符串
  const handleHotkeyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Escape') {
      setHotkeyInput('');
      return;
    }
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');
    // 忽略纯修饰键
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    // 数字 / 字母键
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);
    setHotkeyInput(parts.join('+'));
  }, []);

  const handleSaveHotkey = useCallback(async () => {
    if (!hotkeyTargetApp) return;
    if (hotkeyInput) {
      const result = await window.electron?.registerQuickLaunchHotkey({
        appId: hotkeyTargetApp.id,
        accelerator: hotkeyInput,
        appPath: hotkeyTargetApp.path,
      });
      if (result && !result.success) {
        addToast({ type: 'error', message: `注册失败: ${result.error ?? '未知错误'}` });
        return;
      }
      setApps(prev => prev.map(app =>
        app.id === hotkeyTargetApp.id ? { ...app, hotkey: hotkeyInput } : app
      ));
      addToast({ type: 'success', message: `快捷键已设置: ${hotkeyInput}` });
    } else {
      // 清除热键
      await window.electron?.unregisterQuickLaunchHotkey(hotkeyTargetApp.id);
      setApps(prev => prev.map(app =>
        app.id === hotkeyTargetApp.id ? { ...app, hotkey: undefined } : app
      ));
      addToast({ type: 'info', message: '已清除快捷键' });
    }
    setShowHotkeyDialog(false);
    setHotkeyTargetApp(null);
    setHotkeyInput('');
  }, [hotkeyTargetApp, hotkeyInput, addToast]);

  // P2: 配置导出
  const handleExportConfig = useCallback(async () => {
    const content = JSON.stringify({ apps, categories, desktopOrder }, null, 2);
    const result = await window.electron?.exportQuickLaunchConfig(content);
    if (!result) {
      handleCloseContextMenu();
      return;
    }
    if (result.success) {
      addToast({ type: 'success', message: `配置已导出到: ${result.filePath}` });
    } else {
      addToast({ type: 'error', message: `导出失败: ${result.error ?? '未知错误'}` });
    }
    handleCloseContextMenu();
  }, [apps, categories, desktopOrder, addToast, handleCloseContextMenu]);

  // P2: 配置导入
  const handleImportConfig = useCallback(async () => {
    const result = await window.electron?.importQuickLaunchConfig();
    if (!result) {
      handleCloseContextMenu();
      return;
    }
    if ('error' in result) {
      addToast({ type: 'error', message: `导入失败: ${result.error}` });
      handleCloseContextMenu();
      return;
    }
    // 二次确认
    const confirmed = window.confirm('导入将覆盖当前所有快启动配置，是否继续？');
    if (!confirmed) {
      handleCloseContextMenu();
      return;
    }
    try {
      // 类型校验后写入
      const newApps = Array.isArray(result.apps) ? result.apps as QuickLaunchItem[] : [];
      const newCategories = Array.isArray(result.categories) ? result.categories : [];
      // 旧版本导出文件无 desktopOrder：按空处理，由渲染前对账自动生成默认顺序
      const importedOrder = (result as { desktopOrder?: unknown }).desktopOrder;
      const newOrder = Array.isArray(importedOrder) ? importedOrder as string[] : [];
      setApps(newApps);
      setCategories(newCategories);
      setDesktopOrder(newOrder);
      setOpenFolderId(null);
      addToast({ type: 'success', message: `已导入 ${newApps.length} 个应用、${newCategories.length} 个分类` });
    } catch {
      addToast({ type: 'error', message: '数据格式错误' });
    }
    handleCloseContextMenu();
  }, [addToast, handleCloseContextMenu]);

  const handleRename = useCallback((app: QuickLaunchItem) => {
    setEditingApp(app);
    setShowEditDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleMoveToCategory = useCallback((appId: string, categoryId: string) => {
    setApps(prev => prev.map(app => 
      app.id === appId ? { ...app, categoryId } : app
    ));
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleSaveRename = useCallback(() => {
    if (editingApp) {
      setApps(prev => prev.map(app =>
        app.id === editingApp.id ? {
          ...app,
          name: editingApp.name,
          alias: editingApp.alias,
          keywords: editingApp.keywords,
          args: editingApp.args,
          workingDir: editingApp.workingDir,
          runAsAdmin: editingApp.runAsAdmin,
          windowMode: editingApp.windowMode,
        } : app
      ));
      setEditingApp(null);
      setShowEditDialog(false);
    }
  }, [editingApp]);

  // P1: 选择工作目录
  const handleSelectWorkingDir = useCallback(async () => {
    if (!editingApp) return;
    const result = await window.electron?.selectFolder();
    if (result) {
      setEditingApp({ ...editingApp, workingDir: result });
    }
  }, [editingApp]);

  const handleAddCategory = useCallback(() => {
    setEditingCategory(null);
    setNewCategoryName('');
    setShowCategoryDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleEditCategory = useCallback((category: QuickLaunchCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setShowCategoryDialog(true);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleSaveCategory = useCallback(() => {
    if (newCategoryName.trim()) {
      if (editingCategory) {
        setCategories(prev => prev.map(cat => 
          cat.id === editingCategory.id ? { ...cat, name: newCategoryName } : cat
        ));
      } else {
        const colors = ['var(--color-category-1)', 'var(--color-category-2)', 'var(--color-category-3)', 'var(--color-accent)', 'var(--color-category-4)', 'var(--color-success)', 'var(--color-error)'];
        const newCategory: QuickLaunchCategory = {
          id: generateAppId(),
          name: newCategoryName,
          color: colors[categories.length % colors.length],
        };
        setCategories(prev => [...prev, newCategory]);
      }
      setShowCategoryDialog(false);
      setNewCategoryName('');
      setEditingCategory(null);
    }
  }, [newCategoryName, editingCategory, categories.length]);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    // 被删文件夹下的应用归为未分类（回到桌面，可重新归类），避免指回已删除的分类 id
    setApps(prev => prev.map(app =>
      app.categoryId === categoryId ? { ...app, categoryId: '' } : app
    ));
    if (openFolderId === categoryId) {
      setOpenFolderId(null);
    }
    handleCloseContextMenu();
  }, [openFolderId, handleCloseContextMenu]);

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
      readOnly: false,
    };
  }, [openFolderId, apps, categories, sortMode]);

  // 弹层打开时禁用桌面磁贴拖拽：其 droppable 会让 pointerWithin 误命中被遮罩挡住的磁贴
  const desktopDragDisabled = isFlatSearch || openFolder !== null;

  // 弹层内右键：智能文件夹只读不弹菜单，避免弹出空菜单
  const handlePopupContextMenu = useCallback((e: React.MouseEvent) => {
    if (!openFolder?.category) return;
    handleContextMenu(e, 'category', openFolder.category.id);
  }, [openFolder, handleContextMenu]);

  const handleFolderFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (!openFolder?.category) return;
    const filePaths = await collectDroppedPaths(e);
    if (filePaths.length > 0) {
      handleDropFiles(filePaths, openFolder.category.id);
    }
  }, [collectDroppedPaths, handleDropFiles, openFolder]);

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
      if (openFolder && openFolder.category && activeKey.startsWith('app:')) {
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

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'app' && contextMenu.targetId) {
      const app = apps.find(a => a.id === contextMenu.targetId);
      if (!app) return [];
      
      return [
        {
          id: 'open',
          label: '打开',
          icon: <Rocket className="w-4 h-4" />,
          onClick: () => handleLaunch(app.path)
        },
        // P1: 以管理员身份运行
        {
          id: 'open-as-admin',
          label: '以管理员身份运行',
          icon: <Shield className="w-4 h-4" />,
          onClick: () => {
            if (app && window.electron?.launchAppWithOptions) {
              window.electron.launchAppWithOptions({ path: app.path, runAsAdmin: true })
                .then(r => {
                  if (!r.success) addToast({ type: 'error', message: `启动失败: ${r.error ?? '未知错误'}` });
                });
            }
            handleCloseContextMenu();
          }
        },
        // P1: 打开文件位置
        {
          id: 'reveal-in-folder',
          label: '打开文件位置',
          icon: <FolderOpen className="w-4 h-4" />,
          onClick: () => {
            if (app) window.electron?.revealInFolder(app.path);
            handleCloseContextMenu();
          }
        },
        {
          id: 'copy-path',
          label: '复制路径',
          icon: <Copy className="w-4 h-4" />,
          onClick: async () => {
            if (app?.path) {
              try {
                await navigator.clipboard.writeText(app.path);
                addToast({ type: 'success', message: '路径已复制到剪贴板' });
              } catch {
                addToast({ type: 'error', message: '复制失败' });
              }
            }
            handleCloseContextMenu();
          }
        },
        {
          id: 'rename',
          label: '编辑应用',
          icon: <Edit2 className="w-4 h-4" />,
          onClick: () => handleRename(app)
        },
        // P2: 设置热键
        {
          id: 'set-hotkey',
          label: app.hotkey ? `热键: ${app.hotkey}` : '设置热键',
          icon: <Keyboard className="w-4 h-4" />,
          onClick: () => handleSetHotkey(app)
        },
        {
          id: 'add-to-home',
          label: app && isAppInHomeQuickLaunch(app.path) ? '已添加到首页' : '加到首页',
          icon: <Home className="w-4 h-4" />,
          onClick: () => {
            if (app) {
              addHomeQuickLaunchApp(app);
            }
            handleCloseContextMenu();
          }
        },
        {
          id: 'move-to-category',
          label: '移动',
          icon: <Folder className="w-4 h-4" />,
          subMenu: [
            ...(app.categoryId
              ? [{
                  id: 'category-none',
                  label: '移出文件夹（未分类）',
                  icon: <FolderPlus className="w-4 h-4" />,
                  onClick: () => handleMoveToCategory(app.id, '')
                }]
              : []),
            ...categories.map((category) => ({
              id: `category-${category.id}`,
              label: category.name,
              icon: <Tag className="w-4 h-4" />,
              onClick: () => handleMoveToCategory(app.id, category.id)
            }))
          ]
        },
        { id: 'divider1', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleRemove(app.id)
        }
      ];
    }

    if (contextMenu.type === 'category' && contextMenu.targetId) {
      const category = categories.find(c => c.id === contextMenu.targetId);
      if (!category) return [];
      
      return [
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit2 className="w-4 h-4" />,
          onClick: () => handleEditCategory(category)
        },
        { id: 'divider1', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleDeleteCategory(category.id)
        }
      ];
    }

    if (contextMenu.type === 'empty') {
      const anyScanning = isScanningDesktop || isScanningInstalled;
      const items: ContextMenuItem[] = [
        {
          id: 'add-app',
          label: '添加应用',
          icon: <FolderPlus className="w-4 h-4" />,
          onClick: handleAddApp
        },
        {
          id: 'add-category',
          label: '新建文件夹',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => handleAddCategory()
        },
        { id: 'divider-scan', divider: true },
        {
          id: 'scan-desktop',
          label: isScanningDesktop ? '正在扫描桌面…' : '扫描桌面应用',
          icon: <Monitor className="w-4 h-4" />,
          className: anyScanning ? 'opacity-50 pointer-events-none' : '',
          onClick: () => { if (!anyScanning) scanDesktop(); }
        },
        {
          id: 'scan-installed',
          label: isScanningInstalled ? '正在扫描已安装…' : '扫描已安装应用',
          icon: <AppWindow className="w-4 h-4" />,
          className: anyScanning ? 'opacity-50 pointer-events-none' : '',
          onClick: () => { if (!anyScanning) scanInstalled(); }
        },
        { id: 'divider-display', divider: true },
        {
          id: 'display',
          label: '显示设置',
          icon: <Settings className="w-4 h-4" />,
          subMenu: [
            {
              id: 'size-small',
              label: '小图标',
              icon: iconSize === 'small' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
              onClick: () => setIconSize('small')
            },
            {
              id: 'size-medium',
              label: '大图标',
              icon: iconSize === 'medium' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
              onClick: () => setIconSize('medium')
            },
            { id: 'divider-text', divider: true },
            {
              id: 'text-on',
              label: '图标 + 文字',
              icon: showText ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
              onClick: () => setShowText(true)
            },
            {
              id: 'text-off',
              label: '仅图标',
              icon: !showText ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
              onClick: () => setShowText(false)
            },
            { id: 'divider-launch', divider: true },
            {
              id: 'launch-single',
              label: '单击启动',
              icon: singleClickLaunch ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
              onClick: () => setSingleClickLaunch(true)
            },
            {
              id: 'launch-double',
              label: '双击启动',
              icon: !singleClickLaunch ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
              onClick: () => setSingleClickLaunch(false)
            }
          ]
        }
      ];

      if (apps.length > 0) {
        items.push({ id: 'divider1', divider: true });
        // P2: 修复失效应用（支持重新定位）
        items.push({
          id: 'repair-invalid',
          label: '修复失效应用',
          icon: <Wrench className="w-4 h-4" />,
          onClick: handleRepairInvalidApps
        });
        items.push({
          id: 'remove-invalid',
          label: '移除失效',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: handleRemoveInvalidApps
        });
        items.push({ id: 'divider2', divider: true });
        // P2: 配置导入 / 导出
        items.push({
          id: 'export-config',
          label: '导出配置',
          icon: <Download className="w-4 h-4" />,
          onClick: handleExportConfig
        });
        items.push({
          id: 'import-config',
          label: '导入配置',
          icon: <Upload className="w-4 h-4" />,
          onClick: handleImportConfig
        });
        items.push({ id: 'divider3', divider: true });
        items.push({
          id: 'clear-all',
          label: '清空',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: handleClearAll
        });
      }
      
      return items;
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, apps, categories, addToast, handleLaunch, handleRename, handleSetHotkey, handleMoveToCategory, handleRemove, handleEditCategory, handleDeleteCategory, handleAddApp, handleAddCategory, handleClearAll, handleRemoveInvalidApps, handleRepairInvalidApps, handleExportConfig, handleImportConfig, handleCloseContextMenu, isScanningDesktop, isScanningInstalled, scanDesktop, scanInstalled, iconSize, showText, singleClickLaunch]);

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
        
      <div className={`flex ${isCompact ? 'flex-col items-stretch gap-1 px-1 py-1' : 'items-center justify-end pl-6 pr-0 py-2'}`}>
        {/* 工具栏：仅保留排序方式选择，其余功能由右键菜单提供（与桌面文件夹交互一致） */}
        <Select
          value={sortMode}
          onChange={(v) => setSortMode(v as QuickLaunchSortMode)}
          size="sm"
          options={[
            { value: 'custom', label: '自定义' },
            { value: 'name', label: '按名称' },
            { value: 'addedAt', label: '按添加时间' },
            { value: 'launchCount', label: '按使用频率' },
            { value: 'lastLaunchedAt', label: '按最近使用' },
          ]}
          className="!w-fit quick-launch-sort !border-0 !bg-transparent hover:!bg-gray-100 dark:hover:!bg-gray-700"
        />
      </div>

      <div
        ref={dragContainerRef}
        className={`quick-launch-scroll flex-1 overflow-auto flex flex-col transition-colors duration-200 ${
          isDragOver ? 'bg-green-50 dark:bg-green-900/20' : ''
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
                readOnly={openFolder.readOnly}
                didDragRef={didDragRef}
                onLaunch={handleLaunch}
                onAppContextMenu={(e, appId) => handleContextMenu(e, 'app', appId)}
                onFolderContextMenu={handlePopupContextMenu}
                onAddApp={() => handleAddApp(openFolder.category?.id ?? '')}
                onClose={() => setOpenFolderId(null)}
                onFileDragOver={handlePopupFileDragOver}
                onFileDrop={handleFolderFileDrop}
              />
            )}

            <DndDragOverlay>
              {activeTile && (
                <div className={`flex flex-col items-center justify-center rounded-md shadow-lg bg-surface-secondary w-full ${
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
      <Modal
        isOpen={showHotkeyDialog}
        onClose={() => {
          setShowHotkeyDialog(false);
          setHotkeyTargetApp(null);
          setHotkeyInput('');
        }}
        title={hotkeyTargetApp ? `设置热键 - ${hotkeyTargetApp.name}` : '设置热键'}
        confirmText="保存"
        onConfirm={handleSaveHotkey}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-primary mb-2">
              快捷键
            </label>
            <div className="relative">
              <input
                type="text"
                value={hotkeyInput}
                onKeyDown={handleHotkeyKeyDown}
                onChange={() => {}}
                placeholder="按下组合键（如 Ctrl+Alt+1），Esc 清除"
                readOnly
                className="w-full px-4 py-2 border-content rounded-lg bg-surface-secondary text-content-primary placeholder-text-content-secondary focus:outline-none focus:border-[var(--color-primary)]"
                style={{ borderWidth: '1px', borderColor: 'var(--color-border)' }}
              />
              {hotkeyInput && (
                <button
                  type="button"
                  onClick={() => setHotkeyInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-content-tertiary hover:text-content-secondary rounded transition-colors"
                  title="清空"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-content-secondary mt-2">
              支持修饰键: Ctrl / Alt / Shift / Win + 字母或数字。按 Esc 清除当前输入，留空保存则取消绑定。
            </p>
          </div>
          {hotkeyTargetApp?.hotkey && (
            <div className="text-sm text-content-primary">
              当前热键: <span className="font-mono font-semibold">{hotkeyTargetApp.hotkey}</span>
            </div>
          )}
        </div>
      </Modal>

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
      <Modal
        isOpen={showInvalidDialog}
        onClose={() => {
          setShowInvalidDialog(false);
          setInvalidApps([]);
        }}
        title={`修复失效应用 (${invalidApps.length})`}
        confirmText="关闭"
        onConfirm={() => {
          setShowInvalidDialog(false);
          setInvalidApps([]);
        }}
      >
        <div className="space-y-2 max-h-96 overflow-auto">
          {invalidApps.map(app => (
            <div key={app.id} className="flex items-center justify-between gap-2 p-2 rounded border border-content">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary truncate">{app.name}</p>
                <p className="text-xs text-content-secondary truncate">{app.path}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRelocateApp(app.id)}
                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                  title="重新定位"
                >
                  <FolderOpen size={16} />
                </button>
                <button
                  onClick={() => handleRemoveFromInvalid(app.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  title="移除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};

export default QuickLaunch;