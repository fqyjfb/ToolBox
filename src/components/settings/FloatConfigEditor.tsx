import React, { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { FloatConfigItem } from '../../types/settings';
import { QuickLaunchItem } from '../../utils/quickLaunch';
import {
  NAV_ACTIONS,
  SYSTEM_ACTIONS,
  FLOAT_TYPE_OPTIONS,
} from '../../constants/settings';
import { ALL_TOOLS } from '../../constants/tools';
import { lucideIconToDataUrl, getTargetIcon } from '../../utils/floatIconRenderer';
import { usePluginStore } from '../../store/pluginStore';
import CachedIcon from '../ui/CachedIcon';
import FloatIconView from '../ui/FloatIconView';
import Select from '../ui/Select';
import { iconMap } from '../../utils/iconMap';

interface FloatConfigEditorProps {
  config: FloatConfigItem;
  onUpdate: (config: FloatConfigItem) => void;
  onSave: () => void;
  onReset: () => void;
  quickLaunchApps: QuickLaunchItem[];
}

// 图标随所选功能自动确定，图标设置项仅作说明，不再提供手动选择列表
const AUTO_ICON_LABELS: Record<FloatConfigItem['type'], string> = {
  nav: '使用导航图标',
  tool: '使用工具图标',
  app: '使用应用图标',
  system: '使用系统图标',
  plugin: '使用插件图标',
};

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
    // 切换类型后目标重置，图标同步收敛为新类型对应（首个）功能的原有图标
    const newConfig: FloatConfigItem = {
      ...localConfig,
      type,
      action: '',
      path: undefined,
      icon: getTargetIcon(type, '')
    };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handleActionChange = (action: string) => {
    const actionList = localConfig.type === 'system' ? SYSTEM_ACTIONS : NAV_ACTIONS;
    const target = actionList.find(item => item.action === action);
    if (!target) return;

    const newConfig: FloatConfigItem = {
      ...localConfig,
      action,
      name: target.label,
      icon: lucideIconToDataUrl(target.icon)
    };

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
      const Icon = iconMap[tool.iconName] || iconMap.Package;
      const newConfig: FloatConfigItem = {
        ...localConfig,
        type: 'tool',
        action: tool.id,
        name: tool.name,
        path: tool.path,
        icon: lucideIconToDataUrl(Icon),
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <FloatIconView
            icon={localConfig.icon}
            path={localConfig.path}
            isPlugin={localConfig.type === 'plugin'}
            name={localConfig.name}
            size={20}
            className="text-white"
          />
        </div>
        <div>
          <div className="font-medium text-content-primary text-sm">{localConfig.name}</div>
          <div className="text-xs text-content-secondary">{getTypeLabel()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-content-secondary mb-1">类型</label>
          <div className="flex flex-wrap gap-2">
            {FLOAT_TYPE_OPTIONS.map(({ type, label }) => (
              <button
                key={type}
                onClick={() => handleTypeChange(type)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  localConfig.type === type
                    ? 'bg-primary text-button-text'
                    : 'bg-surface text-content-primary hover:bg-menu-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-content-secondary mb-1">名称</label>
          <input
            type="text"
            value={localConfig.name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-2 py-1 text-xs border border-content bg-surface text-content-primary"
          />
        </div>

        {localConfig.type === 'nav' && (
          <div className="col-span-2">
            <label className="block text-xs text-content-secondary mb-1">导航目标</label>
            <div className="flex flex-wrap gap-2">
              {NAV_ACTIONS.map(({ action, label }) => (
                <button
                  key={action}
                  onClick={() => handleActionChange(action)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    localConfig.action === action
                      ? 'bg-primary text-button-text'
                      : 'bg-surface text-content-primary hover:bg-menu-hover'
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
            <label className="block text-xs text-content-secondary mb-1">选择工具</label>
            <Select
              value={localConfig.action}
              onChange={handleToolSelect}
              options={[
                { value: '', label: '请选择工具' },
                ...ALL_TOOLS.map((tool) => ({ value: tool.id, label: tool.name }))
              ]}
              dense
              className="w-full border border-content bg-surface text-content-primary"
            />
          </div>
        )}

        {localConfig.type === 'app' && (
          <div className="col-span-2">
            <label className="block text-xs text-content-secondary mb-1">选择应用</label>
            <Select
              value={localConfig.path || ''}
              onChange={(v) => {
                const selectedApp = quickLaunchApps.find(a => a.path === v);
                if (selectedApp) {
                  handlePathChange(selectedApp.path, selectedApp.name, selectedApp.icon);
                }
              }}
              options={[
                { value: '', label: '请选择应用' },
                ...quickLaunchApps.map((app) => ({ value: app.path, label: app.name }))
              ]}
              dense
              className="w-full border border-content bg-surface text-content-primary"
            />
          </div>
        )}

        {localConfig.type === 'system' && (
          <div className="col-span-2">
            <label className="block text-xs text-content-secondary mb-1">系统功能</label>
            <div className="flex flex-wrap gap-2">
              {SYSTEM_ACTIONS.map(({ action, label }) => (
                <button
                  key={action}
                  onClick={() => handleActionChange(action)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    localConfig.action === action
                      ? 'bg-primary text-button-text'
                      : 'bg-surface text-content-primary hover:bg-menu-hover'
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
            <label className="block text-xs text-content-secondary mb-1">选择插件</label>
            {installedPlugins.length === 0 ? (
              <div className="text-xs text-content-secondary py-2">
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
                          : 'bg-surface text-content-primary hover:bg-menu-hover'
                      }`}
                    >
                      {plugin.iconUrl ? (
                        <CachedIcon
                          url={plugin.iconUrl}
                          name={plugin.name}
                          type="plugin"
                          className="w-4 h-4"
                          fallbackIcon={<PluginIcon className="w-4 h-4" />}
                          iconOnly
                        />
                      ) : (
                        <PluginIcon className="w-4 h-4" />
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
          <label className="block text-xs text-content-secondary mb-1">图标</label>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-surface-secondary overflow-hidden">
              <FloatIconView
                icon={localConfig.icon}
                path={localConfig.path}
                isPlugin={localConfig.type === 'plugin'}
                name={localConfig.name}
                size={20}
                className="text-content-secondary"
              />
            </div>
            <span className="flex-1 text-xs text-content-secondary">
              {AUTO_ICON_LABELS[localConfig.type]}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-3 pt-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-content-secondary bg-surface-secondary hover:bg-menu-hover rounded-md transition-colors"
        >
          <RotateCcw size={14} />
          重置全部配置
        </button>
        <button
          onClick={onSave}
          className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-button-text bg-primary rounded-md hover:bg-primary-hover transition-colors"
        >
          <Save size={14} />
          保存全部配置
        </button>
      </div>
    </div>
  );
};

export default FloatConfigEditor;
