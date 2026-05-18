import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Download, AlertCircle, AlertTriangle, Info, Bug, Minus, X } from 'lucide-react';
import { loggerService, LogEntry, LogLevel } from '../../../services/loggerService';

const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'all'>('all');
  const [stats, setStats] = useState({ total: 0, byLevel: { error: 0, warn: 0, info: 0, debug: 0 } });

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedLogs = await loggerService.getLogs();
      setLogs(fetchedLogs);
      const newStats = await loggerService.getStats();
      setStats(newStats);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    loadLogs();
  }, [loadLogs]);

  const handleClear = useCallback(async () => {
    try {
      await loggerService.clearLogs();
      setLogs([]);
      setStats({ total: 0, byLevel: { error: 0, warn: 0, info: 0, debug: 0 } });
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const jsonString = await loggerService.exportLogs();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }, []);

  useEffect(() => {
    loadLogs();

    const unsubscribe = loggerService.subscribe((newLogs) => {
      setLogs(newLogs);
      const newStats = {
        total: newLogs.length,
        byLevel: {
          error: newLogs.filter(l => l.level === 'error').length,
          warn: newLogs.filter(l => l.level === 'warn').length,
          info: newLogs.filter(l => l.level === 'info').length,
          debug: newLogs.filter(l => l.level === 'debug').length
        }
      };
      setStats(newStats);
    });

    if (window.electron?.ipcRenderer) {
      const handleNewEntry = (_event: unknown, entry: LogEntry) => {
        setLogs(prev => [...prev, entry]);
        setStats(prev => ({
          total: prev.total + 1,
          byLevel: {
            ...prev.byLevel,
            [entry.level]: prev.byLevel[entry.level] + 1
          }
        }));
      };

      const handleCleared = () => {
        setLogs([]);
        setStats({ total: 0, byLevel: { error: 0, warn: 0, info: 0, debug: 0 } });
      };

      window.electron.ipcRenderer.on('log:newEntry', handleNewEntry);
      window.electron.ipcRenderer.on('log:cleared', handleCleared);

      return () => {
        unsubscribe();
        window.electron?.ipcRenderer?.off('log:newEntry', handleNewEntry);
        window.electron?.ipcRenderer?.off('log:cleared', handleCleared);
      };
    }

    return unsubscribe;
  }, [loadLogs]);

  const filteredLogs = filterLevel === 'all' 
    ? logs 
    : logs.filter(log => log.level === filterLevel);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="text-red-500" size={16} />;
      case 'warn':
        return <AlertTriangle className="text-yellow-500" size={16} />;
      case 'info':
        return <Info className="text-blue-500" size={16} />;
      case 'debug':
        return <Bug className="text-gray-500" size={16} />;
    }
  };

  const getLevelLabel = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return 'Error';
      case 'warn':
        return 'Warn';
      case 'info':
        return 'Info';
      case 'debug':
        return 'Debug';
    }
  };

  const getLevelBgClass = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warn':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'debug':
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleMinimize = () => {
    window.electron?.ipcRenderer?.send('log:minimize');
  };

  const handleClose = () => {
    window.electron?.ipcRenderer?.send('log:close');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div 
        className="bg-gray-800 dark:bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">日志监控</span>
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMinimize}
              className="p-2 rounded hover:bg-gray-700 transition-colors"
              title="最小化"
            >
              <Minus className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 rounded hover:bg-red-600 transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">日志监控</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              共 {stats.total} 条日志
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              刷新
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-800/20 transition-colors flex items-center gap-2"
            >
              <Trash2 size={16} />
              清空
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              导出
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">筛选:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterLevel === 'all'
                  ? 'bg-gray-800 text-white dark:bg-gray-600'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              全部 ({stats.total})
            </button>
            <button
              onClick={() => setFilterLevel('error')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                filterLevel === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-50 text-red-600 hover:bg-red-100'
              }`}
            >
              <AlertCircle size={12} />
              Error ({stats.byLevel.error})
            </button>
            <button
              onClick={() => setFilterLevel('warn')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                filterLevel === 'warn'
                  ? 'bg-yellow-500 text-white'
                  : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
              }`}
            >
              <AlertTriangle size={12} />
              Warn ({stats.byLevel.warn})
            </button>
            <button
              onClick={() => setFilterLevel('info')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                filterLevel === 'info'
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <Info size={12} />
              Info ({stats.byLevel.info})
            </button>
            <button
              onClick={() => setFilterLevel('debug')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                filterLevel === 'debug'
                  ? 'bg-gray-500 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Bug size={12} />
              Debug ({stats.byLevel.debug})
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-2">
                <Info size={48} />
              </div>
              <p className="text-gray-500 dark:text-gray-400">暂无日志记录</p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`border-b border-gray-100 dark:border-gray-700 last:border-b-0 p-4 ${getLevelBgClass(log.level)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getLevelIcon(log.level)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          log.level === 'error' ? 'bg-red-200 text-red-800' :
                          log.level === 'warn' ? 'bg-yellow-200 text-yellow-800' :
                          log.level === 'info' ? 'bg-blue-200 text-blue-800' :
                          'bg-gray-200 text-gray-800'
                        }`}>
                          {getLevelLabel(log.level)}
                        </span>
                        {log.context && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            [{log.context}]
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 dark:text-gray-200 mt-2 break-all">
                        {log.message}
                      </p>
                      {log.stack && (
                        <pre className="text-xs text-gray-500 dark:text-gray-400 mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 overflow-x-auto">
                          {log.stack}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsPage;