import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { ChatActionButtons } from './ChatActionButtons';

interface ChatMessageListProps {
  messages: ChatMessage[];
  selectedMessages: string[];
  onToggleDone: (messageId: string) => void;
  onToggleSelection: (messageId: string, multiSelect?: boolean) => void;
  onMove: (target: string) => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  selectedMessages,
  onToggleDone,
  onToggleSelection,
  onMove,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredMessage, setHoveredMessage] = useState<string | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleMessageClick = (e: React.MouseEvent, messageId: string) => {
    const multiSelect = e.metaKey || e.ctrlKey;
    onToggleSelection(messageId, multiSelect);
  };

  const messagesByDate = messages.reduce((acc, msg) => {
    if (!acc[msg.date]) {
      acc[msg.date] = [];
    }
    acc[msg.date].push(msg);
    return acc;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin"
      onClick={(e) => {
        if (!((e.target as HTMLElement).closest('.chat-message'))) {
          onToggleSelection('');
        }
      }}
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-gray-400">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 21h8a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 11.586 3H4a2 2 0 0 0 2 2v14a2 2 0 0 0 2 2z" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium">释放思绪</h3>
          <p className="mt-1 text-xs">开始输入，记录你的想法</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {Object.entries(messagesByDate).map(([date, dateMessages]) => (
            <div key={date} className="w-full max-w-[720px]">
              <div className="px-2 py-1 text-xs font-medium text-gray-400">
                {date}
              </div>
              <div className="space-y-0.5">
                {dateMessages.map((message) => {
                  const isSelected = selectedMessages.includes(message.id);
                  const isLastSelected = selectedMessages[selectedMessages.length - 1] === message.id;
                  const showActions = selectedMessages.length > 0 ? isLastSelected : hoveredMessage === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`chat-message flex cursor-pointer items-start gap-1.5 rounded px-2 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-100 dark:bg-blue-500/25'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      } ${message.done ? 'opacity-60' : ''}`}
                      onClick={(e) => handleMessageClick(e, message.id)}
                      onDoubleClick={() => onToggleDone(message.id)}
                      onMouseEnter={() => setHoveredMessage(message.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      <button
                        className={`mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary text-button-text'
                            : 'border-gray-300 dark:border-gray-600 hover:border-primary'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelection(message.id, true);
                        }}
                        title={isSelected ? '取消选择' : '选择'}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>

                      <button
                        className={`mt-px flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                          message.done
                            ? 'border-success bg-success text-white'
                            : 'border-gray-300 dark:border-gray-600 hover:border-success'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleDone(message.id);
                        }}
                        title={message.done ? '标记未完成' : '标记完成'}
                      >
                        {message.done && <Check className="h-3 w-3" />}
                      </button>

                      <p className={`min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed ${
                        message.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {message.text}
                      </p>

                      <div className="relative flex h-5 w-[130px] flex-shrink-0 items-center justify-end">
                        {!showActions && (
                          <span className="absolute inset-y-0 right-0 flex items-center text-xs text-gray-400">
                            {message.timestamp}
                          </span>
                        )}
                        <ChatActionButtons isVisible={showActions} onMove={onMove} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
