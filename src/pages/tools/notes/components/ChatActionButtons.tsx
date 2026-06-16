import React from 'react';
import { Calendar, Clock, BookOpen, ShoppingCart, PlayCircle, Archive } from 'lucide-react';

interface ChatActionButtonsProps {
  isVisible: boolean;
  onMove: (target: string) => void;
}

export const ChatActionButtons: React.FC<ChatActionButtonsProps> = ({
  isVisible,
  onMove,
}) => {
  const actions = [
    { icon: Calendar, label: '日记', target: 'journal' },
    { icon: Clock, label: '待办', target: 'later' },
    { icon: BookOpen, label: '阅读', target: 'read' },
    { icon: ShoppingCart, label: '购物', target: 'shop' },
    { icon: PlayCircle, label: '观看', target: 'watch' },
    { icon: Archive, label: '归档', target: 'archive' },
  ];

  return (
    <div
      className={`absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full flex gap-2 rounded-t-md bg-gray-200 dark:bg-gray-700 p-2 transition-opacity ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        transitionDelay: '0.17s',
      }}
    >
      {actions.map((action) => (
        <button
          key={action.target}
          className="relative flex h-8 w-8 items-center justify-center rounded bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-500 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onMove(action.target);
          }}
          title={action.label}
        >
          <action.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
};