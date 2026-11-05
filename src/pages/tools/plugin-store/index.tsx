import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RefreshCw, Upload, Package, FolderOpen } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import PluginCard from '../../../components/plugins/PluginCard';
import PluginDetail from '../../../components/plugins/PluginDetail';
import DragOverlay from '../../../components/plugins/DragOverlay';
import { usePluginStore } from '../../../store/pluginStore';
import { useSidebarStore } from '../../../store/sidebarStore';
import PluginService, { InstallProgress } from '../../../services/PluginService';
import { useToastStore } from '../../../store/toastStore';
import { PluginInfo, InstalledPlugin } from '../../../types/plugin';
import { logError } from '../../../services/loggerService';
import { useIsCompactMode } from '../../../store/windowModeStore';
import { useOverflowItems } from '../../../hooks/useOverflowItems';
import OverflowMenu, { OverflowMenuItem } from '../../../components/ui/OverflowMenu';

const pluginService = new PluginService();

const PluginStorePage: React.FC = () => {
  // 小窗模式：标题/页签与操作按钮分行排布，内容区收窄内边距
  const isCompact = useIsCompactMode();
  const {
    availablePlugins,
    installedPlugins,
    availableLoaded,
    isLoading,
    setAvailablePlugins,
    setInstalledPlugins,
    installingPluginId,
    setInstallingPluginId,
    setIsLoading,
  } = usePluginStore(useShallow((s) => ({
    availablePlugins: s.availablePlugins,
    installedPlugins: s.installedPlugins,
    availableLoaded: s.availableLoaded,
    isLoading: s.isLoading,
    setAvailablePlugins: s.setAvailablePlugins,
    setInstalledPlugins: s.setInstalledPlugins,
    installingPluginId: s.installingPluginId,
    setInstallingPluginId: s.setInstallingPluginId,
    setIsLoading: s.setIsLoading,
  })));

  const removePinnedTool = useSidebarStore((s) => s.removePinnedTool);
  const addToast = useToastStore((s) => s.addToast);
  // 搜索词唯一来源：全局搜索框（NavSearchContext），不再在 pluginStore 存副本
  const { searchQuery } = useNavSearch();

  const [activeTab, setActiveTab] = useState<'explore' | 'installed'>('explore');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginInfo | InstalledPlugin | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<Record<string, InstallProgress>>({});
  // 已安装插件列表的 loading（局部 state，与 store 里的 isLoading 解耦）
  const [isInstalledLoading, setIsInstalledLoading] = useState(false);
  // 首帧：防止 store 还没初始化 IPC 结果时直接渲染空列表导致的空白闪现
  const isFirstMountRef = useRef(true);

  const hasUpdate = useCallback((plugin: InstalledPlugin): boolean => {
    const available = availablePlugins.find(p => p.id === plugin.id);
    return available ? pluginService.hasUpdate(plugin, available) : false;
  }, [availablePlugins]);

  const getUpdateInfo = useCallback((plugin: InstalledPlugin): { availableVersion: string; githubRepo?: string } | undefined => {
    const available = availablePlugins.find(p => p.id === plugin.id);
    if (!available) return undefined;
    return { availableVersion: available.version, githubRepo: available.githubRepo };
  }, [availablePlugins]);

  const loadInstalledPlugins = useCallback(async () => {
    try {
      setIsInstalledLoading(true);
      const installed = await pluginService.getInstalledPlugins();
      setInstalledPlugins(installed);
    } catch {
      logError('获取已安装插件失败', 'PluginStore');
    } finally {
      setIsInstalledLoading(false);
    }
  }, [setInstalledPlugins]);

  const loadAvailablePlugins = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);
    try {
      const available = await pluginService.fetchAvailablePlugins();
      setAvailablePlugins(available);
      if (available.length === 0) {
        setLoadError('无法连接到插件注册表，请检查网络连接');
      }
    } catch {
      setLoadError('加载插件列表失败，请检查网络连接');
      addToast({ message: '加载插件列表失败', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [setAvailablePlugins, setIsLoading, addToast]);

  // Effect 1：组件挂载 → 异步刷新已安装插件的 IPC 真值（无论哪个 Tab）
  useEffect(() => {
    loadInstalledPlugins();
    // 挂载一次后不再需要，因为 store 初始值已从 localStorage 读了缓存
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect 2：切到「发现」Tab 且没有未过期缓存时 → 异步拉注册表
  useEffect(() => {
    if (activeTab === 'explore' && !availableLoaded) {
      loadAvailablePlugins();
    }
  }, [activeTab, availableLoaded, loadAvailablePlugins]);

  // Effect 3：组件首帧渲染后清掉 isFirstMountRef（用于骨架屏显示）
  useEffect(() => {
    isFirstMountRef.current = false;
  }, []);

  const handleRefresh = useCallback(() => {
    // 强制刷新：绕过 availableLoaded 缓存，直接拉网络
    Promise.all([
      loadInstalledPlugins(),
      (async () => {
        setLoadError(null);
        setIsLoading(true);
        try {
          const available = await pluginService.fetchAvailablePlugins();
          setAvailablePlugins(available);
          if (available.length === 0) {
            setLoadError('无法连接到插件注册表，请检查网络连接');
          }
        } catch {
          setLoadError('加载插件列表失败，请检查网络连接');
          addToast({ message: '加载插件列表失败', type: 'error' });
        } finally {
          setIsLoading(false);
        }
      })(),
    ]);
  }, [loadInstalledPlugins, setIsLoading, setAvailablePlugins, addToast]);

  const handleInstall = useCallback(async (plugin: PluginInfo) => {
    if (!plugin.releaseUrl && !plugin.githubRepo) {
      addToast({ message: '插件暂未发布可用版本', type: 'error' });
      return;
    }
    
    setInstallingPluginId(plugin.id);
    
    const result = await pluginService.installPlugin(plugin.id, plugin.githubRepo, plugin.releaseUrl, (progress) => {
      setInstallProgress(prev => ({
        ...prev,
        [plugin.id]: progress
      }));
    });
    
    if (result.success) {
      addToast({ message: `插件 "${plugin.name}" 安装成功`, type: 'success' });
      await loadInstalledPlugins();
    } else {
      addToast({ message: result.error || `安装 "${plugin.name}" 失败`, type: 'error' });
    }
    
    setInstallingPluginId(null);
    setInstallProgress(prev => {
      const next = { ...prev };
      delete next[plugin.id];
      return next;
    });
  }, [setInstallingPluginId, addToast, loadInstalledPlugins]);

  const handleUninstall = useCallback(async (pluginId: string) => {
    try {
      const result = await pluginService.uninstallPlugin(pluginId);
      if (result.success) {
        removePinnedTool(pluginId);
        addToast({ message: '插件卸载成功', type: 'success' });
        await loadInstalledPlugins();
      } else {
        addToast({ message: result.error || '卸载失败', type: 'error' });
      }
    } catch {
      addToast({ message: '卸载插件时发生错误', type: 'error' });
    }
  }, [addToast, loadInstalledPlugins, removePinnedTool]);

  const handleInstallFromFile = useCallback(async () => {
    try {
      const result = await pluginService.installFromFile();
      if (result.canceled) return;
      if (result.success) {
        addToast({ message: '插件安装成功', type: 'success' });
        await loadInstalledPlugins();
      } else {
        addToast({ message: result.error || '安装失败', type: 'error' });
      }
    } catch {
      addToast({ message: '安装插件时发生错误', type: 'error' });
    }
  }, [addToast, loadInstalledPlugins]);

  const handleUpdate = useCallback(async (plugin: InstalledPlugin) => {
    const available = availablePlugins.find(p => p.id === plugin.id);
    if (!available?.releaseUrl && !available?.githubRepo) {
      addToast({ message: '插件暂未发布可用版本', type: 'error' });
      return;
    }
    
    setInstallingPluginId(plugin.id);
    
    const result = await pluginService.installPlugin(plugin.id, available.githubRepo, available.releaseUrl, (progress) => {
      setInstallProgress(prev => ({
        ...prev,
        [plugin.id]: progress
      }));
    });
    
    if (result.success) {
      addToast({ message: `插件 "${plugin.name}" 更新成功`, type: 'success' });
      await loadInstalledPlugins();
    } else {
      addToast({ message: result.error || `更新 "${plugin.name}" 失败`, type: 'error' });
    }
    
    setInstallingPluginId(null);
    setInstallProgress(prev => {
      const next = { ...prev };
      delete next[plugin.id];
      return next;
    });
  }, [setInstallingPluginId, addToast, loadInstalledPlugins, availablePlugins]);

  const handleFileDrop = useCallback(async (file: File) => {
    try {
      const filePath = (file as unknown as { path?: string }).path || file.name;
      const result = await pluginService.installFromPath(filePath);
      if (result.success) {
        addToast({ message: '插件安装成功', type: 'success' });
        await loadInstalledPlugins();
      } else {
        addToast({ message: result.error || '安装失败', type: 'error' });
      }
    } catch {
      addToast({ message: '安装插件时发生错误', type: 'error' });
    }
  }, [addToast, loadInstalledPlugins]);

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

  // 小窗：分类按可用宽度收拢，放不下的进「更多」下拉
  const { containerRef, visible, overflow } = useOverflowItems(categories, (category) => category.id, { enabled: isCompact });

  const overflowMenuItems: OverflowMenuItem[] = overflow.map((category) => ({
    key: category.id,
    label: category.name,
    active: selectedCategory === category.id,
    onClick: () => setSelectedCategory(category.id),
  }));

  return (
    <div className="h-full flex flex-col">
      <div className={`${isCompact ? 'flex flex-col items-stretch gap-2 px-2 py-2' : 'flex items-center justify-between px-4 py-3'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-button-text" />
          </div>
          <h1 className="text-lg font-semibold text-content-primary">插件商店</h1>
          <div className="flex items-center gap-1 bg-surface-secondary rounded-md p-0.5">
            <button
              onClick={() => setActiveTab('explore')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'explore'
                  ? 'bg-primary text-button-text'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              发现
            </button>
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeTab === 'installed'
                  ? 'bg-primary text-button-text'
                  : 'text-content-secondary hover:text-content-primary'
              }`}
            >
              已安装 ({installedPlugins.length})
            </button>
          </div>
        </div>

        <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2'}`}>
          <button
            onClick={() => {
              window.electron?.plugin?.openExtensionsDir();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-content-secondary bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors"
          >
            <FolderOpen className="w-3 h-3" />
            目录
          </button>
          <button
            onClick={handleInstallFromFile}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-content-secondary bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors"
          >
            <Upload className="w-3 h-3" />
            上传
          </button>
          <button
            onClick={handleRefresh}
            className="w-6 h-6 flex items-center justify-center rounded-md text-content-tertiary hover:text-content-primary hover:bg-menu-hover dark:hover:text-content-secondary transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {activeTab === 'explore' && (
        <div className={`flex items-center gap-2 py-2 ${isCompact ? 'px-2' : 'px-4'}`}>
          <div
            ref={containerRef}
            className={`flex items-center gap-2 min-w-0 flex-1 ${isCompact ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}
          >
            {visible.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap flex-shrink-0 transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-primary text-button-text'
                    : 'text-content-secondary hover:bg-menu-hover'
                }`}
              >
                <category.icon className="w-3.5 h-3.5" />
                {category.name}
              </button>
            ))}
          </div>
          <OverflowMenu items={overflowMenuItems} />
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${isCompact ? 'p-2 scrollbar-hide' : 'p-4'}`}>
        {isFirstMountRef.current ? (
          // 首帧骨架屏：store 初始化 + IPC 真值回来前占个位置，避免空白闪现
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'installed' && isInstalledLoading && installedPlugins.length === 0 ? (
          // 已安装 Tab 正在 IPC + 还没缓存
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'explore' && isLoading && availablePlugins.length === 0 ? (
          // 发现 Tab 正在网络请求 + 还没缓存
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError && activeTab === 'explore' ? (
          <div className="flex flex-col items-center justify-center h-64 text-content-tertiary">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    installProgress={installProgress[plugin.id]}
                    hasUpdate={installedHasUpdate}
                    updateInfo={updateInfo}
                    onInstall={() => handleInstall(plugin)}
                    onUpdate={installedHasUpdate && installedPlugin ? () => handleUpdate(installedPlugin) : undefined}
                    onUninstall={() => handleUninstall(plugin.id)}
                    onViewDetail={() => handleViewDetail(isInstalled && installedPlugin ? installedPlugin : plugin)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-content-tertiary">
              <Package className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">没有找到匹配的插件</p>
              <p className="text-xs mt-1">尝试更换搜索关键词或分类</p>
            </div>
          )
        ) : (
          filteredInstalledPlugins.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {filteredInstalledPlugins.map((plugin) => {
                const installedHasUpdate = hasUpdate(plugin);
                const updateInfo = installedHasUpdate ? getUpdateInfo(plugin) : undefined;
                return (
                  <PluginCard
                    key={plugin.id}
                    plugin={plugin}
                    isInstalled={true}
                    isInstalling={installingPluginId === plugin.id}
                    installProgress={installProgress[plugin.id]}
                    hasUpdate={installedHasUpdate}
                    updateInfo={updateInfo}
                    onUpdate={installedHasUpdate ? () => handleUpdate(plugin) : undefined}
                    onUninstall={() => handleUninstall(plugin.id)}
                    onViewDetail={() => handleViewDetail(plugin)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-content-tertiary">
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
      />

      <DragOverlay onFileDrop={handleFileDrop} />
    </div>
  );
};

export default PluginStorePage;