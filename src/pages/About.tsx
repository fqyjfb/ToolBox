import React, { useState, useEffect } from 'react';
import { APP_VERSION } from '../utils/version';
import { useToastStore } from '../store/toastStore';
import { ExternalLink } from 'lucide-react';
import GitHubButton from '../components/GitHubButton';
import UpdateButton from '../components/UpdateButton';

interface VersionInfo {
  version: string;
  electron: string;
  chrome: string;
  newVersion: string;
  github: string;
  download: string;
}

const About: React.FC = () => {
  const { addToast } = useToastStore();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.electron;

  useEffect(() => {
    if (isElectron) {
      loadVersionInfo();
    }
  }, [isElectron]);

  const loadVersionInfo = async () => {
    if (!window.electron) return;
    try {
      const info = await window.electron.getVersion();
      setVersionInfo(info as VersionInfo);
    } catch (error) {
      console.error('Failed to load version info:', error);
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
      if (window.electron) {
        const info = await window.electron.getVersion() as VersionInfo;
        setVersionInfo(info);

        if (info.newVersion !== '未知' && info.newVersion !== APP_VERSION) {
          setHasUpdate(true);
          addToast({ type: 'success', message: `发现新版本: ${info.newVersion}` });
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
    if (versionInfo?.download && window.electron) {
      window.electron.openExternal(versionInfo.download);
    }
  };

  const displayVersion = versionInfo?.version || APP_VERSION;
  const displayElectron = versionInfo?.electron || '41.2.0';
  const displayChrome = versionInfo?.chrome || '127.0.6533.120';

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
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
              <span className="text-sm">{displayVersion}</span>
              {hasUpdate && (
                <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-full">
                  有更新
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Electron 版本</span>
            <span className="text-sm">{displayElectron}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">Chrome 版本</span>
            <span className="text-sm">{displayChrome}</span>
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
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-3">
            <UpdateButton
              isChecking={isCheckingUpdate}
              hasUpdate={hasUpdate}
              onCheck={checkForUpdates}
              downloadUrl={versionInfo?.download || ''}
            />
            <GitHubButton />
          </div>
          {hasUpdate && versionInfo && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-400">
                发现新版本: <span className="font-semibold">{versionInfo.newVersion}</span>
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
    </div>
  );
};

export default About;
