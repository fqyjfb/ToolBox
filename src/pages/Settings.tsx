import { useState, useEffect } from 'react';
import { useToastStore } from '../store/toastStore';
import { useSidebarStore } from '../store/sidebarStore';
import { 
  loadApps, 
  loadCategories, 
  getDefaultCategoryId, 
  scanAndAddDesktopApps 
} from '../utils/quickLaunch';
import { 
  Monitor, 
  Bell, 
  Settings as SettingsIcon,
  Trash2,
  Keyboard,
  Info
} from 'lucide-react';
import './Settings.css';

interface SettingItem {
  name: string;
  value: any;
}

interface ShortcutItem {
  id: number;
  tag: string;
  cmd: string;
  isOpen: number;
  isGlobal: number;
}

const defaultShortcutsData: ShortcutItem[] = [
  { id: 1, tag: '退出软件', cmd: 'CommandOrControl+Q', isOpen: 1, isGlobal: 1 },
  { id: 2, tag: '隐藏/显示 软件窗口', cmd: 'CommandOrControl+H', isOpen: 1, isGlobal: 1 },
  { id: 3, tag: '隐藏/显示 侧边导航', cmd: 'CommandOrControl+B', isOpen: 1, isGlobal: 0 },
  { id: 4, tag: '打开设置', cmd: 'CommandOrControl+S', isOpen: 1, isGlobal: 0 },
  { id: 5, tag: '取消/设置 窗口置顶', cmd: 'CommandOrControl+T', isOpen: 1, isGlobal: 0 },
  { id: 6, tag: '恢复默认窗口', cmd: 'CommandOrControl+O', isOpen: 1, isGlobal: 0 },
  { id: 7, tag: '刷新当前页面', cmd: 'CommandOrControl+R', isOpen: 1, isGlobal: 0 },
  { id: 8, tag: '最小化窗口', cmd: 'CommandOrControl+[', isOpen: 1, isGlobal: 0 },
  { id: 9, tag: '最大化窗口', cmd: 'CommandOrControl+]', isOpen: 1, isGlobal: 0 },
];

const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  checkedLabel?: string;
  uncheckedLabel?: string;
}> = ({ enabled, onChange, checkedLabel, uncheckedLabel }) => {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-1.5 focus:ring-offset-1.5 focus:ring-primary ${ 
          enabled ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700' 
        }`}
      >
        <span 
          className={`inline-block w-3 h-3 transform rounded-full transition-transform ${ 
            enabled ? 'translate-x-5' : 'translate-x-1' 
          }`}
          style={{ backgroundColor: 'white' }}
        />
      </button>
      <span className="text-xs text-gray-500">
        {enabled ? checkedLabel || '开启' : uncheckedLabel || '关闭'}
      </span>
    </div>
  );
};

const RadioGroup: React.FC<{
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}> = ({ value, options, onChange }) => {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1 text-xs rounded-md transition-colors ${
            value === option.value
              ? 'bg-primary text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};



const ShortcutRow: React.FC<{
  shortcut: ShortcutItem;
  onUpdate: (shortcut: ShortcutItem) => void;
}> = ({ shortcut, onUpdate }) => {
  const [currentKey, setCurrentKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const displayKey = currentKey || shortcut.cmd.replace(/CommandOrControl/gi, 'Ctrl');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const modifiers: string[] = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
    if (e.altKey) modifiers.push('Alt');
    if (e.shiftKey) modifiers.push('Shift');

    if (modifiers.length >= 3 || modifiers.length < 1) return;

    let key = e.key === ' ' ? 'Space' : capitalize(e.key);
    key = key.replace(/^Arrow/, '');

    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;

    const newShortcut = [...modifiers, key].join('+');
    setCurrentKey(newShortcut);
  };

  const handleKeyUp = () => {
    if (currentKey) {
      const cmdKey = currentKey.replace(/Ctrl/gi, 'CommandOrControl');
      const updatedShortcut = { ...shortcut, cmd: cmdKey };
      onUpdate(updatedShortcut);
      setIsEditing(false);
    } else {
      setCurrentKey('');
    }
  };

  const capitalize = (str: string) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const handleToggle = () => {
    const updatedShortcut = { ...shortcut, isOpen: shortcut.isOpen === 1 ? 0 : 1 };
    onUpdate(updatedShortcut);
  };

return (
    <div className={`flex items-center justify-between py-1 px-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isEditing ? 'bg-gray-100 dark:bg-gray-700' : ''}`}>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {shortcut.isGlobal === 1 && <span className="mr-2">🌐</span>}
          {shortcut.tag}
        </span>
      </div>
      <div className="w-48 mr-4">
        <input
          type="text"
          value={displayKey}
          onFocus={() => { setIsEditing(true); setCurrentKey(''); }}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onBlur={() => setIsEditing(false)}
          className={`w-full px-3 py-1.5 text-sm text-center border rounded-md transition-colors ${
            isEditing
              ? 'border-primary bg-gray-50 dark:bg-gray-700 outline-none'
              : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 cursor-pointer'
          } text-gray-700 dark:text-gray-300`}
          placeholder="按快捷键"
        />
      </div>
      <button
        onClick={handleToggle}
        className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors focus:outline-none focus:ring-1.5 focus:ring-offset-1.5 focus:ring-primary ${
          shortcut.isOpen === 1 ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
        }`}
      >
        <span
          className={`inline-block w-3 h-3 transform rounded-full transition-transform ${
            shortcut.isOpen === 1 ? 'translate-x-5' : 'translate-x-1'
          }`}
          style={{ backgroundColor: 'white' }}
        />
      </button>
    </div>
  );
};

const Settings: React.FC = () => {
  const { addToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<'general' | 'quickLaunch' | 'notifications' | 'shortcuts'>('general');
  
  const [browserMode, setBrowserMode] = useState<'internal' | 'external'>('internal');
  const [isScanning, setIsScanning] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [notifications, setNotifications] = useState({
    toolComplete: true,
    updates: true,
    errors: true,
  });
  
  const [isEdgeAdsorption, setIsEdgeAdsorption] = useState(false);
  const [isMemoryOptimizationEnabled, setIsMemoryOptimizationEnabled] = useState(false);
  const [defaultWindowSize, setDefaultWindowSize] = useState({ width: 1024, height: 800 });
  
  const { isVisible: isMenuVisible, position: leftMenuPosition, setVisible, setPosition } = useSidebarStore();
  const [btnLoading, setBtnLoading] = useState(false);
  const [btnText, setBtnText] = useState('清除缓存');
  
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);

  useEffect(() => {
    const savedBrowserMode = localStorage.getItem('toolbox_browser_mode') as 'internal' | 'external';
    if (savedBrowserMode) {
      setBrowserMode(savedBrowserMode);
    }
    
    loadSettings();
    loadShortcuts();
  }, []);

  const loadSettings = async () => {
    try {
      if (window.electron) {
        const settings: SettingItem[] = await window.electron.getSettings();
        const getValue = (name: string) => {
          const item = settings.find(s => s.name === name);
          if (item === undefined) return undefined;
          if (typeof item.value === 'number') return item.value !== 0;
          if (typeof item.value === 'string' && item.value === '0') return false;
          return item.value;
        };
        
        setIsEdgeAdsorption(getValue('isWindowEdgeAdsorption') || false);
        setIsMemoryOptimizationEnabled(getValue('isMemoryOptimizationEnabled') || false);
        setVisible(getValue('isMenuVisible') !== false);
        setPosition(((getValue('leftMenuPosition') as string) || 'left') as 'left' | 'right');
        setDefaultWindowSize((getValue('defaultWindowSize') as { width: number; height: number }) || { width: 1024, height: 800 });
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
        setShortcuts(defaultShortcutsData);
      }
    } catch (error) {
      console.error('Failed to load shortcuts:', error);
      setShortcuts(defaultShortcutsData);
    }
  };

  const handleAutostartToggle = async (enable: boolean) => {
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name: 'isAutoLaunch', value: enable ? 1 : 0 });
        setAutostartEnabled(enable);
        addToast({ 
          type: 'success', 
          message: `设置已更新，请重新启动` 
        });
      }
    } catch (error) {
      console.error('Failed to set autostart status:', error);
      addToast({ 
        type: 'error', 
        message: '设置失败，请重试' 
      });
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
        addToast({ 
          type: 'success', 
          message: `成功添加 ${result.addedCount} 个应用到快启动` 
        });
      }
      
      if (result.skippedCount > 0) {
        addToast({ 
          type: 'info', 
          message: `${result.skippedCount} 个应用已存在，已跳过` 
        });
      }
      
      if (result.addedCount === 0 && result.skippedCount === 0) {
        addToast({ 
          type: 'info', 
          message: '桌面上未找到可添加的应用程序' 
        });
      }
    } catch (error) {
      addToast({ 
        type: 'error', 
        message: '扫描桌面应用失败，请重试' 
      });
      console.error('Error scanning desktop apps:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    addToast({ 
      type: 'success', 
      message: `通知设置已更新` 
    });
  };

  const handleSettingUpdate = async (name: string, value: any) => {
    try {
      if (window.electron) {
        await window.electron.updateSetting({ name, value });
        addToast({ 
          type: 'success', 
          message: '设置已更新，请重新启动' 
        });
      }
    } catch (error) {
      console.error('Failed to update setting:', error);
      addToast({ 
        type: 'error', 
        message: '设置失败，请重试' 
      });
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

  const handleMenuVisibleChange = (val: boolean) => {
    setVisible(val);
    handleSettingUpdate('isMenuVisible', val ? 1 : 0);
  };

  const handleMenuPosChange = (val: string) => {
    setPosition(val as 'left' | 'right');
    handleSettingUpdate('leftMenuPosition', val);
  };

  const handleWinSizeChange = (key: 'width' | 'height', value: string) => {
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
      if (window.electron) {
        const result = await window.electron.clearCache();
        if (result.code === 0) {
          addToast({ type: 'success', message: '缓存已清除' });
        } else {
          addToast({ type: 'error', message: result.msg });
        }
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      addToast({ type: 'error', message: '清除缓存失败' });
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
        const result = await window.electron.updateShortcut({
          ...updatedShortcut,
          flag: true
        });
        if (result.code === 0) {
          setShortcuts(prev =>
            prev.map(s => (s.id === updatedShortcut.id ? updatedShortcut : s))
          );
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

  return (
    <div className="p-6 h-full overflow-hidden">
      <div className="settings-scroll-container">
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-primary border-b-2 border-primary bg-gray-50 dark:bg-gray-700/50'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <SettingsIcon size={14} className="inline mr-2" />
            通用设置
          </button>
          <button
            onClick={() => setActiveTab('quickLaunch')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              activeTab === 'quickLaunch'
                ? 'text-primary border-b-2 border-primary bg-gray-50 dark:bg-gray-700/50'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Monitor size={14} className="inline mr-2" />
            快启动设置
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              activeTab === 'notifications'
                ? 'text-primary border-b-2 border-primary bg-gray-50 dark:bg-gray-700/50'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Bell size={14} className="inline mr-2" />
            通知设置
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`px-6 py-2 text-sm font-medium transition-colors ${
              activeTab === 'shortcuts'
                ? 'text-primary border-b-2 border-primary bg-gray-50 dark:bg-gray-700/50'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Keyboard size={14} className="inline mr-2" />
            快捷键设置
          </button>
        </div>

        {activeTab === 'general' && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="w-5 h-5 flex items-center justify-center text-primary">
                <SettingsIcon size={16} />
              </div>
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">通用设置</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">启动窗口</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={defaultWindowSize.width}
                    onChange={(e) => handleWinSizeChange('width', e.target.value)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  />
                  <span className="text-gray-500">x</span>
                  <input
                    type="number"
                    value={defaultWindowSize.height}
                    onChange={(e) => handleWinSizeChange('height', e.target.value)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  />
                  <span className="text-xs text-gray-500 ml-1">px</span>
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">开机启动</span>
                <ToggleSwitch enabled={autostartEnabled} onChange={handleAutostartToggle} />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">边缘吸附</span>
                <ToggleSwitch enabled={isEdgeAdsorption} onChange={handleEdgeAdsorptionChange} />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">内存优化</span>
                <ToggleSwitch enabled={isMemoryOptimizationEnabled} onChange={handleMemoryOptimizationChange} />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">显示边栏</span>
                <ToggleSwitch enabled={isMenuVisible} onChange={handleMenuVisibleChange} checkedLabel="显示" uncheckedLabel="隐藏" />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">边栏位置</span>
                <RadioGroup value={leftMenuPosition} options={[{ label: '左侧', value: 'left' }, { label: '右侧', value: 'right' }]} onChange={handleMenuPosChange} />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">主题切换</span>
                <RadioGroup 
                  value={document.body.classList.contains('dark') ? 'dark' : 'light'} 
                  options={[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }]} 
                  onChange={(value) => {
                    if (value === 'dark') {
                      document.body.classList.add('dark');
                    } else {
                      document.body.classList.remove('dark');
                    }
                    localStorage.setItem('toolbox_theme', value);
                    addToast({ type: 'success', message: `主题已切换为${value === 'dark' ? '深色' : '浅色'}` });
                  }} 
                />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">外部链接</span>
                <RadioGroup 
                  value={browserMode} 
                  options={[{ label: '程序弹窗', value: 'internal' }, { label: '默认浏览器', value: 'external' }]} 
                  onChange={(value) => {
                    const mode = value as 'internal' | 'external';
                    setBrowserMode(mode);
                    localStorage.setItem('toolbox_browser_mode', mode);
                    addToast({ type: 'success', message: `浏览器设置已更新为${mode === 'internal' ? '程序弹窗' : '默认浏览器'}` });
                  }} 
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 mt-4">
            <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="w-5 h-5 flex items-center justify-center text-blue-600">
                <Trash2 size={16} />
              </div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">缓存管理</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">清除缓存</span>
                <button
                  onClick={handleClearCache}
                  disabled={btnLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    btnLoading
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  }`}
                >
                  <Trash2 size={14} />
                  {btnText}
                </button>
              </div>
            </div>
          </div>
          </>
        )}

        {activeTab === 'quickLaunch' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="w-5 h-5 flex items-center justify-center text-primary">
                <Monitor size={16} />
              </div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">快启动设置</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">扫描桌面应用</span>
                <button
                  onClick={handleScanDesktopApps}
                  disabled={isScanning}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    isScanning
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  <Monitor size={14} />
                  {isScanning ? '扫描中...' : '扫描桌面'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="w-5 h-5 flex items-center justify-center text-primary">
                <Bell size={16} />
              </div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">通知设置</h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">工具执行完成通知</span>
                <ToggleSwitch 
                  enabled={notifications.toolComplete} 
                  onChange={() => handleNotificationToggle('toolComplete')} 
                />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">系统更新通知</span>
                <ToggleSwitch 
                  enabled={notifications.updates} 
                  onChange={() => handleNotificationToggle('updates')} 
                />
              </div>
              <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <span className="text-sm text-gray-700 dark:text-gray-300">错误通知</span>
                <ToggleSwitch 
                  enabled={notifications.errors} 
                  onChange={() => handleNotificationToggle('errors')} 
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shortcuts' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="w-5 h-5 flex items-center justify-center text-primary">
                <Keyboard size={16} />
              </div>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">快捷键设置</h2>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Info size={14} className="text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p>1. 🌐标记为全局快捷键，程序失去焦点后也能使用</p>
                  <p>2. 在macOS系统：Ctrl === Command键，Alt === Option键</p>
                  <p>3. 自定义快捷键时，先点击输入框获取焦点，然后按下新的快捷键组合</p>
                </div>
              </div>
            </div>
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2">
              <div className="flex items-center">
                <div className="flex-1 text-sm font-medium text-gray-600 dark:text-gray-400">功能描述</div>
                <div className="w-48 text-center text-sm font-medium text-gray-600 dark:text-gray-400">自定义快捷键</div>
                <div className="w-12 text-center text-sm font-medium text-gray-600 dark:text-gray-400">状态</div>
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {shortcuts.map(shortcut => (
                <ShortcutRow
                  key={shortcut.id}
                  shortcut={shortcut}
                  onUpdate={handleUpdateShortcut}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;