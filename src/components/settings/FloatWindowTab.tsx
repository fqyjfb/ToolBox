import React from 'react';
import { Circle, Info, Save, RotateCcw } from 'lucide-react';
import FloatConfigEditor from './FloatConfigEditor';
import { FloatConfigItem } from '../../types/settings';
import { QuickLaunchItem } from '../../utils/quickLaunch';

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
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <Circle size={16} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">悬浮窗设置</h2>
      </div>
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-2">
          <Info size={14} className="text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p>1. 悬浮球最多支持8个快捷操作按钮</p>
            <p>2. 导航类型：跳转到应用内的页面</p>
            <p>3. 工具类型：快速打开工具中心的工具</p>
            <p>4. 应用类型：快速启动快启动中的应用程序</p>
            <p>5. 系统类型：执行系统级操作（清空回收站、关机等）</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-3">
          {floatConfig.map((config, index) => (
            <FloatConfigEditor
              key={config.id}
              config={config}
              onUpdate={(updated) => onFloatConfigUpdate(index, updated)}
              quickLaunchApps={quickLaunchApps}
            />
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onResetFloatConfig}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RotateCcw size={14} />
            重置默认
          </button>
          <button
            onClick={onSaveFloatConfig}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-primary rounded-md hover:bg-primary/90 transition-colors"
          >
            <Save size={14} />
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatWindowTab;
