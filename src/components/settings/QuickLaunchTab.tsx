import React from 'react';
import { Monitor } from 'lucide-react';

interface QuickLaunchTabProps {
  isScanning: boolean;
  onScanDesktopApps: () => void;
}

const QuickLaunchTab: React.FC<QuickLaunchTabProps> = ({ isScanning, onScanDesktopApps }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="w-5 h-5 flex items-center justify-center text-primary">
          <Monitor size={16} />
        </div>
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">快启动设置</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        <div className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <span className="text-sm text-gray-700 dark:text-gray-300">扫描桌面应用</span>
          <button
            onClick={onScanDesktopApps}
            disabled={isScanning}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-md transition-colors ${
              isScanning
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            <Monitor size={14} />
            {isScanning ? '扫描中...' : '扫描桌面'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickLaunchTab;
