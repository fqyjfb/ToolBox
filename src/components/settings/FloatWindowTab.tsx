import React from 'react';
import { Circle, Save, RotateCcw } from 'lucide-react';
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
        <div className="flex justify-center gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onResetFloatConfig}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RotateCcw size={14} />
            重置
          </button>
          <button
            onClick={onSaveFloatConfig}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-gray-800 dark:bg-gray-700 rounded-md hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            <Save size={14} />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloatWindowTab;
