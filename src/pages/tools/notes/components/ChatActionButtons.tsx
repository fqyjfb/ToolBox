import React from 'react';
import { Calendar, Clock, BookOpen, ShoppingCart, PlayCircle, Archive, Trash2 } from 'lucide-react';

interface ChatActionButtonsProps {
  isVisible: boolean;
  onMove: (target: string) => void;
  onDelete?: (messageId: string) => void;
  messageId?: string;
}

const ACTIONS = [
  { icon: Calendar, label: '日记', target: 'journal' },
  { icon: Clock, label: '待办', target: 'later' },
  { icon: BookOpen, label: '阅读', target: 'read' },
  { icon: ShoppingCart, label: '购物', target: 'shop' },
  { icon: PlayCircle, label: '观看', target: 'watch' },
  { icon: Archive, label: '归档', target: 'archive' },
];

export const ChatActionButtons: React.FC<ChatActionButtonsProps> = ({
  isVisible,
  onMove,
  onDelete,
  messageId,
}) => {
  return (
    <div className={`flex items-center gap-0.5 transition-opacity ${isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      {ACTIONS.map((action) => (
        <button
          key={action.target}
          className="flex h-5 w-5 items-center justify-center rounded text-content-tertiary hover:bg-primary/10 hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onMove(action.target);
          }}
          title={action.label}
        >
          <action.icon className="h-3 w-3" />
        </button>
      ))}
      {onDelete && messageId && (
        <button
          className="flex h-5 w-5 items-center justify-center rounded text-content-tertiary hover:bg-error/10 hover:text-error transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(messageId);
          }}
          title="删除"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};
