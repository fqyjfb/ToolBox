import React from 'react';
import { Download, Pin, PinOff, ExternalLink, ChevronRight, Play, RefreshCw } from 'lucide-react';
import { PluginInfo, InstalledPlugin } from '../../types/plugin';
import { iconMap } from '../../utils/iconMap';
import { useSidebarStore } from '../../store/sidebarStore';
import { usePluginStore } from '../../store/pluginStore';
import { pluginApi } from '../../services/pluginApi';
import { InstallProgress } from '../../services/PluginService';

interface PluginCardProps {
  plugin: PluginInfo | InstalledPlugin;
  isInstalled?: boolean;
  isInstalling?: boolean;
  installProgress?: InstallProgress;
  hasUpdate?: boolean;
  updateInfo?: { availableVersion: string; githubRepo?: string };
  onInstall?: () => void;
  onUpdate?: () => void;
  onUninstall?: () => void;
  onViewDetail?: () => void;
}

const PluginCard: React.FC<PluginCardProps> = ({
  plugin,
  isInstalled = false,
  isInstalling = false,
  installProgress,
  hasUpdate = false,
  updateInfo,
  onInstall,
  onUpdate,
  onUninstall,
  onViewDetail,
}) => {
  const [iconError, setIconError] = React.useState(false);
  const Icon = iconMap[plugin.iconName] || iconMap.Package;
  const pinnedToolIds = useSidebarStore((state) => state.pinnedToolIds);
  const isInSidebar = pinnedToolIds.includes(plugin.id);
  const addPinnedTool = useSidebarStore((state) => state.addPinnedTool);
  const removePinnedTool = useSidebarStore((state) => state.removePinnedTool);
  const togglePluginPinned = usePluginStore((state) => state.togglePluginPinned);

  const handlePin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isInSidebar) {
      removePinnedTool(plugin.id);
    } else {
      addPinnedTool(plugin.id);
    }
    togglePluginPinned(plugin.id, !isInSidebar);
  };

  return (
    <div
      className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={onViewDetail}
    >
      <div className="flex items-start gap-2">
        <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700"
      >
        {plugin.iconUrl && !iconError && (
          <img
            src={plugin.iconUrl}
            alt={plugin.name}
            className="w-full h-full object-contain"
            onError={() => setIconError(true)}
          />
        )}
        {(!plugin.iconUrl || iconError) && (
          <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        )}
      </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
              {plugin.name}
            </h3>
            {(plugin as InstalledPlugin).isBeta && (
              <span className="px-1.5 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 rounded">
                Beta
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
            {plugin.description}
          </p>

          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {plugin.categories.slice(0, 2).map((category) => (
              <span
                key={category}
                className="px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded"
              >
                {category}
              </span>
            ))}
            <span className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded">
              v{(plugin as InstalledPlugin).installedVersion || plugin.version}
            </span>
            {hasUpdate && updateInfo && (
              <span className="px-1.5 py-0.5 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded flex items-center gap-0.5">
                <RefreshCw className="w-3 h-3" />
                {updateInfo.availableVersion}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          {(plugin as PluginInfo).githubRepo && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                window.electron?.openExternal(`https://github.com/${(plugin as PluginInfo).githubRepo}`);
              }}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              title="查看 GitHub"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handlePin}
            className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
              isInSidebar ? 'text-primary dark:text-primary' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
            title={isInSidebar ? '移除侧边栏' : '添加到侧边栏'}
          >
            {isInSidebar ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {isInstalled ? (
            <>
              {hasUpdate && onUpdate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate();
                  }}
                  disabled={isInstalling}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    isInstalling
                      ? 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                      : 'text-white bg-green-600 dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700'
                  }`}
                >
                  {isInstalling && installProgress ? (
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 transition-all duration-200"
                          style={{ width: `${installProgress.progress}%` }}
                        />
                      </div>
                      <span className="w-8 text-right">{installProgress.progress}%</span>
                    </div>
                  ) : isInstalling ? (
                    <span className="w-3.5 h-3.5 border-1.5 border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  {isInstalling && !installProgress ? '更新中...' : !isInstalling ? '更新' : ''}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pluginApi.openPluginWindow(plugin.id);
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-button-text bg-primary dark:bg-primary rounded-md hover:bg-primary/90 dark:hover:bg-primary/90 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                启动
              </button>
              {onUninstall && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onUninstall();
                  }}
                  className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors"
                >
                  卸载
                </button>
              )}
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onInstall?.();
              }}
              disabled={isInstalling}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                isInstalling
                  ? 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                  : 'text-button-text bg-primary dark:bg-primary hover:bg-primary/90 dark:hover:bg-primary/90'
              }`}
            >
              {isInstalling && installProgress ? (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary dark:bg-primary transition-all duration-200"
                      style={{ width: `${installProgress.progress}%` }}
                    />
                  </div>
                  <span className="w-8 text-right">{installProgress.progress}%</span>
                </div>
              ) : isInstalling ? (
                <span className="w-3.5 h-3.5 border-1.5 border-gray-400 dark:border-gray-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {isInstalling && !installProgress ? '安装中...' : !isInstalling ? '安装' : ''}
            </button>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewDetail?.();
        }}
        className="absolute right-2 top-2 w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors opacity-0 group-hover:opacity-100"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PluginCard;