import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
}

const MAX_INPUT_HEIGHT = 160;

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
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
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setText(prev => prev + `![${file.name}](media/${file.name})`);
        }
        break;
      }
    }
  };

  return (
    <div className="flex justify-center px-3 py-2">
      <div className="w-full max-w-[720px] rounded border border-gray-300 bg-gray-50 transition-colors focus-within:border-primary dark:border-gray-600 dark:bg-gray-800">
        <textarea
          ref={textareaRef}
          rows={1}
          className="block w-full resize-none overflow-y-auto bg-transparent px-2 pt-1.5 text-xs leading-relaxed text-gray-900 placeholder-gray-400 scrollbar-thin focus:outline-none dark:text-white"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息..."
        />
        <div className="flex justify-end px-1.5 pb-1.5 pt-0.5">
          <button
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-primary text-button-text transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleSend}
            disabled={!text.trim()}
            title="发送"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
