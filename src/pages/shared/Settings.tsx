import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Settings as SettingsIcon, Keyboard, Circle, Database, Scan, FileText, RefreshCw, Sparkles, PanelLeft } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { loadApps, QuickLaunchItem } from '../../utils/quickLaunch';
import {
  ShortcutItem,
  FloatConfigItem,
  NotificationSettings,
  WindowSize,
  SettingsTab
} from '../../types/settings';
import { DEFAULT_SHORTCUTS, DEFAULT_WINDOW_SIZE } from '../../constants/settings';
import { logError } from '../../services/loggerService';
import { localStorageService, STORAGE_KEYS } from '../../services/localStorageService';
import { isElectron } from '../../utils/environment';
import {
  GeneralTab,
  ShortcutsTab,
  FloatWindowTab,
  StorageTab,
  SyncTab,
  LogMonitorTab,
  AgnesTab
} from '../../components/settings';
const OcrTab = isElectron() ? lazy(() => import('../../components/settings/OcrTab')) : null;
import './Settings.css';

const Settings: React.FC = () => {
  const addToast = useToastStore(state => state.addToast);
  const { isVisible: isMenuVisible, position: leftMenuPosition, setVisible, setPosition } = useSidebarStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [browserMode, setBrowserMode] = useState<'internal' | 'external'>('internal');
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autoLockEnabled, setAutoLockEnabled] = useState(false);
  const [autoLockTimeout, setAutoLockTimeout] = useState(600);
  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    const saved = localStorageService.getString(STORAGE_KEYS.NOTIFICATION_ERRORS);
    return {
      errors: saved !== 'false'
    };
  });
  const [isEdgeAdsorption, setIsEdgeAdsorption] = useState(false);
  const [isMemoryOptimizationEnabled, setIsMemoryOptimizationEnabled] = useState(false);
  const [isFloatWindowEnabled, setIsFloatWindowEnabled] = useState(false);
  const [defaultWindowSize, setDefaultWindowSize] = useState<WindowSize>(DEFAULT_WINDOW_SIZE);
  const [btnLoading, setBtnLoading] = useState(false);
  const [btnText, setBtnText] = useState('清除缓存');
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [floatConfig, setFloatConfig] = useState<FloatConfigItem[]>([]);
  const [quickLaunchApps, setQuickLaunchApps] = useState<QuickLaunchItem[]>([]);

  // Data loading functions
  const loadSettings = useCallback(async () => {
    try {
      if (window.electron) {
        const settings = await window.electron.getSettings();
        const getValue = (name: string) => {
          const item = settings.find(s => s.name === name);
          if (item === undefined) return undefined;
          if (name === 'autoLockTimeout') return item.value;
          if (typeof item.value === 'number') return item.value !== 0;
          if (typeof item.value === 'string' && item.value === '0') return false;
          return item.value;
        };

        setIsEdgeAdsorption(Boolean(getValue('isWindowEdgeAdsorption')));
        setIsMemoryOptimizationEnabled(Boolean(getValue('isMemoryOptimizationEnabled')));
        setIsFloatWindowEnabled(Boolean(getValue('isFloatWindowEnabled')));
        setVisible(getValue('isMenuVisible') !== false);
        setPosition(((getValue('leftMenuPosition') as string) || 'left') as 'left' | 'right');
        const windowSize = getValue('defaultWindowSize');
        setDefaultWindowSize(typeof windowSize === 'object' ? (windowSize as WindowSize) : DEFAULT_WINDOW_SIZE);
        setAutostartEnabled(Boolean(getValue('isAutoLaunch')));
        setAutoLockEnabled(Boolean(getValue('isAutoLockEnabled')));
        const timeout = getValue('autoLockTimeout');
        if (typeof timeout === 'number' && timeout > 0) {
          setAutoLockTimeout(timeout);
        }
      }
    } catch (error) {
      logError('Failed to load settings', 'Settings', error as Error);
    }
  }, [setVisible, setPosition]);

  const loadShortcuts = useCallback(async () => {
    try {
      if (window.electron) {
        const data = await window.electron.getShortcuts();
        setShortcuts(data);
      } else {
        setShortcuts(DEFAULT_SHORTCUTS);
      }
    } catch (error) {
      logError('Failed to load shortcuts', 'Settings', error as Error);
      setShortcuts(DEFAULT_SHORTCUTS);
    }
  }, []);

  const loadFloatConfig = useCallback(async () => {
    try {
      if (window.electron) {
        const config = await window.electron.getFloatConfig();
        setFloatConfig(config);
      }
    } catch (error) {
      console.error('Failed to load float config:', error);
    }
  }, []);

  const loadQuickLaunchApps = useCallback(() => {
    const apps = loadApps();
    setQuickLaunchApps(apps);
  }, []);

  // Initialize data
  useEffect(() => {
    const savedBrowserMode = localStorageService.getString(STORAGE_KEYS.BROWSER_MODE) as 'internal' | 'external';
    if (savedBrowserMode) {
      setBrowserMode(savedBrowserMode);
    }

    loadSettings();
    loadShortcuts();
    loadFloatConfig();
    loadQuickLaunchApps();
  }, [loadSettings, loadShortcuts, loadFloatConfig, loadQuickLaunchApps]);

  
  // Event handlers
  const handleAutostartToggle = async (enabled: boolean) => {
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name: 'isAutoLaunch', value: enabled ? 1 : 0 });
        setAutostartEnabled(enabled);
        addToast({ type: 'success', message: '设置已更新，请重新启动' });
      }
    } catch (error) {
      logError('Failed to set autostart status', 'Settings', error as Error);
      addToast({ type: 'error', message: '设置失败，请重试' });
    }
  };

  const handleNotificationToggle = (key: keyof NotificationSettings) => {
    setNotifications(prev => {
      const newValue = !prev[key];
      if (key === 'errors') {
        localStorageService.setString(STORAGE_KEYS.NOTIFICATION_ERRORS, String(newValue));
      }
      return { ...prev, [key]: newValue };
    });
    addToast({ type: 'success', message: '通知设置已更新' });
  };

  const handleSettingUpdate = async (name: string, value: string | number | boolean) => {
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name, value });
        addToast({ type: 'success', message: '设置已更新，请重新启动' });
      }
    } catch (error) {
      logError('Failed to update setting', 'Settings', error as Error);
      addToast({ type: 'error', message: '设置失败，请重试' });
    }
  };

  const handleEdgeAdsorptionChange = (val: boolean) => {
    setIsEdgeAdsorption(val);
    handleSettingUpdate('isWindowEdgeAdsorption', val ? 1 : 0);
  };

  const handleMemoryOptimizationChange = (val: boolean) => {
    setIsMemoryOptimizationEnabled(val);
    handleSettingUpdate('isMemoryOptimizationEnabled', val ? 1 : 0);
  };

  const handleFloatWindowChange = async (val: boolean) => {
    setIsFloatWindowEnabled(val);
    try {
      await window.electron?.toggleFloatWindow();
      addToast({ type: 'success', message: val ? '悬浮窗已开启' : '悬浮窗已关闭' });
    } catch (error) {
      logError('Failed to toggle float window', 'Settings', error as Error);
      setIsFloatWindowEnabled(!val);
      addToast({ type: 'error', message: '操作失败，请重试' });
    }
  };

  const handleMenuVisibleChange = (val: boolean) => {
    setVisible(val);
    handleSettingUpdate('isMenuVisible', val ? 1 : 0);
  };

  const handleMenuPositionChange = (val: string) => {
    setPosition(val as 'left' | 'right');
    handleSettingUpdate('leftMenuPosition', val);
  };

  const handleWindowSizeChange = (key: 'width' | 'height', value: string) => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      addToast({ type: 'error', message: '请输入有效的正数' });
      return;
    }

    if (key === 'width') {
      if (numValue > 3000) {
        addToast({ type: 'error', message: '宽度不能超过3000px' });
        return;
      }
      if (numValue < 300) {
        addToast({ type: 'error', message: '宽度不能小于300px' });
        return;
      }
    } else {
      if (numValue > 2000) {
        addToast({ type: 'error', message: '高度不能超过2000px' });
        return;
      }
      if (numValue < 300) {
        addToast({ type: 'error', message: '高度不能小于300px' });
        return;
      }
    }

    const newSize = { ...defaultWindowSize, [key]: numValue };
    setDefaultWindowSize(newSize);
    handleSettingUpdate('defaultWindowSize', JSON.stringify(newSize));
  };

  const handleClearCache = async () => {
    setBtnLoading(true);
    setBtnText('正在清除缓存');
    try {
      if (!window.electron) {
        addToast({ type: 'error', message: '无法访问Electron API' });
        return;
      }

      if (!window.electron.clearCache) {
        addToast({ type: 'error', message: '清除缓存API不可用' });
        return;
      }

      const result = await window.electron.clearCache();

      if (result && result.code === 0) {
        localStorageService.clearAllExcept([
          STORAGE_KEYS.THEME,
          STORAGE_KEYS.BROWSER_MODE,
          STORAGE_KEYS.WEATHER_CITY,
          STORAGE_KEYS.SIDEBAR,
          STORAGE_KEYS.QUICK_LAUNCH_APPS,
          STORAGE_KEYS.QUICK_LAUNCH_CATEGORIES,
          STORAGE_KEYS.QUICK_LAUNCH_ICON_SIZE,
          STORAGE_KEYS.HOME_TOOLS,
          STORAGE_KEYS.HOME_QUICK_LAUNCH,
          STORAGE_KEYS.ACCOUNT_COLUMNS,
          STORAGE_KEYS.PLATFORM_VISIBILITY,
          STORAGE_KEYS.PLATFORM_ORDER,
          STORAGE_KEYS.WEBSITE_ACCOUNT_CATEGORY_ORDER,
          STORAGE_KEYS.OCR_SETTINGS,
          STORAGE_KEYS.NOTES_SIDEBAR_VISIBLE,
          STORAGE_KEYS.NOTES_LAST_OPENED_FILE,
        ]);
        addToast({ type: 'success', message: '缓存已清除，应用将自动重启' });
        if (window.electron?.restart) {
          setTimeout(async () => {
            try {
              await window.electron?.restart();
            } catch {
            }
          }, 1500);
        }
      } else {
        const errorMsg = result?.msg || '清除缓存失败';
        addToast({ type: 'error', message: errorMsg });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '清除缓存失败';
      addToast({ type: 'error', message: errorMessage });
    } finally {
      setTimeout(() => {
        setBtnLoading(false);
        setBtnText('清除缓存');
      }, 1000);
    }
  };

  const handleUpdateShortcut = async (updatedShortcut: ShortcutItem) => {
    try {
      if (window.electron) {
        const result = await window.electron.updateShortcut({ ...updatedShortcut, flag: true });
        if (result.code === 0) {
          setShortcuts(prev => prev.map(s => (s.id === updatedShortcut.id ? updatedShortcut : s)));
          addToast({ type: 'success', message: result.msg });
        } else {
          addToast({ type: 'error', message: result.msg });
          loadShortcuts();
        }
      }
    } catch (error) {
      logError('Failed to update shortcut', 'Settings', error as Error);
      addToast({ type: 'error', message: '更新快捷键失败' });
    }
  };

  const handleResetShortcuts = async () => {
    try {
      if (window.electron) {
        const result = await window.electron.resetShortcuts();
        if (result.code === 0) {
          loadShortcuts();
          addToast({ type: 'success', message: '已恢复默认快捷键' });
        } else {
          addToast({ type: 'error', message: result.msg });
        }
      } else {
        setShortcuts(DEFAULT_SHORTCUTS);
        addToast({ type: 'success', message: '已恢复默认快捷键' });
      }
    } catch (error) {
      logError('Failed to reset shortcuts', 'Settings', error as Error);
      addToast({ type: 'error', message: '重置快捷键失败' });
    }
  };

  const handleFloatConfigUpdate = (index: number, config: FloatConfigItem) => {
    const newConfig = [...floatConfig];
    newConfig[index] = config;
    setFloatConfig(newConfig);
  };

  const handleSaveFloatConfig = async () => {
    try {
      if (window.electron) {
        const result = await window.electron.updateFloatConfig(floatConfig);
        if (result.code === 0) {
          addToast({ type: 'success', message: result.msg });
        } else {
          addToast({ type: 'error', message: result.msg });
        }
      }
    } catch (error) {
      logError('Failed to save float config', 'Settings', error as Error);
      addToast({ type: 'error', message: '保存失败，请重试' });
    }
  };

  const handleResetFloatConfig = async () => {
    try {
      if (window.electron) {
        const result = await window.electron.resetFloatConfig();
        if (result.code === 0) {
          addToast({ type: 'success', message: result.msg });
          loadFloatConfig();
        } else {
          addToast({ type: 'error', message: result.msg });
        }
      }
    } catch (error) {
      logError('Failed to reset float config', 'Settings', error as Error);
      addToast({ type: 'error', message: '重置失败，请重试' });
    }
  };

  const handleBrowserModeChange = (value: string) => {
    const mode = value as 'internal' | 'external';
    setBrowserMode(mode);
    localStorageService.setString(STORAGE_KEYS.BROWSER_MODE, mode);
    addToast({ type: 'success', message: `浏览器设置已更新为${mode === 'internal' ? '程序弹窗' : '默认浏览器'}` });
  };

  const handleAutoLockChange = async (enabled: boolean) => {
    setAutoLockEnabled(enabled);
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name: 'isAutoLockEnabled', value: enabled ? 1 : 0 });
        addToast({ type: 'success', message: enabled ? '自动锁定已开启' : '自动锁定已关闭' });
      }
    } catch (error) {
      logError('Failed to update auto lock setting', 'Settings', error as Error);
      addToast({ type: 'error', message: '设置失败，请重试' });
    }
  };

  const handleAutoLockTimeoutChange = async (timeout: number) => {
    setAutoLockTimeout(timeout);
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name: 'autoLockTimeout', value: timeout });
        addToast({ type: 'success', message: '自动锁定时间已更新' });
      }
    } catch (error) {
      logError('Failed to update auto lock timeout', 'Settings', error as Error);
      addToast({ type: 'error', message: '设置失败，请重试' });
    }
  };

  // Tab config
  const tabs = [
    { id: 'general' as const, label: '通用设置', icon: SettingsIcon },
    { id: 'storage' as const, label: '存储管理', icon: Database },
    { id: 'sync' as const, label: '数据同步', icon: RefreshCw },
    { id: 'shortcuts' as const, label: '快捷键设置', icon: Keyboard },
    { id: 'floatWindow' as const, label: '悬浮窗设置', icon: Circle },
    ...(isElectron() ? [{ id: 'ocr' as const, label: 'OCR设置', icon: Scan }] : []),
    { id: 'agnes' as const, label: 'Agnes AI', icon: Sparkles },
    { id: 'logMonitor' as const, label: '日志监控', icon: FileText }
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <aside
        className="flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 transition-all duration-200"
        style={{ width: sidebarCollapsed ? '48px' : '145px' }}
      >
        <div className="flex flex-col flex-1 py-2 overflow-y-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors mx-1 mb-1 rounded-lg ${
                activeTab === tab.id
                  ? 'text-primary bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title={tab.label}
            >
              <tab.icon size={16} className="flex-shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{tab.label}</span>}
            </button>
          ))}
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          <button
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            <PanelLeft size={16} className="flex-shrink-0" />
            {!sidebarCollapsed && <span className="truncate">收起</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <div className="settings-scroll-container">
          {activeTab === 'general' && (
            <GeneralTab
              autostartEnabled={autostartEnabled}
              isEdgeAdsorption={isEdgeAdsorption}
              isMemoryOptimizationEnabled={isMemoryOptimizationEnabled}
              isFloatWindowEnabled={isFloatWindowEnabled}
              isMenuVisible={isMenuVisible}
              leftMenuPosition={leftMenuPosition}
              defaultWindowSize={defaultWindowSize}
              browserMode={browserMode}
              autoLockEnabled={autoLockEnabled}
              autoLockTimeout={autoLockTimeout}
              onAutostartToggle={handleAutostartToggle}
              onEdgeAdsorptionChange={handleEdgeAdsorptionChange}
              onMemoryOptimizationChange={handleMemoryOptimizationChange}
              onFloatWindowChange={handleFloatWindowChange}
              onMenuVisibleChange={handleMenuVisibleChange}
              onMenuPositionChange={handleMenuPositionChange}
              onWindowSizeChange={handleWindowSizeChange}
              onBrowserModeChange={handleBrowserModeChange}
              onAutoLockChange={handleAutoLockChange}
              onAutoLockTimeoutChange={handleAutoLockTimeoutChange}
            />
          )}

          {activeTab === 'storage' && (
            <StorageTab
              onClearCache={handleClearCache}
              btnLoading={btnLoading}
              btnText={btnText}
            />
          )}

          {activeTab === 'sync' && <SyncTab />}

          {activeTab === 'shortcuts' && (
            <ShortcutsTab
              shortcuts={shortcuts}
              onUpdateShortcut={handleUpdateShortcut}
              onResetShortcuts={handleResetShortcuts}
            />
          )}

          {activeTab === 'floatWindow' && (
            <FloatWindowTab
              floatConfig={floatConfig}
              quickLaunchApps={quickLaunchApps}
              onFloatConfigUpdate={handleFloatConfigUpdate}
              onSaveFloatConfig={handleSaveFloatConfig}
              onResetFloatConfig={handleResetFloatConfig}
            />
          )}

          {activeTab === 'ocr' && OcrTab && (
            <Suspense fallback={<div className="flex items-center justify-center py-8">加载中...</div>}>
              <OcrTab />
            </Suspense>
          )}

          {activeTab === 'logMonitor' && (
            <LogMonitorTab
              notifications={notifications}
              onNotificationToggle={handleNotificationToggle}
            />
          )}

          {activeTab === 'agnes' && <AgnesTab />}
        </div>
      </main>
    </div>
  );
};

export default Settings;
