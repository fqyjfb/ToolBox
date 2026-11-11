import {
  Rocket, FolderPlus, Edit2, Trash2, Plus, Tag, Folder, Home,
  Monitor, Copy, AppWindow, Shield, FolderOpen, Keyboard,
  Download, Upload, Wrench, Check, Settings, ArrowUpDown, Lock, Unlock,
} from 'lucide-react';
import type { QuickLaunchItem, QuickLaunchCategory, QuickLaunchSortMode } from '../../../utils/quickLaunch';
import type { ContextMenuItem } from '../../../components/ui/ContextMenu';
import { isAppInHomeQuickLaunch, addHomeQuickLaunchApp } from '../../../utils/quickLaunch';

interface BuildParams {
  type: string | undefined;
  targetId: string | null | undefined;
  apps: QuickLaunchItem[];
  categories: QuickLaunchCategory[];
  iconSize: 'small' | 'medium';
  showText: boolean;
  singleClickLaunch: boolean;
  sortMode: QuickLaunchSortMode;
  setSortMode: (mode: QuickLaunchSortMode) => void;
  isScanningDesktop: boolean;
  isScanningInstalled: boolean;
  addToast: (msg: { type: 'success' | 'error' | 'warning' | 'info'; message: string; duration?: number }) => void;
  handleLaunch: (path: string) => void;
  handleRename: (app: QuickLaunchItem) => void;
  handleSetHotkey: (app: QuickLaunchItem) => void;
  handleMoveToCategory: (appId: string, categoryId: string) => void;
  handleRemove: (appId: string) => void;
  handleEditCategory: (cat: QuickLaunchCategory) => void;
  handleDeleteCategory: (catId: string) => void;
  handleAddApp: () => void;
  handleAddCategory: () => void;
  handleClearAll: () => void;
  handleRemoveInvalidApps: () => void;
  handleRepairInvalidApps: () => void;
  handleExportConfig: () => void;
  handleImportConfig: () => void;
  handleCloseContextMenu: () => void;
  scanDesktop: () => void;
  scanInstalled: () => void;
  setIconSize: (size: 'small' | 'medium') => void;
  setShowText: (show: boolean) => void;
  setSingleClickLaunch: (single: boolean) => void;
  /** 应用锁联动（与设置页 AppLockTab 共享同一份 store 状态） */
  isAppLocked: (path: string) => boolean;
  onToggleAppLock: (app: QuickLaunchItem) => void;
}

/** 生成 QuickLaunch 右键菜单项（原内联在 QuickLaunch.tsx getContextMenuItems 中） */
export function buildContextMenuItems(params: BuildParams): ContextMenuItem[] {
  const {
    type, targetId, apps, categories, iconSize, showText, singleClickLaunch,
    sortMode, setSortMode,
    isScanningDesktop, isScanningInstalled,
    addToast, handleLaunch, handleRename, handleSetHotkey, handleMoveToCategory,
    handleRemove, handleEditCategory, handleDeleteCategory,
    handleAddApp, handleAddCategory, handleClearAll,
    handleRemoveInvalidApps, handleRepairInvalidApps,
    handleExportConfig, handleImportConfig, handleCloseContextMenu,
    scanDesktop, scanInstalled, setIconSize, setShowText, setSingleClickLaunch,
    isAppLocked, onToggleAppLock,
  } = params;

  // ── 应用右键菜单 ──────────────────────────────────────────────────────
  if (type === 'app' && targetId) {
    const app = apps.find(a => a.id === targetId);
    if (!app) return [];

    return [
      {
        id: 'open',
        label: '打开',
        icon: <Rocket className="w-4 h-4" />,
        onClick: () => handleLaunch(app.path),
      },
      {
        id: 'open-as-admin',
        label: '以管理员身份运行',
        icon: <Shield className="w-4 h-4" />,
        onClick: () => {
          if (window.electron?.launchAppWithOptions) {
            window.electron.launchAppWithOptions({ path: app.path, runAsAdmin: true })
              .then(r => {
                if (!r.success) addToast({ type: 'error', message: `启动失败: ${r.error ?? '未知错误'}` });
              });
          }
          handleCloseContextMenu();
        },
      },
      {
        id: 'reveal-in-folder',
        label: '打开文件位置',
        icon: <FolderOpen className="w-4 h-4" />,
        onClick: () => {
          window.electron?.revealInFolder(app.path);
          handleCloseContextMenu();
        },
      },
      {
        id: 'copy-path',
        label: '复制路径',
        icon: <Copy className="w-4 h-4" />,
        onClick: async () => {
          if (app.path) {
            try {
              await navigator.clipboard.writeText(app.path);
              addToast({ type: 'success', message: '路径已复制到剪贴板' });
            } catch {
              addToast({ type: 'error', message: '复制失败' });
            }
          }
          handleCloseContextMenu();
        },
      },
      {
        id: 'rename',
        label: '编辑应用',
        icon: <Edit2 className="w-4 h-4" />,
        onClick: () => handleRename(app),
      },
      {
        id: 'set-hotkey',
        label: app.hotkey ? `热键: ${app.hotkey}` : '设置热键',
        icon: <Keyboard className="w-4 h-4" />,
        onClick: () => handleSetHotkey(app),
      },
      {
        id: 'add-to-home',
        label: isAppInHomeQuickLaunch(app.path) ? '已添加到首页' : '加到首页',
        icon: <Home className="w-4 h-4" />,
        onClick: () => {
          addHomeQuickLaunchApp(app);
          handleCloseContextMenu();
        },
      },
      {
        id: 'toggle-app-lock',
        label: isAppLocked(app.path) ? '取消应用锁' : '添加应用锁',
        icon: isAppLocked(app.path) ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />,
        onClick: () => {
          onToggleAppLock(app);
          handleCloseContextMenu();
        },
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
                onClick: () => handleMoveToCategory(app.id, ''),
              }]
            : []),
          ...categories.map(category => ({
            id: `category-${category.id}`,
            label: category.name,
            icon: <Tag className="w-4 h-4" />,
            onClick: () => handleMoveToCategory(app.id, category.id),
          })),
        ],
      },
      { id: 'divider1', divider: true },
      {
        id: 'delete',
        label: '删除',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => handleRemove(app.id),
      },
    ];
  }

  // ── 文件夹右键菜单 ────────────────────────────────────────────────────
  if (type === 'category' && targetId) {
    const category = categories.find(c => c.id === targetId);
    if (!category) return [];

    return [
      {
        id: 'edit',
        label: '编辑',
        icon: <Edit2 className="w-4 h-4" />,
        onClick: () => handleEditCategory(category),
      },
      { id: 'divider1', divider: true },
      {
        id: 'delete',
        label: '删除',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => handleDeleteCategory(category.id),
      },
    ];
  }

  // ── 空白区域右键菜单 ──────────────────────────────────────────────────
  if (type === 'empty') {
    const anyScanning = isScanningDesktop || isScanningInstalled;
    const items: ContextMenuItem[] = [
      {
        id: 'sort-by',
        label: '排序',
        icon: <ArrowUpDown className="w-4 h-4" />,
        subMenu: [
          {
            id: 'sort-custom',
            label: '自定义',
            icon: sortMode === 'custom' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setSortMode('custom'),
          },
          {
            id: 'sort-name',
            label: '按名称',
            icon: sortMode === 'name' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setSortMode('name'),
          },
          {
            id: 'sort-added',
            label: '按添加时间',
            icon: sortMode === 'addedAt' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setSortMode('addedAt'),
          },
          {
            id: 'sort-launch-count',
            label: '按使用频率',
            icon: sortMode === 'launchCount' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setSortMode('launchCount'),
          },
          {
            id: 'sort-last-launched',
            label: '按最近使用',
            icon: sortMode === 'lastLaunchedAt' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setSortMode('lastLaunchedAt'),
          },
        ],
      },
      { id: 'divider-sort', divider: true },
      {
        id: 'add-app',
        label: '添加应用',
        icon: <FolderPlus className="w-4 h-4" />,
        onClick: handleAddApp,
      },
      {
        id: 'add-category',
        label: '新建文件夹',
        icon: <Plus className="w-4 h-4" />,
        onClick: () => handleAddCategory(),
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
            onClick: () => setIconSize('small'),
          },
          {
            id: 'size-medium',
            label: '大图标',
            icon: iconSize === 'medium' ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setIconSize('medium'),
          },
          { id: 'divider-text', divider: true },
          {
            id: 'text-on',
            label: '图标 + 文字',
            icon: showText ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setShowText(true),
          },
          {
            id: 'text-off',
            label: '仅图标',
            icon: !showText ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setShowText(false),
          },
          { id: 'divider-launch', divider: true },
          {
            id: 'launch-single',
            label: '单击启动',
            icon: singleClickLaunch ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setSingleClickLaunch(true),
          },
          {
            id: 'launch-double',
            label: '双击启动',
            icon: !singleClickLaunch ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />,
            onClick: () => setSingleClickLaunch(false),
          },
        ],
      },
      { id: 'divider-scan', divider: true },
      {
        id: 'scan-desktop',
        label: isScanningDesktop ? '正在扫描桌面…' : '扫描桌面应用',
        icon: <Monitor className="w-4 h-4" />,
        className: anyScanning ? 'opacity-50 pointer-events-none' : '',
        onClick: () => { if (!anyScanning) scanDesktop(); },
      },
      {
        id: 'scan-installed',
        label: isScanningInstalled ? '正在扫描已安装…' : '扫描已安装应用',
        icon: <AppWindow className="w-4 h-4" />,
        className: anyScanning ? 'opacity-50 pointer-events-none' : '',
        onClick: () => { if (!anyScanning) scanInstalled(); },
      },
    ];

    if (apps.length > 0) {
      items.push({ id: 'divider1', divider: true });
      items.push({
        id: 'repair-invalid',
        label: '修复失效应用',
        icon: <Wrench className="w-4 h-4" />,
        onClick: handleRepairInvalidApps,
      });
      items.push({
        id: 'remove-invalid',
        label: '移除失效',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: handleRemoveInvalidApps,
      });
      items.push({ id: 'divider2', divider: true });
      items.push({
        id: 'export-config',
        label: '导出配置',
        icon: <Download className="w-4 h-4" />,
        onClick: handleExportConfig,
      });
      items.push({
        id: 'import-config',
        label: '导入配置',
        icon: <Upload className="w-4 h-4" />,
        onClick: handleImportConfig,
      });
      items.push({ id: 'divider3', divider: true });
      items.push({
        id: 'clear-all',
        label: '清空',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: handleClearAll,
      });
    }

    return items;
  }

  return [];
}
