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
      className="flex-1 overflow-y-auto px-6 py-6"
      onClick={(e) => {
        if (!((e.target as HTMLElement).closest('.chat-message'))) {
          onToggleSelection('');
        }
      }}
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-gray-400">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
            <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 21h8a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 11.586 3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
            </svg>
          </div>
          <h3 className="mt-4 text-xl font-medium">释放思绪</h3>
          <p className="mt-2 text-sm">开始输入，记录你的想法</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {Object.entries(messagesByDate).map(([date, dateMessages]) => (
            <div key={date} className="w-full max-w-[720px]">
              <div className="mb-3 ml-2 text-xs font-medium text-gray-400">
                {date}
              </div>
              {dateMessages.map((message, index) => (
                <div
                  key={message.id}
                  className={`chat-message relative cursor-pointer rounded-lg transition-all ${
                    selectedMessages.includes(message.id)
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } ${message.done ? 'opacity-60' : ''}`}
                  style={{
                    borderRadius: index === 0 ? '6px 6px 0 0' : index === dateMessages.length - 1 ? '0 0 6px 6px' : '0',
                  }}
                  onClick={(e) => handleMessageClick(e, message.id)}
                  onDoubleClick={() => onToggleDone(message.id)}
                  onMouseEnter={() => setHoveredMessage(message.id)}
                  onMouseLeave={() => setHoveredMessage(null)}
                >
                  <button
                    className={`absolute left-3 top-3 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      selectedMessages.includes(message.id)
                        ? 'border-blue-500 bg-blue-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelection(message.id, true);
                    }}
                  >
                    {selectedMessages.includes(message.id) && <Check className="h-3 w-3" />}
                  </button>

                  <button
                    className={`absolute left-10 top-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      message.done
                        ? 'border-green-500 bg-green-500 text-white'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDone(message.id);
                    }}
                  >
                    {message.done && <Check className="h-4 w-4" />}
                  </button>

                  <div className="ml-[76px] mr-12 p-3 break-words">
                    <p className={`text-base leading-relaxed whitespace-pre-wrap ${message.done ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                      {message.text}
                    </p>
                  </div>

                  <span className={`absolute right-3 top-3 text-xs text-gray-400 transition-opacity ${
                    hoveredMessage === message.id ? 'opacity-100' : 'opacity-0'
                  }`}>
                    {message.timestamp}
                  </span>

                  <ChatActionButtons
                    isVisible={hoveredMessage === message.id || selectedMessages.includes(message.id)}
                    onMove={onMove}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};