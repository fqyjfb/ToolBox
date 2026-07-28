import React, { useState } from 'react';
import FloatConfigEditor from './FloatConfigEditor';
import SettingCard from './SettingCard';
import { FloatConfigItem } from '../../types/settings';
import { QuickLaunchItem } from '../../utils/quickLaunch';
import { renderFloatIcon, isPluginIcon } from '../../utils/floatIconRenderer';
import CachedPluginIcon from '../plugins/CachedPluginIcon';

interface FloatWindowTabProps {
  floatConfig: FloatConfigItem[];
  quickLaunchApps: QuickLaunchItem[];
  onFloatConfigUpdate: (index: number, config: FloatConfigItem) => void;
  onSaveFloatConfig: () => void;
  onResetFloatConfig: () => void;
}

const FloatWindowTab: React.FC<FloatWindowTabProps> = ({
  floatConfig,
  quickLaunchApps,
  onFloatConfigUpdate,
  onSaveFloatConfig,
  onResetFloatConfig
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);

  const safeActiveIndex = floatConfig.length > 0 ? Math.min(activeIndex, floatConfig.length - 1) : 0;

  const handleIconClick = (index: number) => {
    setActiveIndex(index);
  };

  const getRadialPosition = (index: number, total: number) => {
    if (total <= 1) return { x: 0, y: 0 };
    const angle = (index * 360 / total) - 90;
    const radius = total <= 4 ? 48 : total <= 6 ? 52 : 56;
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius
    };
  };

  return (
    <SettingCard>
      <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <svg width="16" height="16" viewBox="0 0 1024 1024" fill="currentColor">
            <circle cx="512" cy="512" r="480" fill="none" stroke="currentColor" strokeWidth="40" opacity="0.3" />
            <circle cx="512" cy="512" r="200" />
          </svg>
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">悬浮窗设置</h2>
      </div>

      <div className="p-4">
        <div className="flex justify-center py-6">
          <div className="relative" style={{ width: 180, height: 180 }}>
            {floatConfig.map((config, index) => {
              const pos = getRadialPosition(index, floatConfig.length);
              const isActive = safeActiveIndex === index;
              const isPlugin = isPluginIcon(config.icon);
              const { element } = renderFloatIcon(config.icon, 16);
              
              return (
                <button
                  key={config.id}
                  onClick={() => handleIconClick(index)}
                  className={`absolute flex items-center justify-center rounded-full transition-transform duration-200 overflow-hidden ${
                    isActive ? 'scale-110' : 'hover:scale-105'
                  }`}
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: 'var(--color-primary)',
                    left: '50%',
                    top: '50%',
                    transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) scale(${isActive ? 1.1 : 1})`,
                    boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  title={config.name}
                >
                  {isPlugin && config.path ? (
                    <CachedPluginIcon
                      url={config.path}
                      name={config.name}
                      type="plugin"
                      className="w-full h-full object-contain"
                      fallbackIcon={<span className="text-white">{element}</span>}
                    />
                  ) : (
                    <span className="text-white">{element}</span>
                  )}
                </button>
              );
            })}

            <div
              className="absolute flex items-center justify-center rounded-full bg-white dark:bg-gray-700"
              style={{
                width: 48,
                height: 48,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
              }}
            >
              {floatConfig[safeActiveIndex] && (
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 text-center leading-tight">
                  {floatConfig[safeActiveIndex].name.length > 4
                    ? floatConfig[safeActiveIndex].name.slice(0, 4)
                    : floatConfig[safeActiveIndex].name}
                </span>
              )}
            </div>
          </div>
        </div>

        {floatConfig[safeActiveIndex] && (
          <FloatConfigEditor
            key={floatConfig[safeActiveIndex].id}
            config={floatConfig[safeActiveIndex]}
            onUpdate={(updated) => onFloatConfigUpdate(safeActiveIndex, updated)}
            onSave={onSaveFloatConfig}
            onReset={onResetFloatConfig}
            quickLaunchApps={quickLaunchApps}
          />
        )}
      </div>
    </SettingCard>
  );
};

export default FloatWindowTab;
