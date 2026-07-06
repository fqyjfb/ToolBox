import React, { useState, useEffect } from 'react';
import { APP_VERSION, compareVersions } from '../../utils/version';
import { useToastStore } from '../../store/toastStore';
import { ExternalLink, Monitor, HardDrive, Cpu, User, Clock, RefreshCw } from 'lucide-react';
import GitHubButton from '../../components/ui/GitHubButton';
import UpdateButton from '../../components/ui/UpdateButton';
import { formatBytes } from '../../utils/format';

const About: React.FC = () => {
  const { addToast } = useToastStore();
  const [webVersion] = useState(APP_VERSION);
  const [electronVersion, setElectronVersion] = useState<string | null>(null);
  const [chromeVersion, setChromeVersion] = useState<string | null>(null);
  const [newVersion, setNewVersion] = useState<string>('');
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loadingSystemInfo, setLoadingSystemInfo] = useState(true);
  const isElectron = typeof window !== 'undefined' && !!window.electron;

  useEffect(() => {
    if (isElectron) {
      loadVersionInfo();
      loadSystemInfo();
    }
  }, [isElectron]);

  const loadVersionInfo = async () => {
    const electron = window.electron;
    if (!electron) return;
    try {
      const info = await electron.getVersion();
      setElectronVersion(info.electron);
      setChromeVersion(info.chrome);
      setNewVersion(info.newVersion);
      setDownloadUrl(info.download);
    } catch (error) {
      console.error('Failed to load version info:', error);
    }
  };

  const loadSystemInfo = async () => {
    const electron = window.electron;
    if (!electron) return;
    try {
      const info = await electron.systemInfo.get();
      setSystemInfo(info);
    } catch (error) {
      console.error('Failed to load system info:', error);
    } finally {
      setLoadingSystemInfo(false);
    }
  };

  const checkForUpdates = async () => {
    if (!isElectron) {
      addToast({ type: 'info', message: '网页版无需检查更新' });
      return;
    }
    setIsCheckingUpdate(true);
    addToast({ type: 'info', message: '正在检查更新...' });

    try {
      const electron = window.electron;
      if (electron) {
        const info = await electron.getVersion();
        setElectronVersion(info.electron);
        setChromeVersion(info.chrome);
        setNewVersion(info.newVersion);
        setDownloadUrl(info.download);

        const currentVersion = APP_VERSION;
        const latestVersion = info.newVersion;
        const needsUpdate = latestVersion !== '未知' && compareVersions(currentVersion, latestVersion) < 0;

        if (needsUpdate) {
          setHasUpdate(true);
          addToast({ type: 'success', message: `发现新版本: ${latestVersion}` });
        } else {
          setHasUpdate(false);
          addToast({ type: 'success', message: '当前已是最新版本' });
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      addToast({ type: 'error', message: '检查更新失败' });
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const openDownloadPage = () => {
    if (downloadUrl && isElectron && window.electron) {
      window.electron.openExternal(downloadUrl);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <img src="./favicon.png" alt="ToolBox Logo" className="w-12 h-12 mr-4" />
            <div>
              <h2 className="text-sm font-semibold">ToolBox</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">一站式工具平台</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">版本</span>
            <div className="flex items-center gap-2">
              <span className="text-sm">{webVersion}</span>
              {hasUpdate && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full">
                  有更新
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Electron 版本</span>
            <span className="text-sm">{electronVersion || '41.2.0'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Chrome 版本</span>
            <span className="text-sm">{chromeVersion || '127.0.6533.120'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">React 版本</span>
            <span className="text-sm">19.2.5</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">TypeScript 版本</span>
            <span className="text-sm">6.0.2</span>
          </div>
          {!isElectron && (
            <div className="flex justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">运行环境</span>
              <span className="text-sm text-green-600 dark:text-green-400">网页版</span>
            </div>
          )}
        </div>
        {isElectron && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Monitor className="w-3.5 h-3.5" />
              系统信息
            </h3>
            {loadingSystemInfo ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="ml-2 text-sm text-gray-500">正在获取系统信息...</span>
              </div>
            ) : systemInfo ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">操作系统</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={systemInfo.os_version}>
                    {systemInfo.os_version}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">系统架构</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{systemInfo.os_arch}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">处理器</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={systemInfo.cpu_info}>
                    {systemInfo.cpu_info}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">CPU 核心数</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{systemInfo.cpu_cores} 核</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">内存</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {formatBytes(systemInfo.available_memory)} 可用 / {formatBytes(systemInfo.total_memory)} 总计
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">计算机名</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{systemInfo.computer_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">当前用户</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{systemInfo.user_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">系统运行时间</span>
                  </div>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {Math.floor(systemInfo.uptime_seconds / 86400)} 天 {Math.floor((systemInfo.uptime_seconds % 86400) / 3600)} 小时 {Math.floor((systemInfo.uptime_seconds % 3600) / 60)} 分钟
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">无法获取系统信息</p>
            )}
          </div>
        )}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-3">
            <UpdateButton
              isChecking={isCheckingUpdate}
              hasUpdate={hasUpdate}
              onCheck={checkForUpdates}
              downloadUrl={downloadUrl}
            />
            <GitHubButton />
          </div>
          {hasUpdate && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                发现新版本: <span className="font-semibold">{newVersion}</span>
              </p>
              <button
                onClick={openDownloadPage}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                下载最新版本 <ExternalLink size={12} />
              </button>
            </div>
          )}
        </div>
    </div>
  );
};

export default About;
