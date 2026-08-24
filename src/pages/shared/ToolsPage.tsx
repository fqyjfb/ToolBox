import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, RefreshCw, MessageSquare, Clipboard, CheckSquare, Key,
  FileCode, Globe, Smile, Clock, ArrowUpDown, Hash, Copy,
  Table, Link, Map, QrCode, Code, AtSign, Tag, AlignLeft,
  Code2, Binary, Braces, Navigation, Newspaper, Languages, Cloud, FileText, Scan, Folder, StickyNote, Home, Download
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
  Home,
  Download,
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
    return ALL_TOOLS
      .filter(tool => BASE_TOOLS_IDS.includes(tool.id))
      .map(tool => ({
        ...tool,
        icon: iconMap[tool.iconName] || Clipboard,
        textColor: 'var(--color-bg-primary)' as const,
      }));
  }, []);

  const newTools = useMemo(() => {
    return ALL_TOOLS
      .filter(tool => !BASE_TOOLS_IDS.includes(tool.id) && !(tool.id === 'notes' && !isDesktop))
      .map(tool => ({
        ...tool,
        icon: iconMap[tool.iconName] || Clipboard,
        textColor: 'var(--color-bg-primary)' as const,
      }));
  }, [isDesktop]);

  const [homeToolsVersion, setHomeToolsVersion] = useState(0);
  const homeToolIds = useMemo(() => new Set(loadHomeTools().map(t => t.id)), [homeToolsVersion]);

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
      setHomeToolsVersion(v => v + 1);
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

    const items: ContextMenuItem[] = [
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

    if (isDesktop) {
      items.splice(0, 0, {
        id: 'replace-home-tool',
        label: '加入首页',
        subMenu: homeTools.map((tool, index) => ({
          id: `replace-${index}`,
          label: `${index + 1}. ${tool.name}`,
          onClick: () => handleReplaceHomeTool(index),
        })),
      });
      items.push({ id: 'divider-1', divider: true });
      items.push({ id: 'toggle-sidebar', label: isPinned ? '移出侧边栏' : '加入侧边栏', onClick: handleToggleSidebarTool });
    }

    return items;
  };

  const renderToolCard = (tool: typeof myTools[0]) => {
    const Icon = tool.icon;
    const isPinned = pinnedToolIds.includes(tool.id);
    const isOnHome = homeToolIds.has(tool.id);

    return (
      <div
        key={tool.id}
        className={`tools-grid-item ${isPinned ? 'ring-2 ring-blue-500/30' : ''}`}
        style={{ backgroundColor: tool.color }}
        onClick={() => navigate(tool.path)}
        onContextMenu={(e) => handleContextMenu(e, tool)}
      >
        {isOnHome && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-white/90 flex items-center justify-center shadow-sm" title="首页显示">
            <Home className="w-3 h-3 text-blue-500" />
          </div>
        )}
        <Icon className="tools-grid-item-icon" />
        <span className="tools-grid-item-name" style={{ color: tool.textColor }}>{tool.name}</span>
      </div>
    );
  };

  const renderDownloadCard = (card: typeof downloadCard) => {
    const Icon = card.icon;

    return (
      <div
        key={card.id}
        className="tools-grid-item"
        style={{ backgroundColor: card.color }}
        onClick={() => navigate(card.path)}
      >
        <Icon className="tools-grid-item-icon" />
        <span className="tools-grid-item-name" style={{ color: card.textColor }}>{card.name}</span>
      </div>
    );
  };

  const downloadCard = {
    id: 'tool-downloads',
    name: '工具下载',
    path: '/tools/tool-downloads',
    color: '#059669',
    icon: Download,
    textColor: 'var(--color-bg-primary)' as const,
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
        <div className="pt-0 mb-6">
          <h2 className="font-semibold mb-4 text-lg text-gray-800 dark:text-gray-200">我的工具</h2>
          <div className="tools-grid-wrapper">
            {myTools.map(renderToolCard)}
          </div>
        </div>

        <div className="pt-0">
          <h2 className="font-semibold mb-4 text-lg text-gray-800 dark:text-gray-200">实用工具</h2>
          <div className="tools-grid-wrapper">
            {newTools.map(renderToolCard)}
            {renderDownloadCard(downloadCard)}
          </div>
        </div>

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