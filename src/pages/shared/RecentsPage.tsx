import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Trash2, ArrowRight } from 'lucide-react';
import { useSidebarStore } from '../../store/sidebarStore';
import { ALL_TOOLS } from '../../constants/tools';
import { iconMap } from '../../utils/iconMap';
import './RecentsPage.css';

const RecentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { recentToolIds, clearRecentTools } = useSidebarStore();

  const tools = recentToolIds
    .map((id) => ALL_TOOLS.find((t) => t.id === id))
    .filter(Boolean) as typeof ALL_TOOLS;

  return (
    <div className="h-full flex flex-col p-4">
      <div className="recents-header">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">最近使用</h1>
          {tools.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">({tools.length}/10)</span>
          )}
        </div>
        {tools.length > 0 && (
          <button
            onClick={clearRecentTools}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Trash2 className="w-3 h-3" />
            清空
          </button>
        )}
      </div>

      <div className="recents-content">
        {tools.length === 0 ? (
          <div className="recents-empty">
            <Clock className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-sm text-gray-400 dark:text-gray-500">暂无最近使用的工具</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">访问工具后将自动记录</p>
          </div>
        ) : (
          <div className="recents-list">
            {tools.map((tool, index) => {
              const Icon = iconMap[tool.iconName];
              return (
                <div
                  key={`${tool.id}-${index}`}
                  onClick={() => navigate(tool.path)}
                  className="recents-item"
                >
                  <div
                    className="recents-icon"
                    style={{ backgroundColor: tool.color }}
                  >
                    {Icon && <Icon className="w-4 h-4 text-white" />}
                  </div>
                  <span className="recents-name">{tool.name}</span>
                  <ArrowRight className="w-3 h-3 text-gray-300 dark:text-gray-600 recents-arrow" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentsPage;