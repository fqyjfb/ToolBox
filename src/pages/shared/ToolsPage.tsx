import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, RefreshCw, MessageSquare, Clipboard, CheckSquare, Key,
  FileCode, Globe, Smile, Clock, ArrowUpDown, Hash, Copy,
  Table, Link, Map, QrCode, Code, AtSign, Tag, AlignLeft,
  Code2, Binary, Braces, Navigation, Newspaper, Languages, Cloud, FileText, Scan, Folder
} from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import { HomeToolItem, loadHomeTools, replaceHomeTool } from '../../utils/homeTools';
import { ALL_TOOLS } from '../../constants/tools';
import { isElectron } from '../../utils/environment';
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
};

const MY_TOOLS_IDS = ['todo', 'notes', 'quick-reply', 'cloud-clipboard', 'account', 'weather', 'navigation', 'news'];

const ToolsPage = () => {
  const navigate = useNavigate();
  
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);
  const [selectedTool, setSelectedTool] = useState<HomeToolItem | null>(null);

  const myTools = useMemo(() => {
    return ALL_TOOLS
      .filter(tool => MY_TOOLS_IDS.includes(tool.id))
      .map(tool => ({
        ...tool,
        icon: iconMap[tool.iconName] || Clipboard,
        textColor: 'var(--color-bg-primary)' as const,
      }));
  }, []);

  const newTools = useMemo(() => {
    return ALL_TOOLS
      .filter(tool => !MY_TOOLS_IDS.includes(tool.id) && (isElectron() || tool.id !== 'ocr'))
      .map(tool => ({
        ...tool,
        icon: iconMap[tool.iconName] || Clipboard,
        textColor: 'var(--color-bg-primary)' as const,
      }));
  }, []);

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

  const getContextMenuItems = (): ContextMenuItem[] => {
    const homeTools = loadHomeTools();
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
      { id: 'divider', divider: true },
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
    return (
      <div
        key={tool.id}
        className="tools-grid-item"
        style={{ backgroundColor: tool.color }}
        onClick={() => navigate(tool.path)}
        onContextMenu={(e) => handleContextMenu(e, tool)}
      >
        <Icon className="tools-grid-item-icon" />
        <span className="tools-grid-item-name" style={{ color: tool.textColor }}>{tool.name}</span>
      </div>
    );
  };

  return (
    <div className="h-full p-6 overflow-auto" style={{ backgroundColor: 'var(--color-card)' }}>
      <div className="tools-page-content">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">我的工具</h2>
          <div className="tools-grid-wrapper">
            {myTools.map(renderToolCard)}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">实用工具</h2>
          <div className="tools-grid-wrapper">
            {newTools.map(renderToolCard)}
          </div>
        </div>
      </div>

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
    </div>
  );
};

export default ToolsPage;
