import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Phone, RefreshCw, MessageSquare, Clipboard, CheckSquare, Key,
  FileCode, Globe, Smile, Clock, ArrowUpDown, Hash, Copy,
  Table, Link, Map, QrCode, Code, AtSign, Tag, AlignLeft, 
  Code2, Binary, Braces, Navigation, Newspaper, Languages, Cloud
} from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '../../components/ui/ContextMenu';
import { HomeToolItem, loadHomeTools, replaceHomeTool } from '../../utils/homeTools';
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
};

const ToolsPage = () => {
  const navigate = useNavigate();
  
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);
  const [selectedTool, setSelectedTool] = useState<HomeToolItem | null>(null);

  const existingTools = [
    { id: 'todo', name: '待办事项', icon: CheckSquare, path: '/tools/todo', color: '#bc8acf', textColor: '#fff' },
    { id: 'quick-reply', name: '快捷回复', icon: MessageSquare, path: '/tools/quick-reply', color: '#e91e63', textColor: '#fff' },
    { id: 'cloud-clipboard', name: '云剪贴板', icon: Clipboard, path: '/tools/cloud-clipboard', color: '#67aaf7', textColor: '#fff' },
    { id: 'account', name: '账号管理', icon: Key, path: '/tools/account', color: '#00bcd4', textColor: '#fff' },
    { id: 'weather', name: '天气预报', icon: Cloud, path: '/tools/weather', color: '#3b82f6', textColor: '#fff' },
    { id: 'navigation', name: '导航', icon: Navigation, path: '/nav', color: '#4caf50', textColor: '#fff' },
    { id: 'news', name: '新闻', icon: Newspaper, path: '/news', color: '#ff9800', textColor: '#fff' },
  ];

  const newTools = [
    { id: 'exchange', name: '汇率换算', icon: RefreshCw, path: '/tools/exchange', color: '#f5a623', textColor: '#fff' },
    { id: 'translate', name: '在线翻译', icon: Languages, path: '/tools/translate', color: '#3b82f6', textColor: '#fff' },
    { id: 'country-code', name: '区号查询', icon: Phone, path: '/tools/country-code', color: '#9c27b0', textColor: '#fff' },
    { id: 'markdown-to-wechat', name: 'Markdown', icon: FileCode, path: '/tools/markdown-to-wechat', color: '#3b82f6', textColor: '#fff' },
    { id: 'ip-info', name: 'IP地址查询', icon: Globe, path: '/tools/ip-info', color: '#06b6d4', textColor: '#fff' },
    { id: 'emoji-remover', name: 'Emoji清理器', icon: Smile, path: '/tools/emoji-remover', color: '#14b8a6', textColor: '#fff' },
    { id: 'json-formatter', name: 'JSON格式化', icon: Braces, path: '/tools/json-formatter', color: '#8b5cf6', textColor: '#fff' },
    { id: 'timestamp-converter', name: '时间戳转换', icon: Clock, path: '/tools/timestamp-converter', color: '#f5576c', textColor: '#fff' },
    { id: 'case-converter', name: '大小写转换', icon: ArrowUpDown, path: '/tools/case-converter', color: '#4facfe', textColor: '#fff' },
    { id: 'hash-generator', name: '哈希生成器', icon: Hash, path: '/tools/hash-generator', color: '#f97316', textColor: '#fff' },
    { id: 'text-deduplicator', name: '文本去重', icon: Copy, path: '/tools/text-deduplicator', color: '#ec4899', textColor: '#fff' },
    { id: 'csv-to-json', name: 'CSV转JSON', icon: Table, path: '/tools/csv-to-json', color: '#10b981', textColor: '#fff' },
    { id: 'json-to-csv', name: 'JSON转CSV', icon: Table, path: '/tools/json-to-csv', color: '#34d399', textColor: '#fff' },
    { id: 'url-parser', name: 'URL解析器', icon: Link, path: '/tools/url-parser', color: '#0ea5e9', textColor: '#fff' },
    { id: 'sitemap-generator', name: 'Sitemap生成器', icon: Map, path: '/tools/sitemap-generator', color: '#84cc16', textColor: '#fff' },
    { id: 'qr-generator', name: '二维码生成器', icon: QrCode, path: '/tools/qr-generator', color: '#a855f7', textColor: '#fff' },
    { id: 'regex-tester', name: '正则测试器', icon: Code, path: '/tools/regex-tester', color: '#ef4444', textColor: '#fff' },
    { id: 'url-encode', name: 'URL编码解码', icon: AtSign, path: '/tools/url-encode', color: '#22d3ee', textColor: '#fff' },
    { id: 'meta-tags-generator', name: 'Meta标签生成', icon: Tag, path: '/tools/meta-tags-generator', color: '#f43f5e', textColor: '#fff' },
    { id: 'markdown-to-text', name: 'MD转纯文本', icon: AlignLeft, path: '/tools/markdown-to-text', color: '#2563eb', textColor: '#fff' },
    { id: 'html-to-text', name: 'HTML转纯文本', icon: AlignLeft, path: '/tools/html-to-text', color: '#1d4ed8', textColor: '#fff' },
    { id: 'sql-minifier', name: 'SQL压缩器', icon: Code2, path: '/tools/sql-minifier', color: '#059669', textColor: '#fff' },
    { id: 'hex-encode', name: 'HEX编码', icon: Binary, path: '/tools/hex-encode', color: '#dc2626', textColor: '#fff' },
    { id: 'hex-decode', name: 'HEX解码', icon: Binary, path: '/tools/hex-decode', color: '#b91c1c', textColor: '#fff' },
  ];

  const handleContextMenu = useCallback((e: React.MouseEvent, tool: typeof existingTools[0]) => {
    e.preventDefault();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setSelectedTool({
      id: tool.id,
      name: tool.name,
      path: tool.path,
      color: tool.color,
      textColor: tool.textColor,
      iconName: Object.entries(iconMap).find(([, Icon]) => Icon === tool.icon)?.[0] || 'Clipboard',
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

  const renderToolCard = (tool: typeof existingTools[0]) => {
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
    <div className="h-full p-6 overflow-auto">
      <div className="tools-page-content">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">我的工具</h2>
          <div className="tools-grid-wrapper">
            {existingTools.map(renderToolCard)}
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
