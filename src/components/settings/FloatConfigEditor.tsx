import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { FloatConfigItem } from '../../types/settings';
import { QuickLaunchItem } from '../../utils/quickLaunch';
import {
  NAV_ACTIONS,
  SYSTEM_ACTIONS,
  FLOAT_TYPE_OPTIONS,
  AVAILABLE_ICONS
} from '../../constants/settings';
import { ALL_TOOLS } from '../../constants/tools';
import { renderFloatIcon, isPredefinedIcon, formatIconSrc } from '../../utils/floatIconRenderer';
import { usePluginStore } from '../../store/pluginStore';
import CachedIcon from '../ui/CachedIcon';
import { iconMap } from '../../utils/iconMap';

interface FloatConfigEditorProps {
  config: FloatConfigItem;
  onUpdate: (config: FloatConfigItem) => void;
  onSave: () => void;
  onReset: () => void;
  quickLaunchApps: QuickLaunchItem[];
}

const FloatConfigEditor: React.FC<FloatConfigEditorProps> = ({
  config,
  onUpdate,
  onSave,
  onReset,
  quickLaunchApps
}) => {
  const [localConfig, setLocalConfig] = useState<FloatConfigItem>(config);
  const installedPlugins = usePluginStore((state) => state.installedPlugins);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleTypeChange = (type: FloatConfigItem['type']) => {
    const isPredefined = isPredefinedIcon(localConfig.icon);
    const newConfig: FloatConfigItem = {
      ...localConfig,
      type,
      action: '',
      path: undefined,
      icon: type !== 'app' && !isPredefined ? 'HelpCircle' : localConfig.icon
    };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handleActionChange = (action: string) => {
    let newConfig: FloatConfigItem = { ...localConfig, action };

    if (localConfig.type === 'system') {
      const systemAction = SYSTEM_ACTIONS.find(a => a.action === action);
      if (systemAction) {
        newConfig = { ...newConfig, name: systemAction.label };
      }
    } else if (localConfig.type === 'nav') {
      const navAction = NAV_ACTIONS.find(a => a.action === action);
      if (navAction) {
        newConfig = { ...newConfig, name: navAction.label };
      }
    }

    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handlePathChange = (path: string, name: string, icon?: string) => {
    const newConfig: FloatConfigItem = {
      ...localConfig,
      type: 'app',
      action: 'open-app',
      path,
      name,
      icon: icon || localConfig.icon
    };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handleToolSelect = (toolId: string) => {
    const tool = ALL_TOOLS.find(t => t.id === toolId);
    if (tool) {
      const newConfig: FloatConfigItem = {
        ...localConfig,
        type: 'tool',
        action: tool.id,
        name: tool.name,
        path: tool.path,
        icon: tool.iconName || localConfig.icon,
        color: tool.color || localConfig.color
      };
      setLocalConfig(newConfig);
      onUpdate(newConfig);
    }
  };

  const handlePluginSelect = (pluginId: string) => {
    const plugin = installedPlugins.find(p => p.id === pluginId);
    if (plugin) {
      const newConfig: FloatConfigItem = {
        ...localConfig,
        type: 'plugin',
        action: plugin.id,
        name: plugin.name,
        path: plugin.iconUrl || undefined,
        icon: plugin.iconUrl ? `plugin:${plugin.id}` : (plugin.iconName || localConfig.icon),
        color: localConfig.color
      };
      setLocalConfig(newConfig);
      onUpdate(newConfig);
    }
  };

  const handleIconChange = (icon: string) => {
    const newConfig: FloatConfigItem = { ...localConfig, icon };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handleNameChange = (name: string) => {
    const newConfig: FloatConfigItem = { ...localConfig, name };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const getTypeLabel = () => {
    switch (localConfig.type) {
      case 'nav': return '导航';
      case 'tool': return '工具';
      case 'plugin': return '插件';
      case 'app': return '应用';
      case 'system': return '系统';
      default: return '';
    }
  };

  const isAppType = localConfig.type === 'app';
  const hasIconImg = !isPredefinedIcon(localConfig.icon) && !!formatIconSrc(localConfig.icon);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          {localConfig.type === 'plugin' && localConfig.path ? (
            <CachedIcon
              url={localConfig.path}
              name={localConfig.name}
              type="plugin"
              className="w-full h-full object-contain"
              fallbackIcon={
                (() => {
                  const { element } = renderFloatIcon(localConfig.icon, 18);
                  return <span className="text-white">{element}</span>;
                })()
              }
              iconOnly
            />
          ) : (
            (() => {
              const { element } = renderFloatIcon(localConfig.icon, 18);
              return <span className="text-white">{element}</span>;
            })()
          )}
        </div>
        <div>
          <div className="font-medium text-gray-800 dark:text-gray-200 text-sm">{localConfig.name}</div>
          <div className="text-xs text-gray-500">{getTypeLabel()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">类型</label>
          <div className="flex flex-wrap gap-2">
            {FLOAT_TYPE_OPTIONS.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  localConfig.type === type
                    ? 'bg-primary text-button-text'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">名称</label>
          <input
            type="text"
            value={localConfig.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          />
        </div>

        {localConfig.type === 'nav' && (
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">导航目标</label>
            <div className="flex flex-wrap gap-2">
              {NAV_ACTIONS.map(({ action, label }) => (
                <button
                  key={action}
                  onClick={() => handleActionChange(action)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    localConfig.action === action
                      ? 'bg-primary text-button-text'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {localConfig.type === 'tool' && (
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">选择工具</label>
            <select
              value={localConfig.action}
              onChange={(e) => handleToolSelect(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">请选择工具</option>
              {ALL_TOOLS.map((tool) => (
                <option key={tool.id} value={tool.id}>{tool.name}</option>
              ))}
            </select>
          </div>
        )}

        {localConfig.type === 'app' && (
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">选择应用</label>
            <select
              value={localConfig.path || ''}
              onChange={(e) => {
                const selectedApp = quickLaunchApps.find(a => a.path === e.target.value);
                if (selectedApp) {
                  handlePathChange(selectedApp.path, selectedApp.name, selectedApp.icon);
                }
              }}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              <option value="">请选择应用</option>
              {quickLaunchApps.map((app) => (
                <option key={app.id} value={app.path}>
                  {app.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {localConfig.type === 'system' && (
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">系统功能</label>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_ACTIONS.map(({ action, label }) => (
                <button
                  key={action}
                  onClick={() => handleActionChange(action)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    localConfig.action === action
                      ? 'bg-primary text-button-text'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {localConfig.type === 'plugin' && (
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">选择插件</label>
            {installedPlugins.length === 0 ? (
              <div className="text-xs text-gray-500 dark:text-gray-400 py-2">
                暂无已安装的插件，请先前往插件商店安装插件
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {installedPlugins.map((plugin) => {
                  const PluginIcon = iconMap[plugin.iconName] || iconMap.Package;
                  return (
                    <button
                      key={plugin.id}
                      onClick={() => handlePluginSelect(plugin.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
                        localConfig.action === plugin.id
                          ? 'bg-primary text-button-text'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {plugin.iconUrl ? (
                        <CachedIcon
                          url={plugin.iconUrl}
                          name={plugin.name}
                          type="plugin"
                          className="w-4 h-4"
                          fallbackIcon={<PluginIcon className="w-3 h-3" />}
                          iconOnly
                        />
                      ) : (
                        <PluginIcon className="w-3 h-3" />
                      )}
                      {plugin.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">图标</label>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-gray-100 dark:bg-gray-600 overflow-hidden">
              {localConfig.type === 'plugin' && localConfig.path ? (
                <CachedIcon
                  url={localConfig.path}
                  name={localConfig.name}
                  type="plugin"
                  className="w-full h-full object-contain"
                  iconOnly
                  fallbackIcon={
                    (() => {
                      const { element } = renderFloatIcon(localConfig.icon, 20);
                      return <span className="text-gray-600 dark:text-gray-300">{element}</span>;
                    })()
                  }
                />
              ) : (
                (() => {
                  const { element } = renderFloatIcon(localConfig.icon, 20);
                  return element;
                })()
              )}
            </div>

            {!isAppType && !hasIconImg && localConfig.type !== 'plugin' ? (
              <select
                value={localConfig.icon}
                onChange={(e) => handleIconChange(e.target.value)}
                className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {AVAILABLE_ICONS.map(({ name, label }) => (
                  <option key={name} value={name}>{label}</option>
                ))}
              </select>
            ) : (
              <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                {localConfig.type === 'plugin' ? '使用插件图标' : '使用应用图标'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <RotateCcw size={14} />
          重置
        </button>
        <button
          onClick={onSave}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700 rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
        >
          <Save size={14} />
          保存
        </button>
      </div>
    </div>
  );
};

export default FloatConfigEditor;
