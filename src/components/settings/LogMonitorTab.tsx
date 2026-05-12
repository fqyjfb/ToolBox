import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Download, Upload, Filter, AlertCircle, AlertTriangle, Info, Bug } from 'lucide-react';
import { loggerService, LoggerSettings, LogEntry, LogLevel } from '../../services/loggerService';
import { useToastStore } from '../../store/toastStore';
import ToggleSwitch from './ToggleSwitch';

const LogMonitorTab: React.FC = () => {
  const addToast = useToastStore(state => state.addToast);
  const [settings, setSettings] = useState<LoggerSettings>(() => loggerService.getSettings());
  const [logs, setLogs] = useState<LogEntry[]>(() => loggerService.getLogs());
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    const unsubscribe = loggerService.subscribe((newLogs) => {
      setLogs(newLogs);
    });
    return unsubscribe;
  }, []);

  const handleSettingChange = useCallback((key: keyof LoggerSettings, value: boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    loggerService.updateSettings(newSettings);
  }, [settings]);

  const handleLevelToggle = useCallback((level: LogLevel) => {
    const newLevels = { ...settings.levels, [level]: !settings.levels[level] };
    const newSettings = { ...settings, levels: newLevels };
    setSettings(newSettings);
    loggerService.updateSettings(newSettings);
  }, [settings]);

  const handleClearLogs = useCallback(() => {
    loggerService.clearLogs();
    setLogs([]);
    addToast({ type: 'success', message: '日志已清除' });
  }, [addToast]);

  const handleExportLogs = useCallback(() => {
    const data = loggerService.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `toolbox_logs_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: '日志已导出' });
  }, [addToast]);

  const handleImportLogs = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const text = await file.text();
        const success = loggerService.importLogs(text);
        if (success) {
          addToast({ type: 'success', message: '日志已导入' });
        } else {
          addToast({ type: 'error', message: '导入失败，文件格式错误' });
        }
      }
    };
    input.click();
  }, [addToast]);

  const filteredLogs = logs.filter(log => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (searchText && !log.message.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const stats = loggerService.getStats();

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error': return <AlertCircle size={14} className="text-red-500" />;
      case 'warn': return <AlertTriangle size={14} className="text-yellow-500" />;
      case 'info': return <Info size={14} className="text-blue-500" />;
      case 'debug': return <Bug size={14} className="text-gray-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-4">日志监控设置</h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">开启日志监控</p>
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
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">日志统计</h3>
          <div className="flex gap-2">
            <button
              onClick={handleExportLogs}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="导出日志"
            >
              <Download size={16} />
            </button>
            <button
              onClick={handleImportLogs}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              title="导入日志"
            >
              <Upload size={16} />
            </button>
            <button
              onClick={handleClearLogs}
              className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
              title="清空日志"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-semibold text-red-600 dark:text-red-400">{stats.byLevel.error}</p>
            <p className="text-xs text-red-500 dark:text-red-400">Error</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">{stats.byLevel.warn}</p>
            <p className="text-xs text-yellow-500 dark:text-yellow-400">Warn</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-2 text-center">
            <p className="text-lg font-semibold text-blue-600 dark:text-blue-400">{stats.byLevel.info}</p>
            <p className="text-xs text-blue-500 dark:text-blue-400">Info</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-2 text-center">
            <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">{stats.byLevel.debug}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Debug</p>
          </div>
          <div className="bg-gray-100 dark:bg-gray-700 rounded-md p-2 text-center">
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{stats.total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="搜索日志内容..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
            />
            <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as LogLevel | 'all')}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
          >
            <option value="all">全部级别</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              {settings.enabled ? '暂无日志记录' : '日志监控已关闭'}
            </div>
          ) : (
            filteredLogs.slice().reverse().map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded-md text-xs font-mono ${
                  log.level === 'error'
                    ? 'bg-red-50 dark:bg-red-900/10 border-l-2 border-red-500'
                    : log.level === 'warn'
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-l-2 border-yellow-500'
                    : log.level === 'info'
                    ? 'bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-500'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-l-2 border-gray-500'
                }`}
              >
                <div className="flex items-center gap-2">
                  {getLevelIcon(log.level)}
                  <span className="text-gray-500 dark:text-gray-400">[{log.context || 'App'}]</span>
                  {settings.showTimestamp && (
                    <span className="text-gray-400 dark:text-gray-500">{formatTime(log.timestamp)}</span>
                  )}
                </div>
                <p className="mt-1 text-gray-800 dark:text-gray-200 break-all">{log.message}</p>
                {log.stack && (
                  <pre className="mt-1 text-gray-500 dark:text-gray-400 text-xs whitespace-pre-wrap break-all">
                    {log.stack}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default LogMonitorTab;
