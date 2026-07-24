import React from 'react';
import { Download, Pin, PinOff, ExternalLink, Star, Play } from 'lucide-react';
import Modal from '../ui/Modal';
import { PluginInfo, InstalledPlugin } from '../../types/plugin';
import { iconMap } from '../../utils/iconMap';
import { useSidebarStore } from '../../store/sidebarStore';
import { usePluginStore } from '../../store/pluginStore';
import { translateTag } from '../../utils';
import { pluginApi } from '../../services/pluginApi';

interface PluginDetailProps {
  isOpen: boolean;
  onClose: () => void;
  plugin: PluginInfo | InstalledPlugin | null;
  isInstalled?: boolean;
  isInstalling?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
}

const PluginDetail: React.FC<PluginDetailProps> = ({
  isOpen,
  onClose,
  plugin,
  isInstalled = false,
  isInstalling = false,
  onInstall,
  onUninstall,
}) => {
  const [iconError, setIconError] = React.useState(false);
  const pinnedToolIds = useSidebarStore((state) => state.pinnedToolIds);
  const addPinnedTool = useSidebarStore((state) => state.addPinnedTool);
  const removePinnedTool = useSidebarStore((state) => state.removePinnedTool);
  const togglePluginPinned = usePluginStore((state) => state.togglePluginPinned);

  if (!plugin) return null;

  const Icon = iconMap[plugin.iconName] || iconMap.Package;
  const isInSidebar = pinnedToolIds.includes(plugin.id);

  const handlePin = () => {
    if (isInSidebar) {
      removePinnedTool(plugin.id);
    } else {
      addPinnedTool(plugin.id);
    }
    togglePluginPinned(plugin.id, !isInSidebar);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={plugin.name}
      size="lg"
      showConfirm={false}
      showCancel={false}
      clickOutsideToClose={false}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div
          className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700"
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
            <Icon className="w-8 h-8 text-gray-600 dark:text-gray-300" />
          )}
        </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {plugin.name}
              </h2>
              {(plugin as InstalledPlugin).isBeta && (
                <span className="px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 rounded">
                  Beta
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {plugin.description}
            </p>

            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                v{plugin.version}
              </span>
              <span>{plugin.author}</span>
            </div>
          </div>
        </div>

        {(plugin as PluginInfo).image && (
          <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <img
              src={(plugin as PluginInfo).image}
              alt={plugin.name}
              className="w-full h-32 object-cover"
            />
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">分类</span>
            <div className="flex flex-wrap gap-1.5">
              {plugin.categories.map((category) => (
                <span
                  key={category}
                  className="px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>

          {(plugin as PluginInfo).tags && (plugin as PluginInfo).tags!.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">标签</span>
              <div className="flex flex-wrap gap-1.5">
                {(plugin as PluginInfo).tags!.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    {translateTag(tag)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {(plugin as PluginInfo).githubRepo && (
              <button
                onClick={() => {
                  window.electron?.openExternal(`https://github.com/${(plugin as PluginInfo).githubRepo}`);
                }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                GitHub
              </button>
            )}
            <button
              onClick={handlePin}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isInSidebar
                  ? 'text-primary dark:text-primary bg-primary/10 dark:bg-primary/10'
                  : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {isInSidebar ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
              {isInSidebar ? '已在侧边栏' : '添加到侧边栏'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isInstalled ? (
              <>
                <button
                  onClick={() => {
                    pluginApi.openPluginWindow(plugin.id);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-button-text bg-primary dark:bg-primary rounded-md hover:bg-primary/90 dark:hover:bg-primary/90 transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  启动
                </button>
                {onUninstall && (
                  <button
                    onClick={onUninstall}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-md hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors"
                  >
                    卸载
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={onInstall}
                disabled={isInstalling}
                className={`flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-button-text rounded-md transition-colors ${
                  isInstalling
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary dark:bg-primary hover:bg-primary/90 dark:hover:bg-primary/90'
                }`}
              >
                {isInstalling ? (
                  <span className="w-3.5 h-3.5 border-1.5 border-white/30 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isInstalling ? '安装中...' : '安装'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PluginDetail;