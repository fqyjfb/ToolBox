import React from 'react';
import { Calendar, Clock, BookOpen, ShoppingCart, PlayCircle, Archive } from 'lucide-react';

interface ChatActionButtonsProps {
  isVisible: boolean;
  onMove: (target: string) => void;
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
}) => {
  return (
    <div className={`flex items-center gap-0.5 transition-opacity ${isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
      {ACTIONS.map((action) => (
        <button
          key={action.target}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-primary/10 hover:text-primary dark:text-gray-400 dark:hover:bg-primary/20 dark:hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onMove(action.target);
          }}
          title={action.label}
        >
          <action.icon className="h-3 w-3" />
        </button>
      ))}
    </div>
  );
};
