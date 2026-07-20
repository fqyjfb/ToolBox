import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, Upload, Package, FolderOpen } from 'lucide-react';
import PluginCard from '../../../components/plugins/PluginCard';
import PluginDetail from '../../../components/plugins/PluginDetail';
import DragOverlay from '../../../components/plugins/DragOverlay';
import { usePluginStore } from '../../../store/pluginStore';
import { useSidebarStore } from '../../../store/sidebarStore';
import PluginService from '../../../services/PluginService';
import { useToastStore } from '../../../store/toastStore';
import { PluginInfo, InstalledPlugin } from '../../../types/plugin';

const pluginService = new PluginService();

const PluginStorePage: React.FC = () => {
  const {
    availablePlugins,
    installedPlugins,
    isLoading,
    searchQuery,
    setSearchQuery,
    setAvailablePlugins,
    setInstalledPlugins,
    installingPluginId,
    setInstallingPluginId,
  } = usePluginStore();

  const { removePinnedTool } = useSidebarStore();
  const { addToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'explore' | 'installed'>('explore');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | InstalledPlugin | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hasUpdate = useCallback((plugin: InstalledPlugin): boolean => {
    const available = availablePlugins.find(p => p.id === plugin.id);
    return available ? pluginService.hasUpdate(plugin, available) : false;
  }, [availablePlugins]);

  const getUpdateInfo = useCallback((plugin: InstalledPlugin): { availableVersion: string; githubRepo?: string } | undefined => {
    const available = availablePlugins.find(p => p.id === plugin.id);
    if (!available) return undefined;
    return { availableVersion: available.version, githubRepo: available.githubRepo };
  }, [availablePlugins]);

  const loadPlugins = useCallback(async () => {
    setLoadError(null);
    try {
      const [available, installed] = await Promise.all([
        pluginService.fetchAvailablePlugins(),
        pluginService.getInstalledPlugins(),
      ]);
      setAvailablePlugins(available);
      setInstalledPlugins(installed);
      
      if (available.length === 0) {
        setLoadError('无法连接到插件注册表，请检查网络连接');
      }
    } catch {
      setLoadError('加载插件列表失败，请检查网络连接');
      addToast({ message: '加载插件列表失败', type: 'error' });
    }
  }, [setAvailablePlugins, setInstalledPlugins, addToast]);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleRefresh = useCallback(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleInstall = useCallback(async (plugin: PluginInfo) => {
    setInstallingPluginId(plugin.id);
    try {
      const result = await pluginService.installPlugin(plugin.id, plugin.githubRepo);
      if (result.success) {
        addToast({ message: `插件 "${plugin.name}" 安装成功`, type: 'success' });
        await loadPlugins();
      } else {
        addToast({ message: result.error || `安装 "${plugin.name}" 失败`, type: 'error' });
      }
    } catch {
      addToast({ message: `安装 "${plugin.name}" 时发生错误`, type: 'error' });
    } finally {
      setInstallingPluginId(null);
    }
  }, [setInstallingPluginId, addToast, loadPlugins]);

  const handleUninstall = useCallback(async (pluginId: string) => {
    try {
      const result = await pluginService.uninstallPlugin(pluginId);
      if (result.success) {
        removePinnedTool(pluginId);
        addToast({ message: '插件卸载成功', type: 'success' });
        await loadPlugins();
      } else {
        addToast({ message: result.error || '卸载失败', type: 'error' });
      }
    } catch {
      addToast({ message: '卸载插件时发生错误', type: 'error' });
    }
  }, [addToast, loadPlugins, removePinnedTool]);

  const handleToggleEnabled = useCallback(async (pluginId: string, enabled: boolean) => {
    try {
      const result = await pluginService.togglePluginEnabled(pluginId, enabled);
      if (result.success) {
        addToast({ message: enabled ? '插件已启用' : '插件已禁用', type: 'success' });
        await loadPlugins();
      }
    } catch {
      addToast({ message: '切换插件状态失败', type: 'error' });
    }
  }, [addToast, loadPlugins]);

  const handleInstallFromFile = useCallback(async () => {
    try {
      const result = await pluginService.installFromFile();
      if (result.canceled) return;
      if (result.success) {
        addToast({ message: '插件安装成功', type: 'success' });
        await loadPlugins();
      } else {
        addToast({ message: result.error || '安装失败', type: 'error' });
      }
    } catch {
      addToast({ message: '安装插件时发生错误', type: 'error' });
    }
  }, [addToast, loadPlugins]);

  const handleUpdate = useCallback(async (plugin: InstalledPlugin) => {
    const updateInfo = getUpdateInfo(plugin);
    if (!updateInfo) return;
    
    setInstallingPluginId(plugin.id);
    try {
      const result = await pluginService.installPlugin(plugin.id, updateInfo.githubRepo);
      if (result.success) {
        addToast({ message: `插件 "${plugin.name}" 更新成功`, type: 'success' });
        await loadPlugins();
      } else {
        addToast({ message: result.error || `更新 "${plugin.name}" 失败`, type: 'error' });
      }
    } catch {
      addToast({ message: `更新 "${plugin.name}" 时发生错误`, type: 'error' });
    } finally {
      setInstallingPluginId(null);
    }
  }, [setInstallingPluginId, addToast, loadPlugins, getUpdateInfo]);

  const handleFileDrop = useCallback(async (file: File) => {
    try {
      const filePath = (file as unknown as { path?: string }).path || file.name;
      const result = await pluginService.installFromPath(filePath);
      if (result.success) {
        addToast({ message: '插件安装成功', type: 'success' });
        await loadPlugins();
      } else {
        addToast({ message: result.error || '安装失败', type: 'error' });
      }
    } catch {
      addToast({ message: '安装插件时发生错误', type: 'error' });
    }
  }, [addToast, loadPlugins]);

  const handleViewDetail = useCallback((plugin: PluginInfo | InstalledPlugin) => {
    setSelectedPlugin(plugin);
    setIsDetailOpen(true);
  }, []);

  const filteredPlugins = useMemo(() => {
    let plugins = availablePlugins;
    
    if (selectedCategory !== 'all') {
      plugins = plugins.filter(p => p.categories.includes(selectedCategory));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      plugins = plugins.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.author.toLowerCase().includes(query)
      );
    }
    
    return plugins;
  }, [availablePlugins, selectedCategory, searchQuery]);

  const filteredInstalledPlugins = useMemo(() => {
    let plugins = installedPlugins;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      plugins = plugins.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
      );
    }
    
    return plugins;
  }, [installedPlugins, searchQuery]);

  const installedPluginIds = useMemo(() => 
    installedPlugins.map(p => p.id), 
    [installedPlugins]
  );

  const categories = useMemo(() => {
    const allCategories = availablePlugins.flatMap(p => p.categories);
    const uniqueCategories = [...new Set(allCategories)].sort();
    
    return [
      { id: 'all', name: '全部', icon: Package },
      ...uniqueCategories.map(name => ({
        id: name,
        name,
        icon: FolderOpen,
      })),
    ];
  }, [availablePlugins]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">插件商店</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              window.electron?.plugin?.openExtensionsDir();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            插件目录
          </button>
          <button
            onClick={handleInstallFromFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            上传插件
          </button>
          <button
            onClick={handleRefresh}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索插件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:border-primary text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
        </div>
        
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-0.5">
          <button
            onClick={() => setActiveTab('explore')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'explore'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            发现
          </button>
          <button
            onClick={() => setActiveTab('installed')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'installed'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            已安装 ({installedPlugins.length})
          </button>
        </div>
      </div>

      {activeTab === 'explore' && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30 overflow-x-auto">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-primary text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <category.icon className="w-3.5 h-3.5" />
              {category.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{loadError}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 px-4 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              刷新
            </button>
          </div>
        ) : activeTab === 'explore' ? (
          filteredPlugins.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlugins.map((plugin) => {
                const isInstalled = installedPluginIds.includes(plugin.id);
                const installedPlugin = installedPlugins.find(p => p.id === plugin.id);
                const installedHasUpdate = installedPlugin ? hasUpdate(installedPlugin) : false;
                const updateInfo = installedPlugin ? getUpdateInfo(installedPlugin) : undefined;
                
                return (
                  <PluginCard
                    key={plugin.id}
                    plugin={isInstalled && installedPlugin ? installedPlugin : plugin}
                    isInstalled={isInstalled}
                    isInstalling={installingPluginId === plugin.id}
                    hasUpdate={installedHasUpdate}
                    updateInfo={updateInfo}
                    onInstall={() => handleInstall(plugin)}
                    onUpdate={installedHasUpdate && installedPlugin ? () => handleUpdate(installedPlugin) : undefined}
                    onUninstall={() => handleUninstall(plugin.id)}
                    onToggleEnabled={() => handleToggleEnabled(plugin.id, !(installedPlugin?.enabled ?? true))}
                    onViewDetail={() => handleViewDetail(isInstalled && installedPlugin ? installedPlugin : plugin)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">没有找到匹配的插件</p>
              <p className="text-xs mt-1">尝试更换搜索关键词或分类</p>
            </div>
          )
        ) : (
          filteredInstalledPlugins.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInstalledPlugins.map((plugin) => {
                const installedHasUpdate = hasUpdate(plugin);
                const updateInfo = installedHasUpdate ? getUpdateInfo(plugin) : undefined;
                return (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    isInstalled={true}
                    isInstalling={installingPluginId === plugin.id}
                    hasUpdate={installedHasUpdate}
                    updateInfo={updateInfo}
                    onUpdate={installedHasUpdate ? () => handleUpdate(plugin) : undefined}
                    onUninstall={() => handleUninstall(plugin.id)}
                    onToggleEnabled={() => handleToggleEnabled(plugin.id, !plugin.enabled)}
                    onViewDetail={() => handleViewDetail(plugin)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">还没有安装任何插件</p>
              <button
                onClick={() => setActiveTab('explore')}
                className="mt-3 px-4 py-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                去发现插件
              </button>
            </div>
          )
        )}
      </div>

      <PluginDetail
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        plugin={selectedPlugin}
        isInstalled={selectedPlugin ? installedPluginIds.includes(selectedPlugin.id) : false}
        isInstalling={selectedPlugin ? installingPluginId === selectedPlugin.id : false}
        onInstall={selectedPlugin && !installedPluginIds.includes(selectedPlugin.id) ? () => {
          handleInstall(selectedPlugin as PluginInfo);
          setIsDetailOpen(false);
        } : undefined}
        onUninstall={selectedPlugin ? () => {
          handleUninstall(selectedPlugin.id);
          setIsDetailOpen(false);
        } : undefined}
        onToggleEnabled={selectedPlugin ? () => {
          handleToggleEnabled(selectedPlugin.id, !((selectedPlugin as InstalledPlugin).enabled ?? true));
          setIsDetailOpen(false);
        } : undefined}
      />

      <DragOverlay onFileDrop={handleFileDrop} />
    </div>
  );
};

export default PluginStorePage;