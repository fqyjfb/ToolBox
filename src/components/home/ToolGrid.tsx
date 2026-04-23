import React from 'react';
import { Clipboard } from 'lucide-react';
import type { HomeToolItem } from '../../utils/homeTools';

interface ToolGridProps {
  tools: HomeToolItem[];
  onToolClick: (path: string) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Phone: React.lazy(() => import('lucide-react').then(m => ({ default: m.Phone }))),
  RefreshCw: React.lazy(() => import('lucide-react').then(m => ({ default: m.RefreshCw }))),
  MessageSquare: React.lazy(() => import('lucide-react').then(m => ({ default: m.MessageSquare }))),
  Clipboard,
  CheckSquare: React.lazy(() => import('lucide-react').then(m => ({ default: m.CheckSquare }))),
  Key: React.lazy(() => import('lucide-react').then(m => ({ default: m.Key }))),
  FileCode: React.lazy(() => import('lucide-react').then(m => ({ default: m.FileCode }))),
  Globe: React.lazy(() => import('lucide-react').then(m => ({ default: m.Globe }))),
  Smile: React.lazy(() => import('lucide-react').then(m => ({ default: m.Smile }))),
  Clock: React.lazy(() => import('lucide-react').then(m => ({ default: m.Clock }))),
  ArrowUpDown: React.lazy(() => import('lucide-react').then(m => ({ default: m.ArrowUpDown }))),
  Hash: React.lazy(() => import('lucide-react').then(m => ({ default: m.Hash }))),
  Copy: React.lazy(() => import('lucide-react').then(m => ({ default: m.Copy }))),
  Table: React.lazy(() => import('lucide-react').then(m => ({ default: m.Table }))),
  Link: React.lazy(() => import('lucide-react').then(m => ({ default: m.Link }))),
  Map: React.lazy(() => import('lucide-react').then(m => ({ default: m.Map }))),
  QrCode: React.lazy(() => import('lucide-react').then(m => ({ default: m.QrCode }))),
  Code: React.lazy(() => import('lucide-react').then(m => ({ default: m.Code }))),
  AtSign: React.lazy(() => import('lucide-react').then(m => ({ default: m.AtSign }))),
  Tag: React.lazy(() => import('lucide-react').then(m => ({ default: m.Tag }))),
  AlignLeft: React.lazy(() => import('lucide-react').then(m => ({ default: m.AlignLeft }))),
  Code2: React.lazy(() => import('lucide-react').then(m => ({ default: m.Code2 }))),
  Binary: React.lazy(() => import('lucide-react').then(m => ({ default: m.Binary }))),
  Braces: React.lazy(() => import('lucide-react').then(m => ({ default: m.Braces }))),
  Navigation: React.lazy(() => import('lucide-react').then(m => ({ default: m.Navigation }))),
  Newspaper: React.lazy(() => import('lucide-react').then(m => ({ default: m.Newspaper }))),
};

const ToolGrid: React.FC<ToolGridProps> = ({ tools, onToolClick }) => {
  return (
    <div className="flex-shrink-0">
      <div className="tools-grid">
        {tools.map((tool, index) => {
          const IconComponent = iconMap[tool.iconName] || Clipboard;
          return (
            <div
              key={tool.id}
              className={`tools-item ${index === tools.length - 1 ? 'tools-item--wide' : ''}`}
              style={{ backgroundColor: tool.color }}
              onClick={() => onToolClick(tool.path)}
            >
              <IconComponent className="w-10 h-10" />
              <span className="tools-name" style={{ color: tool.textColor }}>{tool.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ToolGrid;