import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, MapPin, Loader2 } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import ToggleSwitch from './ToggleSwitch';
import RadioGroup from './RadioGroup';
import Modal from '../ui/Modal';
import SettingCard from './SettingCard';
import SettingSection from './SettingSection';
import SettingRow from './SettingRow';
import { WindowSize } from '../../types/settings';
import { useToastStore } from '../../store/toastStore';
import { useThemeStore } from '../../store/themeStore';
import localStorageService, { STORAGE_KEYS } from '../../services/localStorageService';

interface GeneralTabProps {
  autostartEnabled: boolean;
  isEdgeAdsorption: boolean;
  isMemoryOptimizationEnabled: boolean;
  isFloatWindowEnabled: boolean;
  isMenuVisible: boolean;
  leftMenuPosition: string;
  defaultWindowSize: WindowSize;
  browserMode: string;
  autoLockEnabled: boolean;
  autoLockTimeout: number;
  onAutostartToggle: (enabled: boolean) => void;
  onEdgeAdsorptionChange: (enabled: boolean) => void;
  onMemoryOptimizationChange: (enabled: boolean) => void;
  onFloatWindowChange: (enabled: boolean) => void;
  onMenuVisibleChange: (enabled: boolean) => void;
  onMenuPositionChange: (position: string) => void;
  onWindowSizeChange: (key: 'width' | 'height', value: string) => void;
  onBrowserModeChange: (value: string) => void;
  onAutoLockChange: (enabled: boolean) => void;
  onAutoLockTimeoutChange: (timeout: number) => void;
}

const AUTO_LOCK_OPTIONS = [
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '10分钟', value: 600 },
  { label: '30分钟', value: 1800 },
  { label: '1小时', value: 3600 },
];

const GeneralTab: React.FC<GeneralTabProps> = ({
  autostartEnabled,
  isEdgeAdsorption,
  isMemoryOptimizationEnabled,
  isFloatWindowEnabled,
  isMenuVisible,
  leftMenuPosition,
  defaultWindowSize,
  browserMode,
  autoLockEnabled,
  autoLockTimeout,
  onAutostartToggle,
  onEdgeAdsorptionChange,
  onMemoryOptimizationChange,
  onFloatWindowChange,
  onMenuVisibleChange,
  onMenuPositionChange,
  onWindowSizeChange,
  onBrowserModeChange,
  onAutoLockChange,
  onAutoLockTimeoutChange,
}) => {
  const addToast = useToastStore(state => state.addToast);
  const { isDark, setTheme } = useThemeStore(useShallow((s) => ({ isDark: s.isDark, setTheme: s.setTheme })));
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [passwordSet, setPasswordSet] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [weatherCity, setWeatherCity] = useState(() => 
    localStorageService.getString(STORAGE_KEYS.WEATHER_CITY) || '无锡'
  );

  interface LockStatus {
    lockPassword?: string;
  }

  interface ElectronAPI {
    lock?: {
      getStatus: () => Promise<LockStatus>;
      setPassword: (password: string) => Promise<void>;
    };
  }

  const checkPasswordStatus = React.useCallback(async () => {
    try {
      const electronApi = window.electron as ElectronAPI | undefined;
      const lockStatus = await electronApi?.lock?.getStatus();
      if (lockStatus) {
        setPasswordSet(!!lockStatus.lockPassword);
      }
    } catch (error) {
      console.error('Failed to check password status:', error);
    }
  }, []);

  useEffect(() => {
    checkPasswordStatus();
  }, [checkPasswordStatus]);

  const handleSetPassword = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    if (!newPassword.trim()) {
      addToast({ type: 'error', message: '密码不能为空' });
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast({ type: 'error', message: '两次输入的密码不一致' });
      return;
    }
    try {
      const electronApi = window.electron as ElectronAPI | undefined;
      await electronApi?.lock?.setPassword(newPassword);
      setPasswordSet(true);
      setShowPasswordModal(false);
      addToast({ type: 'success', message: '密码设置成功' });
    } catch {
      addToast({ type: 'error', message: '密码设置失败' });
    }
  };

  const handleRemovePassword = async () => {
    try {
      const electronApi = window.electron as ElectronAPI | undefined;
      await electronApi?.lock?.setPassword('');
      setPasswordSet(false);
      addToast({ type: 'success', message: '密码已移除' });
    } catch {
      addToast({ type: 'error', message: '密码移除失败' });
    }
  };

  const handleLocationClick = async () => {
    setLocationLoading(true);
    try {
      const response = await fetch('http://demo.ip-api.com/json/?lang=zh-CN');
      const data = await response.json();
      if (data.status === 'success') {
        setWeatherCity(data.city);
        addToast({ type: 'success', message: `已定位到 ${data.city}` });
      } else {
        addToast({ type: 'error', message: '定位失败，请重试' });
      }
    } catch {
      addToast({ type: 'error', message: '网络错误，无法定位' });
    } finally {
      setLocationLoading(false);
    }
  };

  const handleThemeChange = (value: string) => {
    setTheme(value as 'light' | 'dark');
    addToast({ type: 'success', message: `主题已切换为${value === 'dark' ? '深色' : '浅色'}` });
  };

  const handleWeatherCitySave = () => {
    const city = weatherCity.trim();
    if (city) {
      localStorageService.setString(STORAGE_KEYS.WEATHER_CITY, city);
      addToast({ type: 'success', message: `天气城市已设置为 ${city}` });
    }
  };

  return (
    <SettingCard>
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <SettingsIcon size={16} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">通用设置</h2>
      </div>

      <SettingSection title="窗口设置">
        <SettingRow label="启动窗口">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={defaultWindowSize.width}
              onChange={(e) => onWindowSizeChange('width', e.target.value)}
              className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
            <span className="text-gray-500">x</span>
            <input
              type="number"
              value={defaultWindowSize.height}
              onChange={(e) => onWindowSizeChange('height', e.target.value)}
              className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
            <span className="text-xs text-gray-500 ml-1">px</span>
          </div>
        </SettingRow>
        <SettingRow label="开机启动">
          <ToggleSwitch enabled={autostartEnabled} onChange={onAutostartToggle} />
        </SettingRow>
        <SettingRow label="边缘吸附">
          <ToggleSwitch enabled={isEdgeAdsorption} onChange={onEdgeAdsorptionChange} />
        </SettingRow>
        <SettingRow label="内存优化">
          <ToggleSwitch enabled={isMemoryOptimizationEnabled} onChange={onMemoryOptimizationChange} />
        </SettingRow>
        <SettingRow label="悬浮窗口">
          <ToggleSwitch enabled={isFloatWindowEnabled} onChange={onFloatWindowChange} />
        </SettingRow>
      </SettingSection>

      <SettingSection title="界面设置">
        <SettingRow label="显示边栏">
          <ToggleSwitch enabled={isMenuVisible} onChange={onMenuVisibleChange} checkedLabel="显示" uncheckedLabel="隐藏" />
        </SettingRow>
        <SettingRow label="边栏位置">
          <RadioGroup 
            value={leftMenuPosition} 
            options={[{ label: '左侧', value: 'left' }, { label: '右侧', value: 'right' }]} 
            onChange={onMenuPositionChange} 
          />
        </SettingRow>
        <SettingRow label="主题切换">
          <RadioGroup 
            value={isDark ? 'dark' : 'light'} 
            options={[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }]} 
            onChange={handleThemeChange} 
          />
        </SettingRow>
        <SettingRow label="外部链接">
          <RadioGroup 
            value={browserMode} 
            options={[{ label: '程序弹窗', value: 'internal' }, { label: '默认浏览器', value: 'external' }]} 
            onChange={onBrowserModeChange} 
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="个性化设置">
        <SettingRow label="天气城市">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={weatherCity}
              onChange={(e) => setWeatherCity(e.target.value)}
              placeholder="请输入城市名称"
              className="w-28 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            />
            <button
              onClick={handleLocationClick}
              disabled={locationLoading}
              className="p-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50"
              title="获取当前位置"
            >
              {locationLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={handleWeatherCitySave}
              className="px-3 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              保存
            </button>
          </div>
        </SettingRow>
      </SettingSection>

      <SettingSection title="安全设置">
        <SettingRow label={
          <div className="flex items-center gap-2">
            <span>锁定密码</span>
            {passwordSet ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <path d="M512 512m-486.4 0a486.4 486.4 0 1 0 972.8 0 486.4 486.4 0 1 0-972.8 0Z" fill="#adf9b2"></path>
                <path d="M512 512m-435.2 0a435.2 435.2 0 1 0 870.4 0 435.2 435.2 0 1 0-870.4 0Z" fill="#FFFFFF"></path>
                <path d="M512 74.24C270.2336 74.24 74.24 270.2336 74.24 512S270.2336 949.76 512 949.76c241.7664 0 437.76-195.9936 437.76-437.76S753.7664 74.24 512 74.24z m314.7264 455.5776c-26.88 0-49.92-23.04-49.92-46.1056 0-72.9856-26.88-130.6368-80.6144-176.7424-53.7344-46.1056-111.3088-69.1712-172.7488-69.1712-30.72 0-49.8944-19.2256-49.8944-49.9456 0-26.9056 19.2-46.1056 49.8944-46.1056 92.1344 0 172.7488 30.7456 245.6832 92.2112 72.9344 61.4656 107.4944 145.9968 107.4944 249.7536 0.0256 23.04-19.1744 46.1056-49.8944 46.1056z m0 0" fill="#1afa29"></path>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <path d="M512 512m-486.4 0a486.4 486.4 0 1 0 972.8 0 486.4 486.4 0 1 0-972.8 0Z" fill="#f6887a"></path>
                <path d="M512 512m-435.2 0a435.2 435.2 0 1 0 870.4 0 435.2 435.2 0 1 0-870.4 0Z" fill="#FFFFFF"></path>
                <path d="M512 74.24C270.2336 74.24 74.24 270.2336 74.24 512S270.2336 949.76 512 949.76c241.7664 0 437.76-195.9936 437.76-437.76S753.7664 74.24 512 74.24z m314.7264 455.5776c-26.88 0-49.92-23.04-49.92-46.1056 0-72.9856-26.88-130.6368-80.6144-176.7424-53.7344-46.1056-111.3088-69.1712-172.7488-69.1712-30.72 0-49.8944-19.2256-49.8944-49.9456 0-26.9056 19.2-46.1056 49.8944-46.1056 92.1344 0 172.7488 30.7456 245.6832 92.2112 72.9344 61.4656 107.4944 145.9968 107.4944 249.7536 0.0256 23.04-19.1744 46.1056-49.8944 46.1056z m0 0" fill="#d81e06"></path>
              </svg>
            )}
          </div>
        }>
          <div className="flex items-center gap-1">
            {passwordSet ? (
              <>
                <button
                  onClick={handleSetPassword}
                  className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="修改锁定密码"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={handleRemovePassword}
                  className="p-1 text-red-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  title="移除锁定密码"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={handleSetPassword}
                className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="设置锁定密码"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
            )}
          </div>
        </SettingRow>
        <SettingRow label={
          <div className="flex items-center gap-2">
            <span>自动锁定</span>
            {!passwordSet && (
              <span className="text-xs text-gray-400">(需先设置锁定密码)</span>
            )}
          </div>
        }>
          <div className="flex items-center gap-2">
            {autoLockEnabled && (
              <select
                value={autoLockTimeout}
                onChange={(e) => onAutoLockTimeoutChange(Number(e.target.value))}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {AUTO_LOCK_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
            <ToggleSwitch
              enabled={autoLockEnabled}
              onChange={onAutoLockChange}
            />
          </div>
        </SettingRow>
      </SettingSection>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title={passwordSet ? '修改锁定密码' : '设置锁定密码'}
        confirmText="保存"
        onConfirm={handleSavePassword}
        clickOutsideToClose
      >
        <div>
          <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="请输入密码"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1.5">确认密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="请再次输入密码"
            onKeyDown={(e) => e.key === 'Enter' && handleSavePassword()}
          />
        </div>
      </Modal>
    </SettingCard>
  );
};

export default GeneralTab;
