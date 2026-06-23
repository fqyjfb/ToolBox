import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSidebarStore } from '../store/sidebarStore';
import { ALL_TOOLS } from '../constants/tools';

export const RecentToolsHandler: React.FC = () => {
  const location = useLocation();
  const addRecentTool = useSidebarStore((s) => s.addRecentTool);

  useEffect(() => {
    const tool = ALL_TOOLS.find((t) => location.pathname === t.path);
    if (tool) {
      addRecentTool(tool.id);
    }
  }, [location.pathname, addRecentTool]);

  return null;
};