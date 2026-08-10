import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, RefreshCw, MessageSquare, Clipboard, CheckSquare, Key,
  FileCode, Globe, Smile, Clock, ArrowUpDown, Hash, Copy,
  Table, Link, Map, QrCode, Code, AtSign, Tag, AlignLeft,
  Code2, Binary, Braces, Navigation, Newspaper, Languages, Cloud, FileText, Scan, Folder, StickyNote
} from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import { HomeToolItem, loadHomeTools, replaceHomeTool } from '../../utils/homeTools';
import { ALL_TOOLS } from '../../constants/tools';
import { isElectron } from '../../utils/environment';
import { useShallow } from 'zustand/shallow';
import { useSidebarStore } from '../../store/sidebarStore';
import './ToolsPage.css';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone,
  RefreshCw,
  MessageSquare,
  Clipboard,
  CheckSquare,
  Key,
  FileCode,
  Globe,
  Smile,
  Clock,
  ArrowUpDown,
  Hash,
  Copy,
  Table,
  Link,
  Map,
  QrCode,
  Code,
  AtSign,
  Tag,
  AlignLeft,
  Code2,
  Binary,
  Braces,
  Navigation,
  Newspaper,
  Languages,
  Cloud,
  FileText,
  Scan,
  Folder,
  StickyNote,
};

const BASE_TOOLS_IDS = ['todo', 'memo', 'quick-reply', 'cloud-clipboard', 'account', 'weather', 'navigation', 'news'];

const ToolsPage = () => {
  const navigate = useNavigate();
  const isDesktop = isElectron();
  const { pinnedToolIds, addPinnedTool, removePinnedTool } = useSidebarStore(useShallow((s) => ({
    pinnedToolIds: s.pinnedToolIds,
    addPinnedTool: s.addPinnedTool,
    removePinnedTool: s.removePinnedTool,
  })));
  
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);
  const [selectedTool, setSelectedTool] = useState<HomeToolItem | null>(null);

  const myTools = useMemo(() => {
    const toolIds = isDesktop ? [...BASE_TOOLS_IDS, 'notes'] : BASE_TOOLS_IDS;
    return ALL_TOOLS
      .filter(tool => toolIds.includes(tool.id))
      .map(tool => ({
        ...tool,
        icon: iconMap[tool.iconName] || Clipboard,
        textColor: 'var(--color-bg-primary)' as const,
      }));
  }, [isDesktop]);

  const newTools = useMemo(() => {
    const toolIds = isDesktop ? [...BASE_TOOLS_IDS, 'notes'] : BASE_TOOLS_IDS;
    return ALL_TOOLS
      .filter(tool => !toolIds.includes(tool.id) && (isElectron() || tool.id !== 'ocr') && (isDesktop || tool.id !== 'notes'))
      .map(tool => ({
        ...tool,
        icon: iconMap[tool.iconName] || Clipboard,
        textColor: 'var(--color-bg-primary)' as const,
      }));
  }, [isDesktop]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tool: typeof myTools[0]) => {
    e.preventDefault();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setSelectedTool({
      id: tool.id,
      name: tool.name,
      path: tool.path,
      color: tool.color,
      textColor: tool.textColor,
      iconName: tool.iconName,
    });
    setContextMenuOpen(true);
  }, []);

  const handleReplaceHomeTool = useCallback((index: number) => {
    if (selectedTool) {
      replaceHomeTool(index, selectedTool);
      setContextMenuOpen(false);
      setSelectedTool(null);
    }
  }, [selectedTool]);

  const handleToggleSidebarTool = useCallback(() => {
    if (selectedTool) {
      if (pinnedToolIds.includes(selectedTool.id)) {
        removePinnedTool(selectedTool.id);
      } else {
        addPinnedTool(selectedTool.id);
      }
      setContextMenuOpen(false);
      setSelectedTool(null);
    }
  }, [selectedTool, pinnedToolIds, addPinnedTool, removePinnedTool]);

  const getContextMenuItems = (): ContextMenuItem[] => {
    const homeTools = loadHomeTools();
    const isPinned = selectedTool ? pinnedToolIds.includes(selectedTool.id) : false;
    
    return [
      {
        id: 'replace-home-tool',
        label: '替换首页卡片',
        subMenu: homeTools.map((tool, index) => ({
          id: `replace-${index}`,
          label: `${index + 1}. ${tool.name}`,
          onClick: () => handleReplaceHomeTool(index),
        })),
      },
      { id: 'divider-1', divider: true },
      { id: 'toggle-sidebar', label: isPinned ? '移出侧边栏' : '加入侧边栏', onClick: handleToggleSidebarTool },
      { id: 'divider-2', divider: true },
      {
        id: 'open',
        label: '打开工具',
        onClick: () => {
          if (selectedTool) {
            navigate(selectedTool.path);
          }
          setContextMenuOpen(false);
          setSelectedTool(null);
        },
      },
    ];
  };

  const renderToolCard = (tool: typeof myTools[0]) => {
    const Icon = tool.icon;
    const isPinned = pinnedToolIds.includes(tool.id);
    
    return (
      <div
        key={tool.id}
        className={`tools-grid-item ${isPinned ? 'ring-2 ring-blue-500/30' : ''}`}
        style={{ backgroundColor: tool.color }}
        onClick={() => navigate(tool.path)}
        onContextMenu={(e) => handleContextMenu(e, tool)}
      >
        {isPinned && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
            <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
            </svg>
          </div>
        )}
        <Icon className="tools-grid-item-icon" />
        <span className="tools-grid-item-name" style={{ color: tool.textColor }}>{tool.name}</span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
        <div className="p-6">
          <h2 className="font-semibold mb-4 text-lg text-gray-800 dark:text-gray-200">我的工具</h2>
          <div className="tools-grid-wrapper">
            {myTools.map(renderToolCard)}
          </div>
        </div>

        {isDesktop && (
          <div className="p-6 pt-0">
            <h2 className="font-semibold mb-4 text-lg text-gray-800 dark:text-gray-200">实用工具</h2>
            <div className="tools-grid-wrapper">
              {newTools.map(renderToolCard)}
            </div>
          </div>
        )}

      {isDesktop && (
        <ContextMenu
          isOpen={contextMenuOpen}
          x={contextMenuX}
          y={contextMenuY}
          items={getContextMenuItems()}
          onClose={() => {
            setContextMenuOpen(false);
            setSelectedTool(null);
          }}
        />
      )}
    </div>
  );
};

export default ToolsPage;