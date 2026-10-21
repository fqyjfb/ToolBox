import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, RefreshCw, MessageSquare, Clipboard, CheckSquare, Key,
  FileCode, Globe, Smile, Clock, ArrowUpDown, Hash, Copy,
  Table, Link, Map, QrCode, Code, AtSign, Tag, AlignLeft,
  Code2, Binary, Braces, Navigation, Newspaper, Languages, Cloud, FileText, Scan, Folder, StickyNote,
  Home, Download, Bell, ExternalLink, Minus, PanelLeft
} from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import type { HomeToolItem } from '../../utils/homeTools';
import { ALL_TOOLS } from '../../constants/tools';
import { isElectron } from '../../utils/environment';
import { useShallow } from 'zustand/shallow';
import { useSidebarStore } from '../../store/sidebarStore';
import { useHomeToolsStore } from '../../store/homeToolsStore';
import { useToastStore } from '../../store/toastStore';
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
  Bell,
};

const BASE_TOOLS_IDS = ['todo', 'memo', 'quick-reply', 'cloud-clipboard', 'account', 'weather', 'navigation', 'news', 'reminder'];

const ToolsPage = () => {
  const navigate = useNavigate();
  const isDesktop = isElectron();
  const { pinnedToolIds, addPinnedTool, removePinnedTool } = useSidebarStore(useShallow((s) => ({
    pinnedToolIds: s.pinnedToolIds,
    addPinnedTool: s.addPinnedTool,
    removePinnedTool: s.removePinnedTool,
  })));
  
  const addToast = useToastStore(state => state.addToast);
  const { homeTools, addHomeTool, removeHomeTool } = useHomeToolsStore(useShallow((s) => ({
    homeTools: s.homeTools,
    addHomeTool: s.addTool,
    removeHomeTool: s.removeTool,
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

  const homeToolIds = useMemo(() => new Set(homeTools.map(tool => tool.id)), [homeTools]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tool: typeof myTools[0]) => {
    e.preventDefault();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setSelectedTool({
      id: tool.id,
      name: tool.name,
      path: tool.path,
      color: tool.color,
      // 首页工具卡片文字恒为白色，与工具中心卡片的文字色无关
      textColor: '#ffffff',
      iconName: tool.iconName,
    });
    setContextMenuOpen(true);
  }, []);

  // 首页工具卡片与工具中心共用 homeToolsStore，这里改完首页立即同步
  const handleToggleHomeTool = useCallback(() => {
    if (!selectedTool) return;

    const isOnHome = homeToolIds.has(selectedTool.id);
    if (isOnHome) {
      removeHomeTool(selectedTool.id);
      addToast({ type: 'success', message: `已将「${selectedTool.name}」移出首页` });
    } else {
      addHomeTool(selectedTool);
      addToast({ type: 'success', message: `已将「${selectedTool.name}」加入首页` });
    }
    setContextMenuOpen(false);
    setSelectedTool(null);
  }, [selectedTool, homeToolIds, addHomeTool, removeHomeTool, addToast]);

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
    const isPinned = selectedTool ? pinnedToolIds.includes(selectedTool.id) : false;
    const isOnHome = selectedTool ? homeToolIds.has(selectedTool.id) : false;

    const items: ContextMenuItem[] = [
      {
        id: 'open',
        label: '打开工具',
        icon: <ExternalLink className="w-4 h-4" />,
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
      items.push({ id: 'divider-1', divider: true });
      items.push({
        id: 'toggle-home',
        label: isOnHome ? '移出首页' : '加入首页',
        icon: isOnHome ? <Minus className="w-4 h-4" /> : <Home className="w-4 h-4" />,
        onClick: handleToggleHomeTool,
      });
      items.push({
        id: 'toggle-sidebar',
        label: isPinned ? '移出侧边栏' : '加入侧边栏',
        icon: isPinned ? <Minus className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />,
        onClick: handleToggleSidebarTool,
      });
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
    <div className="min-h-full flex flex-col">
        <div className="pt-0 mb-6">
          <h2 className="font-semibold mb-4 text-lg text-content-primary">我的工具</h2>
          <div className="tools-grid-wrapper">
            {myTools.map(renderToolCard)}
          </div>
        </div>

        <div className="pt-0">
          <h2 className="font-semibold mb-4 text-lg text-content-primary">实用工具</h2>
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