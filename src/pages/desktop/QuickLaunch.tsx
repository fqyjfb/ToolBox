import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Rocket, FolderPlus, Edit2, Trash2, Plus, Tag, Folder, Home, Monitor, Type, Image as ImageIcon, Copy, Flame, Clock, AppWindow, Shield, FolderOpen, Keyboard, Download, Upload, Wrench, X } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, rectSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../../hooks/useDndSensors';
import { QuickLaunchCategory, QuickLaunchItem, QuickLaunchSortMode, addHomeQuickLaunchApp, isAppInHomeQuickLaunch, loadApps, ensureAppIconsCached, generateAppId } from '../../utils/quickLaunch';
import { useNavSearch } from '../../contexts/NavSearchContext';
import { useToastStore } from '../../store/toastStore';
import { useQuickLaunchScanStore } from '../../store/quickLaunchScanStore';
import localStorageService, { STORAGE_KEYS } from '../../services/localStorageService';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import Select from '../../components/ui/Select';
import { logDebug, logInfo, logWarn } from '../../services/loggerService';
import './QuickLaunch.css';

// 真实分类 id 判断（排除 全部/最常用/最近使用 等虚拟分类）
const isConcreteCategoryId = (id: string): boolean =>
  id !== 'all' && id !== 'frequent' && id !== 'recent';

const SortableAppItem: React.FC<{ app: QuickLaunchItem; iconSize: 'small' | 'medium'; showText: boolean; disabled?: boolean; showUnassignedBadge?: boolean; singleClick?: boolean; onLaunch: (path: string) => void; onContextMenu: (e: React.MouseEvent) => void; }> = ({ app, iconSize, showText, disabled, showUnassignedBadge, singleClick, onLaunch, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(disabled ? {} : listeners)}
      className={`flex flex-col items-center justify-center rounded-md transition-colors w-full ${
        disabled ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${iconSize === 'small' ? 'h-quick-launch-sm' : 'h-quick-launch-lg'} ${isDragging ? 'shadow-lg' : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
      onClick={() => singleClick && onLaunch(app.path)}
      onDoubleClick={() => !singleClick && onLaunch(app.path)}
      onContextMenu={onContextMenu}
    >
      <div className="relative">
        {app.icon ? (
          <img
            loading="lazy"
            draggable={false}
            src={`data:image/png;base64,${app.icon}`}
            alt={app.name}
            className={`object-contain ${showText ? 'mb-1' : ''} ${
              iconSize === 'small' ? 'w-8 h-8' : 'w-12 h-12'
            }`}
          />
        ) : (
          <Rocket className={`text-gray-500 dark:text-gray-400 ${showText ? 'mb-1' : ''} ${
            iconSize === 'small' ? 'w-8 h-8' : 'w-12 h-12'
          }`} />
        )}
        {showUnassignedBadge && !app.categoryId && (
          <span className="quick-launch-unassigned-dot" />
        )}
      </div>
      {showText && (
        <span className={`font-medium text-gray-700 dark:text-gray-200 truncate w-full text-center ${
          iconSize === 'small' ? 'text-4xs' : 'text-2xs'
        }`}>
          {app.name}
        </span>
      )}
    </div>
  );
};

const SortableCategoryItem: React.FC<{ category: QuickLaunchCategory; isActive: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void; }> = ({ category, isActive, onClick, onContextMenu }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing`}
    >
      <button
        className={`px-3 py-1 text-sm font-medium rounded-full transition-colors flex items-center gap-1 ${
          isActive
            ? 'text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
        style={isActive ? { backgroundColor: category.color } : {}}
        onClick={onClick}
        onContextMenu={onContextMenu}
      >
        <Tag size={12} />
        {category.name}
      </button>
    </div>
  );
};

const QuickLaunch: React.FC = () => {
  const { searchQuery, isSearchActive } = useNavSearch();
  const addToast = useToastStore(state => state.addToast);
  const [apps, setApps] = useState<QuickLaunchItem[]>([]);
  const [categories, setCategories] = useState<QuickLaunchCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('all');
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
        // 仅在真实分类视图下添加才归类，否则默认无分类（在"全部"下由用户自由归类）
        categoryId: isConcreteCategoryId(activeCategoryId) ? activeCategoryId : '',
        addedAt: Date.now(),
      };
      setApps(prev => [...prev, newApp]);
      setCustomPath('');
      setShowAddDialog(false);
    }
  }, [customPath, getAppName, activeCategoryId, apps]);

  const handleSelectFile = useCallback(async () => {
    const result = await window.electron?.selectFile();
    if (result) {
      setCustomPath(result);
    }
  }, []);

  const handleDropFiles = useCallback(async (paths: string[]) => {
    // 仅在真实分类视图下拖入才归类，否则默认无分类（在"全部"下由用户自由归类）
    const targetCategoryId = isConcreteCategoryId(activeCategoryId) ? activeCategoryId : '';

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
  }, [apps, activeCategoryId, getAppName]);

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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const startTime = Date.now();
    logDebug(`[QuickLaunch] 开始处理拖拽事件`, 'drag-drop');

    try {
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
  }, [handleDropFiles]);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'app' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, type, targetId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleAddApp = useCallback(() => {
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
    const content = JSON.stringify({ apps, categories }, null, 2);
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
  }, [apps, categories, addToast, handleCloseContextMenu]);

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
      setApps(newApps);
      setCategories(newCategories);
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
    // 被删分类下的应用归为无分类（在"全部"下显示，可重新归类），避免指回已删除的分类 id
    setApps(prev => prev.map(app =>
      app.categoryId === categoryId ? { ...app, categoryId: '' } : app
    ));
    if (activeCategoryId === categoryId) {
      setActiveCategoryId('all');
    }
    handleCloseContextMenu();
  }, [activeCategoryId, handleCloseContextMenu]);

  // P0: 虚拟分类与自动排序
  const filteredApps = useMemo(() => {
    let result: QuickLaunchItem[] = apps;

    // 虚拟分类：最常用 / 最近使用
    if (activeCategoryId === 'frequent') {
      result = [...result]
        .sort((a, b) => (b.launchCount ?? 0) - (a.launchCount ?? 0))
        .slice(0, 8);
    } else if (activeCategoryId === 'recent') {
      result = [...result]
        .sort((a, b) => (b.lastLaunchedAt ?? 0) - (a.lastLaunchedAt ?? 0))
        .slice(0, 8);
    } else if (activeCategoryId !== 'all') {
      result = result.filter(app => app.categoryId === activeCategoryId);
    }

    // 搜索过滤（P0 增强别名与关键词）
    if (isSearchActive && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(app =>
        app.name.toLowerCase().includes(query) ||
        app.path.toLowerCase().includes(query) ||
        (app.alias?.toLowerCase().includes(query) ?? false) ||
        (app.keywords?.toLowerCase().includes(query) ?? false)
      );
    }

    // 自动排序（虚拟分类已强制排序，跳过）
    const isVirtualCategory = activeCategoryId === 'frequent' || activeCategoryId === 'recent';
    if (!isVirtualCategory && sortMode !== 'custom') {
      const sorted = [...result];
      switch (sortMode) {
        case 'name':
          sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
          break;
        case 'addedAt':
          sorted.sort((a, b) => a.addedAt - b.addedAt);
          break;
        case 'launchCount':
          sorted.sort((a, b) => (b.launchCount ?? 0) - (a.launchCount ?? 0));
          break;
        case 'lastLaunchedAt':
          sorted.sort((a, b) => (b.lastLaunchedAt ?? 0) - (a.lastLaunchedAt ?? 0));
          break;
      }
      result = sorted;
    }

    return result;
  }, [apps, activeCategoryId, isSearchActive, searchQuery, sortMode]);

  // P0: 排序模式非自定义时禁用拖拽
  const isDragDisabled = sortMode !== 'custom' || activeCategoryId === 'frequent' || activeCategoryId === 'recent';

  const handleAppsDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeIndex = filteredApps.findIndex(app => app.id === active.id);
      const overIndex = filteredApps.findIndex(app => app.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1) {
        const reorderedIds = arrayMove(filteredApps.map(app => app.id), activeIndex, overIndex);
        
        setApps(prev => {
          const sortedApps = [...prev].sort((a, b) => {
            const indexA = reorderedIds.indexOf(a.id);
            const indexB = reorderedIds.indexOf(b.id);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
          });
          return sortedApps;
        });
      }
    }
  }, [filteredApps]);

  const handleCategoriesDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCategories(prev => {
        const oldIndex = prev.findIndex(cat => cat.id === active.id);
        const newIndex = prev.findIndex(cat => cat.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

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
          subMenu: categories.map((category) => ({
            id: `category-${category.id}`,
            label: category.name,
            icon: <Tag className="w-4 h-4" />,
            onClick: () => handleMoveToCategory(app.id, category.id)
          }))
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
      const items: ContextMenuItem[] = [
        {
          id: 'add-app',
          label: '添加应用',
          icon: <FolderPlus className="w-4 h-4" />,
          onClick: handleAddApp
        },
        {
          id: 'add-category',
          label: '添加分类',
          icon: <Plus className="w-4 h-4" />,
          onClick: handleAddCategory
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
  }, [contextMenu.type, contextMenu.targetId, apps, categories, addToast, handleLaunch, handleRename, handleSetHotkey, handleMoveToCategory, handleRemove, handleEditCategory, handleDeleteCategory, handleAddApp, handleAddCategory, handleClearAll, handleRemoveInvalidApps, handleRepairInvalidApps, handleExportConfig, handleImportConfig, handleCloseContextMenu]);

  return (
    <div
        className="h-full flex flex-col"
        onContextMenu={(e) => handleContextMenu(e, 'empty')}
      >
        
      <div className="flex items-center justify-between pl-6 pr-0 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              activeCategoryId === 'all'
                ? 'bg-primary text-button-text'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setActiveCategoryId('all')}
          >
            全部
          </button>
          {/* P0: 虚拟分类 - 最常用 / 最近使用 */}
          <button
            className={`flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              activeCategoryId === 'frequent'
                ? 'bg-primary text-button-text'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setActiveCategoryId('frequent')}
            title="按启动次数排序，取前 8"
          >
            <Flame size={12} />
            最常用
          </button>
          <button
            className={`flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full transition-colors ${
              activeCategoryId === 'recent'
                ? 'bg-primary text-button-text'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
            onClick={() => setActiveCategoryId('recent')}
            title="按最近启动时间排序，取前 8"
          >
            <Clock size={12} />
            最近使用
          </button>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleCategoriesDragEnd}
          >
            <SortableContext items={categories.map(cat => cat.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((category) => (
                  <SortableCategoryItem
                    key={category.id}
                    category={category}
                    isActive={activeCategoryId === category.id}
                    onClick={() => setActiveCategoryId(category.id)}
                    onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button
            onClick={handleAddCategory}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="添加分类"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/60 rounded-lg px-2 py-1">
          {/* P0: 自动排序模式下拉 */}
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
          <button
            onClick={scanDesktop}
            disabled={isScanningDesktop || isScanningInstalled}
            className={`icon-toggle-container ${
              isScanningDesktop || isScanningInstalled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={isScanningDesktop ? '正在扫描...' : '扫描桌面应用'}
          >
            <Monitor size={16} className={isScanningDesktop ? 'text-gray-400' : 'text-green-600 dark:text-green-500'} />
          </button>
          <button
            onClick={scanInstalled}
            disabled={isScanningInstalled || isScanningDesktop}
            className={`icon-toggle-container ${
              isScanningInstalled || isScanningDesktop ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={isScanningInstalled ? '正在扫描...' : '扫描已安装应用'}
          >
            <AppWindow size={16} className={isScanningInstalled ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'} />
          </button>
          <label className="icon-toggle-container" title={iconSize === 'small' ? '当前：小图标' : '当前：中图标'}>
            <input
              type="checkbox"
              checked={iconSize === 'medium'}
              onChange={(e) => setIconSize(e.target.checked ? 'medium' : 'small')}
            />
            <svg viewBox="0 0 448 512" width={16} height={16} className="expand-icon">
              <path d="M32 32C14.3 32 0 46.3 0 64v96c0 17.7 14.3 32 32 32s32-14.3 32-32V96h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H64V352zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32h64v64c0 17.7 14.3 32 32 32s32-14.3 32-32V64c0-17.7-14.3-32-32-32H320zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V352z" />
            </svg>
            <svg viewBox="0 0 448 512" width={16} height={16} className="compress-icon">
              <path d="M160 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v64H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32V64zM32 320c-17.7 0-32 14.3-32 32s14.3 32 32 32H96v64c0 17.7 14.3 32 32 32s32-14.3 32-32V352c0-17.7-14.3-32-32-32H32zM352 64c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7 14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H352V64zM320 320c-17.7 0-32 14.3-32 32v96c0 17.7 14.3 32 32 32s32-14.3 32-32V384h64c17.7 0 32-14.3 32-32s-14.3-32-32-32H320z" />
            </svg>
          </label>
          <button
            type="button"
            className="icon-toggle-container text-gray-400 dark:text-gray-400"
            title={showText ? '当前：图标+文字' : '当前：仅图标'}
            onClick={() => setShowText(prev => !prev)}
          >
            {showText ? <Type size={16} /> : <ImageIcon size={16} />}
          </button>
          {/* 应用打开方式：勾选=单击启动，未勾选=双击启动 */}
          <label className="launch-mode-toggle" title={singleClickLaunch ? '当前：单击启动' : '当前：双击启动'}>
            <input
              type="checkbox"
              checked={singleClickLaunch}
              onChange={(e) => setSingleClickLaunch(e.target.checked)}
            />
            <span className="checkmark" />
          </label>
        </div>
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
        {filteredApps.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleAppsDragEnd}
          >
            <SortableContext items={filteredApps.map(app => app.id)} strategy={rectSortingStrategy}>
              <div className={`grid ${iconSize === 'small' ? 'grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2 auto-rows-quick-launch-sm' : 'grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3.5 auto-rows-quick-launch-lg'} min-h-quick-launch transition-colors duration-200 ${
                isDragOver ? 'border-2 border-dashed border-green-400 rounded-lg p-4' : ''
              }`}>
                {filteredApps.map((app) => (
                  <SortableAppItem
                    key={app.id}
                    app={app}
                    iconSize={iconSize}
                    showText={showText}
                    disabled={isDragDisabled}
                    showUnassignedBadge={activeCategoryId === 'all'}
                    singleClick={singleClickLaunch}
                    onLaunch={handleLaunch}
                    onContextMenu={(e) => handleContextMenu(e, 'app', app.id)}
                  />
                ))}
              </div>
            </SortableContext>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              应用路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="输入应用程序路径..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleSelectFile}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              分类
            </label>
            <Select
              value={activeCategoryId === 'all' ? (categories[0]?.id || '') : activeCategoryId}
              onChange={() => {}}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                应用名称
              </label>
              <input
                type="text"
                value={editingApp.name}
                onChange={(e) => setEditingApp({ ...editingApp, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                别名（可选，用于搜索）
              </label>
              <input
                type="text"
                value={editingApp.alias ?? ''}
                onChange={(e) => setEditingApp({ ...editingApp, alias: e.target.value })}
                placeholder="如：PS、Photoshop"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                关键词（可选，空格分隔）
              </label>
              <input
                type="text"
                value={editingApp.keywords ?? ''}
                onChange={(e) => setEditingApp({ ...editingApp, keywords: e.target.value })}
                placeholder="如：图像 编辑 设计"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* P1: 启动选项 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">启动选项（可选）</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    启动参数
                  </label>
                  <input
                    type="text"
                    value={editingApp.args ?? ''}
                    onChange={(e) => setEditingApp({ ...editingApp, args: e.target.value })}
                    placeholder="如：--profile=Default"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    工作目录
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editingApp.workingDir ?? ''}
                      onChange={(e) => setEditingApp({ ...editingApp, workingDir: e.target.value })}
                      placeholder="应用启动时的工作目录"
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                      onClick={handleSelectWorkingDir}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                      title="选择目录"
                    >
                      <Folder size={18} className="text-gray-600 dark:text-gray-300" />
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
                    <span className="text-sm text-gray-700 dark:text-gray-300">以管理员身份运行</span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
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
        title={editingCategory ? '编辑分类' : '添加分类'}
        confirmText={editingCategory ? '保存' : '添加'}
        onConfirm={handleSaveCategory}
        confirmDisabled={!newCategoryName.trim()}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              分类名称
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="输入分类名称..."
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </Modal>

      {/* P2: 热键设置 Modal */}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-[var(--color-primary)]"
                style={{ borderWidth: '1px', borderColor: 'var(--color-border)' }}
              />
              {hotkeyInput && (
                <button
                  type="button"
                  onClick={() => setHotkeyInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
                  title="清空"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              支持修饰键: Ctrl / Alt / Shift / Win + 字母或数字。按 Esc 清除当前输入，留空保存则取消绑定。
            </p>
          </div>
          {hotkeyTargetApp?.hotkey && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
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

      {/* P2: 失效应用修复 Modal */}
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
            <div key={app.id} className="flex items-center justify-between gap-2 p-2 rounded border border-gray-200 dark:border-gray-700">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{app.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{app.path}</p>
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