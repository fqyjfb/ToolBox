import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Monitor, Bell, Keyboard, Circle } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { loadApps, loadCategories, getDefaultCategoryId, scanAndAddDesktopApps, QuickLaunchItem } from '../../utils/quickLaunch';
import {
  ShortcutItem,
  FloatConfigItem,
  NotificationSettings,
  WindowSize,
  SettingsTab
} from '../../types/settings';
import { DEFAULT_SHORTCUTS, DEFAULT_WINDOW_SIZE } from '../../constants/settings';
import {
  GeneralTab,
  QuickLaunchTab,
  NotificationsTab,
  ShortcutsTab,
  FloatWindowTab
} from '../../components/settings';
import './Settings.css';

const Settings: React.FC = () => {
  const addToast = useToastStore(state => state.addToast);
  const { isVisible: isMenuVisible, position: leftMenuPosition, setVisible, setPosition } = useSidebarStore();

  // State management
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [browserMode, setBrowserMode] = useState<'internal' | 'external'>('internal');
  const [isScanning, setIsScanning] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [notifications, setNotifications] = useState<NotificationSettings>({
    toolComplete: true,
    updates: true,
    errors: true
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

  // Initialize data
  useEffect(() => {
    const savedBrowserMode = localStorage.getItem('toolbox_browser_mode') as 'internal' | 'external';
    if (savedBrowserMode) {
      setBrowserMode(savedBrowserMode);
    }

    loadSettings();
    loadShortcuts();
    loadFloatConfig();
    loadQuickLaunchApps();
  }, []);

  // Data loading functions
  const loadFloatConfig = async () => {
    try {
      if (window.electron) {
        const config = await window.electron.getFloatConfig();
        setFloatConfig(config);
      }
    } catch (error) {
      console.error('Failed to load float config:', error);
    }
  };

  const loadQuickLaunchApps = () => {
    const apps = loadApps();
    setQuickLaunchApps(apps);
  };

  const loadSettings = async () => {
    try {
      if (window.electron) {
        const settings = await window.electron.getSettings();
        const getValue = (name: string) => {
          const item = settings.find(s => s.name === name);
          if (item === undefined) return undefined;
          if (typeof item.value === 'number') return item.value !== 0;
          if (typeof item.value === 'string' && item.value === '0') return false;
          return item.value;
        };

        setIsEdgeAdsorption(getValue('isWindowEdgeAdsorption') || false);
        setIsMemoryOptimizationEnabled(getValue('isMemoryOptimizationEnabled') || false);
        setIsFloatWindowEnabled(getValue('isFloatWindowEnabled') || false);
        setVisible(getValue('isMenuVisible') !== false);
        setPosition(((getValue('leftMenuPosition') as string) || 'left') as 'left' | 'right');
        setDefaultWindowSize((getValue('defaultWindowSize') as WindowSize) || DEFAULT_WINDOW_SIZE);
        setAutostartEnabled(getValue('isAutoLaunch') || false);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadShortcuts = async () => {
    try {
      if (window.electron) {
        const data = await window.electron.getShortcuts();
        setShortcuts(data);
      } else {
        setShortcuts(DEFAULT_SHORTCUTS);
      }
    } catch (error) {
      console.error('Failed to load shortcuts:', error);
      setShortcuts(DEFAULT_SHORTCUTS);
    }
  };

  // Event handlers
  const handleAutostartToggle = async (enabled: boolean) => {
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name: 'isAutoLaunch', value: enabled ? 1 : 0 });
        setAutostartEnabled(enabled);
        addToast({ type: 'success', message: '设置已更新，请重新启动' });
      }
    } catch (error) {
      console.error('Failed to set autostart status:', error);
      addToast({ type: 'error', message: '设置失败，请重试' });
    }
  };

  const handleScanDesktopApps = async () => {
    setIsScanning(true);
    addToast({ type: 'info', message: '正在扫描桌面应用...' });

    try {
      const existingApps = loadApps();
      const categories = loadCategories();
      const defaultCategoryId = getDefaultCategoryId(categories);

      const result = await scanAndAddDesktopApps(existingApps, defaultCategoryId);

      if (result.addedCount > 0) {
        addToast({ type: 'success', message: `成功添加 ${result.addedCount} 个应用到快启动` });
      }

      if (result.skippedCount > 0) {
        addToast({ type: 'info', message: `${result.skippedCount} 个应用已存在，已跳过` });
      }

      if (result.addedCount === 0 && result.skippedCount === 0) {
        addToast({ type: 'info', message: '桌面上未找到可添加的应用程序' });
      }
    } catch (error) {
      addToast({ type: 'error', message: '扫描桌面应用失败，请重试' });
      console.error('Error scanning desktop apps:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleNotificationToggle = (key: keyof NotificationSettings) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    addToast({ type: 'success', message: '通知设置已更新' });
  };

  const handleSettingUpdate = async (name: string, value: any) => {
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name, value });
        addToast({ type: 'success', message: '设置已更新，请重新启动' });
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
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
      console.error('Failed to toggle float window:', error);
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
    handleSettingUpdate('defaultWindowSize', newSize);
  };

  const handleClearCache = async () => {
    setBtnLoading(true);
    setBtnText('正在清除缓存');
    try {
      const quickLaunchApps = localStorage.getItem('quickLaunchApps');
      const quickLaunchCategories = localStorage.getItem('quickLaunchCategories');
      const homeTools = localStorage.getItem('homeTools');
      const homeQuickLaunchApps = localStorage.getItem('homeQuickLaunchApps');

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
        if (quickLaunchApps) localStorage.setItem('quickLaunchApps', quickLaunchApps);
        if (quickLaunchCategories) localStorage.setItem('quickLaunchCategories', quickLaunchCategories);
        if (homeTools) localStorage.setItem('homeTools', homeTools);
        if (homeQuickLaunchApps) localStorage.setItem('homeQuickLaunchApps', homeQuickLaunchApps);
        addToast({ type: 'success', message: '缓存已清除' });
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
      console.error('Failed to update shortcut:', error);
      addToast({ type: 'error', message: '更新快捷键失败' });
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
      console.error('Failed to save float config:', error);
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
      console.error('Failed to reset float config:', error);
      addToast({ type: 'error', message: '重置失败，请重试' });
    }
  };

  const handleBrowserModeChange = (value: string) => {
    const mode = value as 'internal' | 'external';
    setBrowserMode(mode);
    localStorage.setItem('toolbox_browser_mode', mode);
    addToast({ type: 'success', message: `浏览器设置已更新为${mode === 'internal' ? '程序弹窗' : '默认浏览器'}` });
  };

  // Tab config
  const tabs = [
    { id: 'general' as const, label: '通用设置', icon: SettingsIcon },
    { id: 'quickLaunch' as const, label: '快启动设置', icon: Monitor },
    { id: 'notifications' as const, label: '通知设置', icon: Bell },
    { id: 'shortcuts' as const, label: '快捷键设置', icon: Keyboard },
    { id: 'floatWindow' as const, label: '悬浮窗设置', icon: Circle }
  ];

  return (
    <div className="p-6 h-full overflow-hidden">
      <div className="settings-scroll-container">
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-gray-50 dark:bg-gray-700/50'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
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
            onAutostartToggle={handleAutostartToggle}
            onEdgeAdsorptionChange={handleEdgeAdsorptionChange}
            onMemoryOptimizationChange={handleMemoryOptimizationChange}
            onFloatWindowChange={handleFloatWindowChange}
            onMenuVisibleChange={handleMenuVisibleChange}
            onMenuPositionChange={handleMenuPositionChange}
            onWindowSizeChange={handleWindowSizeChange}
            onClearCache={handleClearCache}
            onBrowserModeChange={handleBrowserModeChange}
            btnLoading={btnLoading}
            btnText={btnText}
          />
        )}

        {activeTab === 'quickLaunch' && (
          <QuickLaunchTab
            isScanning={isScanning}
            onScanDesktopApps={handleScanDesktopApps}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsTab
            notifications={notifications}
            onNotificationToggle={handleNotificationToggle}
          />
        )}

        {activeTab === 'shortcuts' && (
          <ShortcutsTab
            shortcuts={shortcuts}
            onUpdateShortcut={handleUpdateShortcut}
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
      </div>
    </div>
  );
};

export default Settings;
