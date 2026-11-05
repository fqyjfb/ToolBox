import { useCallback } from 'react';
import type { QuickLaunchItem, QuickLaunchCategory } from '../../../utils/quickLaunch';
import { generateAppId, getAppName } from '../../../utils/quickLaunch';

/**
 * 每次调用时返回最新状态的函数。
 * 组件内部调用 setState 后，下一次回调执行时 getState() 返回新值，
 * 避免依赖 apps 等数组作为 useCallback 依赖项导致重渲染。
 */
export interface QLState {
  apps: QuickLaunchItem[];
  categories: QuickLaunchCategory[];
  customPath: string;
  addTargetCategory: string;
  editingApp: QuickLaunchItem | null;
  editingCategory: QuickLaunchCategory | null;
  newCategoryName: string;
  openFolderId: string | null;
  desktopOrder: string[];
  hotkeyTargetApp: QuickLaunchItem | null;
  hotkeyInput: string;
}

export interface QuickLaunchActionsParams {
  apps: QuickLaunchItem[];
  categories: QuickLaunchCategory[];
  customPath: string;
  addTargetCategory: string;
  editingApp: QuickLaunchItem | null;
  editingCategory: QuickLaunchCategory | null;
  newCategoryName: string;
  openFolderId: string | null;
  desktopOrder: string[];
  hotkeyTargetApp: QuickLaunchItem | null;
  hotkeyInput: string;
  setApps: React.Dispatch<React.SetStateAction<QuickLaunchItem[]>>;
  setCategories: React.Dispatch<React.SetStateAction<QuickLaunchCategory[]>>;
  setDesktopOrder: React.Dispatch<React.SetStateAction<string[]>>;
  setOpenFolderId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingApp: React.Dispatch<React.SetStateAction<QuickLaunchItem | null>>;
  setEditingCategory: React.Dispatch<React.SetStateAction<QuickLaunchCategory | null>>;
  setNewCategoryName: React.Dispatch<React.SetStateAction<string>>;
  setShowAddDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEditDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowCategoryDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowHotkeyDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setShowClearConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  setShowInvalidDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setInvalidApps: React.Dispatch<React.SetStateAction<QuickLaunchItem[]>>;
  setHotkeyTargetApp: React.Dispatch<React.SetStateAction<QuickLaunchItem | null>>;
  setHotkeyInput: React.Dispatch<React.SetStateAction<string>>;
  setCustomPath: React.Dispatch<React.SetStateAction<string>>;
  setAddTargetCategory: React.Dispatch<React.SetStateAction<string>>;
  setContextMenu: React.Dispatch<
    React.SetStateAction<{
      isOpen: boolean;
      x: number;
      y: number;
      type: 'app' | 'category' | 'empty';
      targetId?: string;
    }>
  >;
  addToast: (msg: { type: 'success' | 'error' | 'warning' | 'info'; message: string; duration?: number }) => void;
  // 通过 window.electron API 访问的外部能力
  selectFile: () => Promise<string | null | undefined>;
  selectFolder: () => Promise<string | null | undefined>;
  getFileIcon: (path: string) => Promise<string | null | undefined>;
  openFile: (path: string) => void;
  launchAppWithOptions: (opts: { path: string; args?: string; workingDir?: string; runAsAdmin?: boolean; windowMode?: string }) => Promise<{ success: boolean; error?: string }>;
  registerQuickLaunchHotkey: (opts: { appId: string; accelerator: string; appPath: string }) => Promise<{ success: boolean; error?: string } | undefined>;
  unregisterQuickLaunchHotkey: (appId: string) => Promise<void>;
  fileExists: (path: string) => Promise<boolean | null | undefined>;
  exportQuickLaunchConfig: (content: string) => Promise<{ success: boolean; filePath?: string; error?: string } | undefined>;
  importQuickLaunchConfig: () => Promise<
    | { success: true; apps: QuickLaunchItem[]; categories: QuickLaunchCategory[] }
    | { success: false; error: string }
    | undefined
  >;
}

/** QuickLaunch 所有业务操作回调（Launch / Rename / Category / Hotkey / ImportExport 等） */
export function useQuickLaunchActions(p: QuickLaunchActionsParams) {
  const {
    addToast,
    selectFile, selectFolder, getFileIcon, openFile, launchAppWithOptions,
    registerQuickLaunchHotkey, unregisterQuickLaunchHotkey, fileExists,
    exportQuickLaunchConfig, importQuickLaunchConfig,
  } = p;
  const {
    setApps, setCategories, setDesktopOrder, setOpenFolderId,
    setEditingApp, setEditingCategory, setNewCategoryName,
    setShowAddDialog, setShowEditDialog, setShowCategoryDialog,
    setShowHotkeyDialog, setShowClearConfirm, setShowInvalidDialog, setInvalidApps,
    setHotkeyTargetApp, setHotkeyInput,
    setCustomPath, setAddTargetCategory,
    setContextMenu,
    // current-state params (read fresh each callback)
    apps, categories, customPath, addTargetCategory, editingApp,
    editingCategory, newCategoryName, openFolderId, desktopOrder,
    hotkeyTargetApp, hotkeyInput,
  } = p;

  // ── Launch ────────────────────────────────────────────────────────────────
  const handleLaunch = useCallback((path: string) => {
    const targetApp = apps.find(a => a.path === path);
    const hasOptions = targetApp && (
      targetApp.args ||
      targetApp.workingDir ||
      targetApp.runAsAdmin ||
      (targetApp.windowMode && targetApp.windowMode !== 'normal')
    );

    if (hasOptions && launchAppWithOptions) {
      launchAppWithOptions({
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
        openFile(path);
      });
    } else {
      openFile(path);
    }

    setApps(prev => prev.map(app =>
      app.path === path
        ? { ...app, launchCount: (app.launchCount ?? 0) + 1, lastLaunchedAt: Date.now() }
        : app
    ));
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [apps, setApps, setContextMenu, addToast, launchAppWithOptions, openFile]);

  // ── App CRUD ──────────────────────────────────────────────────────────────
  const handleRemove = useCallback((id: string) => {
    setApps(prev => prev.filter(app => app.id !== id));
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setApps, setContextMenu]);

  const handleAddCustom = useCallback(async () => {
    const path = customPath.trim();
    if (!path) return;
    const exists = apps.some(a => a.path.toLowerCase() === path.toLowerCase());
    if (exists) return;
    const icon = (await getFileIcon(path)) || undefined;
    setApps(prev => [...prev, {
      id: generateAppId(),
      name: getAppName(path),
      path,
      icon,
      categoryId: addTargetCategory,
      addedAt: Date.now(),
    }]);
    setCustomPath('');
    setShowAddDialog(false);
  }, [customPath, addTargetCategory, apps, getFileIcon, setApps, setCustomPath, setShowAddDialog]);

  const handleSelectFile = useCallback(async () => {
    const result = await selectFile();
    if (result) setCustomPath(result);
  }, [selectFile, setCustomPath]);

  const handleDropFiles = useCallback(async (paths: string[], targetCategoryId = '') => {
    for (const filePath of paths) {
      const lowerPath = filePath.toLowerCase();
      if (apps.some(a => a.path.toLowerCase() === lowerPath)) continue;
      const icon = (await getFileIcon(filePath)) || undefined;
      setApps(prev => [...prev, {
        id: generateAppId(),
        name: getAppName(filePath),
        path: filePath,
        icon,
        categoryId: targetCategoryId,
        addedAt: Date.now(),
      }]);
    }
  }, [apps, getFileIcon, setApps]);

  // ── Rename / Move ─────────────────────────────────────────────────────────
  const handleRename = useCallback((app: QuickLaunchItem) => {
    setEditingApp(app);
    setShowEditDialog(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setEditingApp, setShowEditDialog, setContextMenu]);

  const handleMoveToCategory = useCallback((appId: string, categoryId: string) => {
    setApps(prev => prev.map(app => app.id === appId ? { ...app, categoryId } : app));
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setApps, setContextMenu]);

  const handleSaveRename = useCallback(() => {
    if (!editingApp) return;
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
  }, [editingApp, setApps, setEditingApp, setShowEditDialog]);

  const handleSelectWorkingDir = useCallback(async () => {
    if (!editingApp) return;
    const result = await selectFolder();
    if (result) setEditingApp(prev => prev ? { ...prev, workingDir: result } : null);
  }, [editingApp, selectFolder, setEditingApp]);

  // ── Category CRUD ─────────────────────────────────────────────────────────
  const handleAddCategory = useCallback(() => {
    setEditingCategory(null);
    setNewCategoryName('');
    setShowCategoryDialog(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setEditingCategory, setNewCategoryName, setShowCategoryDialog, setContextMenu]);

  const handleEditCategory = useCallback((category: QuickLaunchCategory) => {
    setEditingCategory(category);
    setNewCategoryName(category.name);
    setShowCategoryDialog(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setEditingCategory, setNewCategoryName, setShowCategoryDialog, setContextMenu]);

  const handleSaveCategory = useCallback(() => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (editingCategory) {
      setCategories(prev => prev.map(cat =>
        cat.id === editingCategory.id ? { ...cat, name } : cat
      ));
    } else {
      const colors = ['var(--color-category-1)', 'var(--color-category-2)', 'var(--color-category-3)', 'var(--color-accent)', 'var(--color-category-4)', 'var(--color-success)', 'var(--color-error)'];
      const newCategory: QuickLaunchCategory = {
        id: generateAppId(),
        name,
        color: colors[categories.length % colors.length],
      };
      setCategories(prev => [...prev, newCategory]);
    }
    setShowCategoryDialog(false);
    setNewCategoryName('');
    setEditingCategory(null);
  }, [newCategoryName, editingCategory, categories.length, setCategories, setShowCategoryDialog, setNewCategoryName, setEditingCategory]);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
    setApps(prev => prev.map(app =>
      app.categoryId === categoryId ? { ...app, categoryId: '' } : app
    ));
    if (openFolderId === categoryId) setOpenFolderId(null);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setCategories, setApps, setOpenFolderId, openFolderId, setContextMenu]);

  // ── Context Menu ──────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'app' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, type, targetId });
  }, [setContextMenu]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setContextMenu]);

  const handleAddApp = useCallback((categoryId = '') => {
    setAddTargetCategory(categoryId);
    setShowAddDialog(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setAddTargetCategory, setShowAddDialog, setContextMenu]);

  const handleClearAll = useCallback(() => {
    setShowClearConfirm(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setShowClearConfirm, setContextMenu]);

  const confirmClearAll = useCallback(() => {
    setApps([]);
    addToast({ type: 'success', message: '已清空全部应用' });
  }, [setApps, addToast]);

  // ── Hotkey ────────────────────────────────────────────────────────────────
  const handleSetHotkey = useCallback((app: QuickLaunchItem) => {
    setHotkeyTargetApp(app);
    setHotkeyInput(app.hotkey ?? '');
    setShowHotkeyDialog(true);
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [setHotkeyTargetApp, setHotkeyInput, setShowHotkeyDialog, setContextMenu]);

  const handleHotkeyKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.key === 'Escape') { setHotkeyInput(''); return; }
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Control');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Super');
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);
    setHotkeyInput(parts.join('+'));
  }, [setHotkeyInput]);

  const handleSaveHotkey = useCallback(async () => {
    if (!hotkeyTargetApp) return;
    const input = hotkeyInput;
    if (input) {
      const result = await registerQuickLaunchHotkey?.({
        appId: hotkeyTargetApp.id,
        accelerator: input,
        appPath: hotkeyTargetApp.path,
      });
      if (result && !result.success) {
        addToast({ type: 'error', message: `注册失败: ${result.error ?? '未知错误'}` });
        return;
      }
      setApps(prev => prev.map(app =>
        app.id === hotkeyTargetApp.id ? { ...app, hotkey: input } : app
      ));
      addToast({ type: 'success', message: `快捷键已设置: ${input}` });
    } else {
      await unregisterQuickLaunchHotkey?.(hotkeyTargetApp.id);
      setApps(prev => prev.map(app =>
        app.id === hotkeyTargetApp.id ? { ...app, hotkey: undefined } : app
      ));
      addToast({ type: 'info', message: '已清除快捷键' });
    }
    setShowHotkeyDialog(false);
    setHotkeyTargetApp(null);
    setHotkeyInput('');
  }, [hotkeyTargetApp, hotkeyInput, registerQuickLaunchHotkey, unregisterQuickLaunchHotkey, setApps, setShowHotkeyDialog, setHotkeyTargetApp, setHotkeyInput, addToast]);

  // ── Config Export / Import ────────────────────────────────────────────────
  const handleExportConfig = useCallback(async () => {
    const content = JSON.stringify({ apps, categories, desktopOrder }, null, 2);
    const result = await exportQuickLaunchConfig?.(content);
    if (!result) { setContextMenu(prev => ({ ...prev, isOpen: false })); return; }
    if (result.success) {
      addToast({ type: 'success', message: `配置已导出到: ${result.filePath}` });
    } else {
      addToast({ type: 'error', message: `导出失败: ${result.error ?? '未知错误'}` });
    }
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [apps, categories, desktopOrder, exportQuickLaunchConfig, setContextMenu, addToast]);

  const handleImportConfig = useCallback(async () => {
    const result = await importQuickLaunchConfig?.();
    if (!result) { setContextMenu(prev => ({ ...prev, isOpen: false })); return; }
    if ('error' in result || !result.success) {
      addToast({ type: 'error', message: `导入失败: ${('error' in result ? result.error : '未知错误')}` });
      setContextMenu(prev => ({ ...prev, isOpen: false }));
      return;
    }
    const confirmed = window.confirm('导入将覆盖当前全部快启动配置，是否继续？');
    if (!confirmed) { setContextMenu(prev => ({ ...prev, isOpen: false })); return; }
    try {
      const importedOrder = (result as unknown as { desktopOrder?: unknown }).desktopOrder;
      const newOrder = Array.isArray(importedOrder) ? importedOrder as string[] : desktopOrder;
      setApps(result.apps);
      setCategories(result.categories);
      setDesktopOrder(newOrder);
      setOpenFolderId(null);
      addToast({ type: 'success', message: `已导入 ${result.apps.length} 个应用、${result.categories.length} 个分类` });
    } catch {
      addToast({ type: 'error', message: '数据格式错误' });
    }
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [desktopOrder, setApps, setCategories, setDesktopOrder, setOpenFolderId, setContextMenu, addToast]);

  // ── Invalid Apps ──────────────────────────────────────────────────────────
  const handleRemoveInvalidApps = useCallback(async () => {
    const invalidAppIds: string[] = [];
    for (const app of apps) {
      const exists = await fileExists?.(app.path);
      if (!exists) invalidAppIds.push(app.id);
    }
    if (invalidAppIds.length > 0) {
      setApps(prev => prev.filter(app => !invalidAppIds.includes(app.id)));
      addToast({ type: 'success', message: `已移除 ${invalidAppIds.length} 个失效应用` });
    } else {
      addToast({ type: 'info', message: '所有应用均有效，无需清理' });
    }
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [apps, fileExists, setApps, setContextMenu, addToast]);

  const handleRepairInvalidApps = useCallback(async () => {
    const invalid: QuickLaunchItem[] = [];
    for (const app of apps) {
      const exists = await fileExists?.(app.path);
      if (!exists) invalid.push(app);
    }
    if (invalid.length === 0) {
      addToast({ type: 'info', message: '所有应用均有效，无需修复' });
    } else {
      setInvalidApps(invalid);
      setShowInvalidDialog(true);
    }
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, [apps, fileExists, setInvalidApps, setShowInvalidDialog, setContextMenu, addToast]);

  const handleRelocateApp = useCallback(async (appId: string) => {
    const target = apps.find(a => a.id === appId);
    if (!target) return;
    const newPath = await selectFile();
    if (!newPath) return;
    const icon = (await getFileIcon(newPath)) || undefined;
    const originalName = getAppName(target.path);
    const shouldRename = target.name === originalName;
    setApps(prev => prev.map(app =>
      app.id === appId
        ? { ...app, path: newPath, name: shouldRename ? getAppName(newPath) : app.name, icon }
        : app
    ));
    setInvalidApps(prev => prev.filter(a => a.id !== appId));
    addToast({ type: 'success', message: '应用路径已更新' });
  }, [apps, selectFile, getFileIcon, setApps, setInvalidApps, addToast]);

  const handleRemoveFromInvalid = useCallback((appId: string) => {
    setApps(prev => prev.filter(app => app.id !== appId));
    setInvalidApps(prev => prev.filter(a => a.id !== appId));
  }, [setApps, setInvalidApps]);

  return {
    // Launch
    handleLaunch,
    // App CRUD
    handleRemove,
    handleAddCustom,
    handleSelectFile,
    handleDropFiles,
    // Rename / Move
    handleRename,
    handleMoveToCategory,
    handleSaveRename,
    handleSelectWorkingDir,
    // Category
    handleAddCategory,
    handleEditCategory,
    handleSaveCategory,
    handleDeleteCategory,
    // Context menu
    handleContextMenu,
    handleCloseContextMenu,
    handleAddApp,
    handleClearAll,
    confirmClearAll,
    // Hotkey
    handleSetHotkey,
    handleHotkeyKeyDown,
    handleSaveHotkey,
    // Config
    handleExportConfig,
    handleImportConfig,
    // Invalid apps
    handleRemoveInvalidApps,
    handleRepairInvalidApps,
    handleRelocateApp,
    handleRemoveFromInvalid,
  };
}
