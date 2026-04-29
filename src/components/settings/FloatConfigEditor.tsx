import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FloatConfigItem } from '../../types/settings';
import { QuickLaunchItem } from '../../utils/quickLaunch';
import {
  AVAILABLE_ICONS,
  AVAILABLE_COLORS,
  NAV_ACTIONS,
  SYSTEM_ACTIONS,
  FLOAT_TYPE_OPTIONS
} from '../../constants/settings';
import { ALL_TOOLS } from '../../constants/tools';
import IconComponent from './IconComponent';

interface FloatConfigEditorProps {
  config: FloatConfigItem;
  onUpdate: (config: FloatConfigItem) => void;
  quickLaunchApps: QuickLaunchItem[];
}

const FloatConfigEditor: React.FC<FloatConfigEditorProps> = ({
  config,
  onUpdate,
  quickLaunchApps
}) => {
  const [expanded, setExpanded] = useState(false);
  const [localConfig, setLocalConfig] = useState<FloatConfigItem>(config);

  const handleTypeChange = (type: FloatConfigItem['type']) => {
    const newConfig: FloatConfigItem = { ...localConfig, type, action: '', path: undefined };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handleActionChange = (action: string) => {
    const newConfig: FloatConfigItem = { ...localConfig, action };
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

  const handleIconChange = (icon: string) => {
    const newConfig: FloatConfigItem = { ...localConfig, icon };
    setLocalConfig(newConfig);
    onUpdate(newConfig);
  };

  const handleColorChange = (color: string) => {
    const newConfig: FloatConfigItem = { ...localConfig, color };
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
      case 'app': return '应用程序';
      case 'system': return '系统功能';
      default: return '';
    }
  };

  const isBase64Icon = (icon: string) => {
    return icon && icon.startsWith('data:image/');
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: localConfig.color }}
          >
            {isBase64Icon(localConfig.icon) ? (
              <img src={localConfig.icon} alt="" className="w-8 h-8 object-contain rounded-full" />
            ) : (
              <IconComponent name={localConfig.icon} color="#fff" size={18} />
            )}
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-800 dark:text-gray-200">{localConfig.name}</div>
            <div className="text-xs text-gray-500">{getTypeLabel()}</div>
          </div>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className="px-4 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
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
                        ? 'bg-primary text-white'
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
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
                          ? 'bg-primary text-white'
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
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
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
                          ? 'bg-primary text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">图标</label>
              <div className="flex items-center gap-2">
                {isBase64Icon(localConfig.icon) ? (
                  <div className="w-8 h-8 rounded flex items-center justify-center">
                    <img src={localConfig.icon} alt="" className="w-full h-full object-contain rounded" />
                  </div>
                ) : (
                  <IconComponent name={localConfig.icon} color={localConfig.color} size={24} />
                )}
                {!isBase64Icon(localConfig.icon) && (
                  <select
                    value={localConfig.icon}
                    onChange={(e) => handleIconChange(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  >
                    {AVAILABLE_ICONS.map(({ name, label }) => (
                      <option key={name} value={name}>{label}</option>
                    ))}
                  </select>
                )}
                {isBase64Icon(localConfig.icon) && (
                  <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">
                    使用应用图标
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localConfig.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <div className="flex flex-wrap gap-1 flex-1">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                        localConfig.color === color ? 'ring-2 ring-offset-1 ring-primary' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatConfigEditor;
