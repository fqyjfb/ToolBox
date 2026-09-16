import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, AlertTriangle, Info, Bug, ExternalLink } from 'lucide-react';
import { loggerService, LoggerSettings, LogLevel } from '../../services/loggerService';
import { NotificationSettings } from '../../types/settings';
import ToggleSwitch from './ToggleSwitch';
import SettingCard from './SettingCard';

interface LogMonitorTabProps {
  notifications: NotificationSettings;
  onNotificationToggle: (key: keyof NotificationSettings) => void;
}

const LogMonitorTab: React.FC<LogMonitorTabProps> = ({
  notifications,
  onNotificationToggle,
}) => {
  const [settings, setSettings] = useState<LoggerSettings>({
    enabled: false,
    maxEntries: 500,
    levels: { error: true, warn: true, info: false, debug: false },
    showTimestamp: true,
    autoClean: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const saved = await loggerService.getSettings();
      setSettings(saved);
      setLoading(false);
    };
    loadSettings();
    const unsubscribe = loggerService.subscribe(() => {
    });
    return unsubscribe;
  }, []);

  const handleSettingChange = useCallback(async (key: keyof LoggerSettings, value: boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await loggerService.updateSettings(newSettings);
  }, [settings]);

  const handleLevelToggle = useCallback(async (level: LogLevel) => {
    const newLevels = { ...settings.levels, [level]: !settings.levels[level] };
    const newSettings = { ...settings, levels: newLevels };
    setSettings(newSettings);
    await loggerService.updateSettings(newSettings);
  }, [settings]);

  const handleOpenLogWindow = useCallback(() => {
    if (window.electron?.log) {
      window.electron.log.open();
    }
  }, []);

  if (loading) {
    return (
      <SettingCard>
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </SettingCard>
    );
  }

  return (
    <SettingCard>
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">日志监控设置</h3>
        <button
          onClick={handleOpenLogWindow}
          className="px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-md hover:bg-primary/5 transition-colors flex items-center gap-1.5"
        >
          <ExternalLink size={12} />
          打开日志
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">错误通知</span>
          </div>
          <ToggleSwitch
            enabled={notifications.errors}
            onChange={() => onNotificationToggle('errors')}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">开启监控</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">启用后可记录和分析应用错误</p>
          </div>
          <ToggleSwitch
            enabled={settings.enabled}
            onChange={(checked) => handleSettingChange('enabled', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">显示时间戳</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">在日志中显示精确时间</p>
          </div>
          <ToggleSwitch
            enabled={settings.showTimestamp}
            onChange={(checked) => handleSettingChange('showTimestamp', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">自动清理</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">日志达到上限时自动清理旧日志</p>
          </div>
          <ToggleSwitch
            enabled={settings.autoClean}
            onChange={(checked) => handleSettingChange('autoClean', checked)}
          />
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">日志级别</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleLevelToggle('error')}
              className={`px-3 py-1.5 text-xs rounded-md border flex items-center gap-1.5 transition-colors ${
                settings.levels.error
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
              }`}
            >
              <AlertCircle size={12} /> Error
            </button>
            <button
              onClick={() => handleLevelToggle('warn')}
              className={`px-3 py-1.5 text-xs rounded-md border flex items-center gap-1.5 transition-colors ${
                settings.levels.warn
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
              }`}
            >
              <AlertTriangle size={12} /> Warn
            </button>
            <button
              onClick={() => handleLevelToggle('info')}
              className={`px-3 py-1.5 text-xs rounded-md border flex items-center gap-1.5 transition-colors ${
                settings.levels.info
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
              }`}
            >
              <Info size={12} /> Info
            </button>
            <button
              onClick={() => handleLevelToggle('debug')}
              className={`px-3 py-1.5 text-xs rounded-md border flex items-center gap-1.5 transition-colors ${
                settings.levels.debug
                  ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500'
              }`}
            >
              <Bug size={12} /> Debug
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            最大日志数量: {settings.maxEntries}
          </label>
          <input
            type="range"
            min="100"
            max="2000"
            step="100"
            value={settings.maxEntries}
            onChange={(e) => handleSettingChange('maxEntries', parseInt(e.target.value))}
            className="w-full mt-1"
          />
        </div>
      </div>
    </SettingCard>
  );
};

export default LogMonitorTab;