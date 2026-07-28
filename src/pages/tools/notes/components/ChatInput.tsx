import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [text, setText] = useState('');

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;
    await onSend(text.trim());
    setText('');
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fileName = file.name;
          const markdown = `![${fileName}](media/${fileName})`;
          setText(prev => prev + markdown);
        }
        break;
      }
    }
  };

  return (
    <div className="flex justify-center py-6 px-6">
      <div className="flex w-full max-w-[720px] gap-3">
        <textarea
          className="flex-1 h-[44px] resize-none rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-2 text-base text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary/30 focus:outline-none overflow-y-auto"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息..."
        />

        <button
          className="flex h-[44px] w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-button-text hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSend}
          disabled={!text.trim()}
          title="发送"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};