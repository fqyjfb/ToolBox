import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
    }
  }, [text]);

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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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
    <div className="flex justify-center py-6">
      <div className="relative w-full max-w-[720px] overflow-hidden">
        <textarea
          ref={textareaRef}
          className="w-full resize-none rounded-full border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-5 py-4 text-base text-gray-900 dark:text-white placeholder-gray-400 focus:border-gray-400 focus:outline-none overflow-hidden"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息..."
          rows={1}
        />
        
        {text.trim().length > 0 ? (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            onClick={handleSend}
            title="发送"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </div>
  );
};