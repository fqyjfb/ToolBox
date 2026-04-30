import React from 'react';
import { Settings as SettingsIcon, Trash2, MapPin, Loader2 } from 'lucide-react';
import ToggleSwitch from './ToggleSwitch';
import RadioGroup from './RadioGroup';
import { WindowSize } from '../../types/settings';
import { useToastStore } from '../../store/toastStore';

interface GeneralTabProps {
  autostartEnabled: boolean;
  isEdgeAdsorption: boolean;
  isMemoryOptimizationEnabled: boolean;
  isFloatWindowEnabled: boolean;
  isMenuVisible: boolean;
  leftMenuPosition: string;
  defaultWindowSize: WindowSize;
  browserMode: string;
  onAutostartToggle: (enabled: boolean) => void;
  onEdgeAdsorptionChange: (enabled: boolean) => void;
  onMemoryOptimizationChange: (enabled: boolean) => void;
  onFloatWindowChange: (enabled: boolean) => void;
  onMenuVisibleChange: (enabled: boolean) => void;
  onMenuPositionChange: (position: string) => void;
  onWindowSizeChange: (key: 'width' | 'height', value: string) => void;
  onClearCache: () => void;
  btnLoading: boolean;
  btnText: string;
}

const GeneralTab: React.FC<GeneralTabProps> = ({
  autostartEnabled,
  isEdgeAdsorption,
  isMemoryOptimizationEnabled,
  isFloatWindowEnabled,
  isMenuVisible,
  leftMenuPosition,
  defaultWindowSize,
  browserMode,
  onAutostartToggle,
  onEdgeAdsorptionChange,
  onMemoryOptimizationChange,
  onFloatWindowChange,
  onMenuVisibleChange,
  onMenuPositionChange,
  onWindowSizeChange,
  onClearCache,
  btnLoading,
  btnText
}) => {
  const addToast = useToastStore(state => state.addToast);
  const [locationLoading, setLocationLoading] = React.useState(false);

  const handleLocationClick = async () => {
    setLocationLoading(true);
    try {
      const response = await fetch('http://demo.ip-api.com/json/?lang=zh-CN');
      const data = await response.json();
      if (data.status === 'success') {
        const input = document.getElementById('weatherCityInput') as HTMLInputElement;
        if (input) {
          input.value = data.city;
        }
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
    if (value === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    localStorage.setItem('toolbox_theme', value);
    addToast({ type: 'success', message: `主题已切换为${value === 'dark' ? '深色' : '浅色'}` });
  };

  const handleBrowserModeChange = (value: string) => {
    const mode = value as 'internal' | 'external';
    localStorage.setItem('toolbox_browser_mode', mode);
    addToast({ type: 'success', message: `浏览器设置已更新为${mode === 'internal' ? '程序弹窗' : '默认浏览器'}` });
  };

  const handleWeatherCitySave = () => {
    const input = document.getElementById('weatherCityInput') as HTMLInputElement;
    const city = input.value.trim();
    if (city) {
      localStorage.setItem('weatherCity', city);
      addToast({ type: 'success', message: `天气城市已设置为 ${city}` });
    }
  };

  return (
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
                onChange={(e) => onWindowSizeChange('width', e.target.value)}
                className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              />
              <span className="text-gray-500">x</span>
              <input
                type="number"
                value={defaultWindowSize.height}
                onChange={(e) => onWindowSizeChange('height', e.target.value)}
                className="w-20 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              />
              <span className="text-xs text-gray-500 ml-1">px</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">开机启动</span>
            <ToggleSwitch enabled={autostartEnabled} onChange={onAutostartToggle} />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">边缘吸附</span>
            <ToggleSwitch enabled={isEdgeAdsorption} onChange={onEdgeAdsorptionChange} />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">内存优化</span>
            <ToggleSwitch enabled={isMemoryOptimizationEnabled} onChange={onMemoryOptimizationChange} />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">悬浮窗口</span>
            <ToggleSwitch enabled={isFloatWindowEnabled} onChange={onFloatWindowChange} />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">显示边栏</span>
            <ToggleSwitch enabled={isMenuVisible} onChange={onMenuVisibleChange} checkedLabel="显示" uncheckedLabel="隐藏" />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">边栏位置</span>
            <RadioGroup 
              value={leftMenuPosition} 
              options={[{ label: '左侧', value: 'left' }, { label: '右侧', value: 'right' }]} 
              onChange={onMenuPositionChange} 
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">主题切换</span>
            <RadioGroup 
              value={document.body.classList.contains('dark') ? 'dark' : 'light'} 
              options={[{ label: '浅色', value: 'light' }, { label: '深色', value: 'dark' }]} 
              onChange={handleThemeChange} 
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">外部链接</span>
            <RadioGroup 
              value={browserMode} 
              options={[{ label: '程序弹窗', value: 'internal' }, { label: '默认浏览器', value: 'external' }]} 
              onChange={handleBrowserModeChange} 
            />
          </div>
          <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <span className="text-sm text-gray-700 dark:text-gray-300">天气城市</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                id="weatherCityInput"
                defaultValue={localStorage.getItem('weatherCity') || '南京'}
                placeholder="请输入城市名称"
                className="w-28 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              />
              <button
                onClick={handleLocationClick}
                disabled={locationLoading}
                className="p-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50"
                title="获取当前位置"
              >
                {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
              </button>
              <button
                onClick={handleWeatherCitySave}
                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
              >
                保存
              </button>
            </div>
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
              onClick={onClearCache}
              disabled={btnLoading}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors ${
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
  );
};

export default GeneralTab;
