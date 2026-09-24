import React, { useState, useCallback, useMemo } from 'react';
import { Smile, Copy, Trash2, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const EmojiRemoverPage: React.FC = () => {
  const { handleCopy, addToast } = useToolPage();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [count, setCount] = useState(0);

  const emojiRegex = useMemo(() => /\p{Extended_Pictographic}/gu, []);

  const removeEmoji = useCallback(() => {
    if (!input) {
      setOutput('');
      setCount(0);
      return;
    }
    
    const matches = input.match(emojiRegex) || [];
    setOutput(input.replace(emojiRegex, ''));
    setCount(matches.length);
  }, [input, emojiRegex]);

  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
    setCount(0);
    addToast({ message: '已清空', type: 'info' });
  }, [addToast]);

  const loadSample = useCallback(() => {
    setInput('好评👍👍，谢谢你的支持😊！今天天气真好☀️，我们一起去公园散步吧🌳！');
  }, []);

  React.useEffect(() => {
    removeEmoji();
  }, [removeEmoji]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Smile className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">Emoji 清理器</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSample}
            className="flex items-center gap-2 px-3 py-1 text-xs font-medium bg-surface-secondary dark:bg-content-primary text-content-primary rounded-md hover:bg-menu-hover dark:hover:bg-content-hover transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            示例
          </button>
          <button
            onClick={() => handleCopy(output)}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-1 text-xs font-medium bg-primary text-button-text rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Copy className="w-3.5 h-3.5" />
            复制
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 text-content-secondary hover:bg-menu-hover dark:hover:bg-surface rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-surface rounded-lg shadow-md p-4 overflow-hidden flex flex-col">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          <div className="flex flex-col min-h-0">
            <label className="block text-sm text-content-secondary mb-2">输入文本</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-3 border border-content rounded-lg bg-surface text-content-primary resize-none outline-none focus:border-blue-500"
              placeholder="粘贴包含 Emoji 的文本..."
            />
          </div>
          
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-content-secondary">输出结果</label>
              <span className="text-sm text-green-600 dark:text-green-400">已移除 {count} 个 Emoji</span>
            </div>
            <textarea
              value={output}
              readOnly
              className="flex-1 px-4 py-3 border border-content rounded-lg bg-surface-secondary text-content-primary resize-none outline-none"
              placeholder="清理后的文本..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmojiRemoverPage;