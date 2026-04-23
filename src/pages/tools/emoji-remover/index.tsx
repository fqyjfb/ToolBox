import React, { useState, useCallback } from 'react';
import { Smile, Copy, Trash2, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const EmojiRemoverPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [count, setCount] = useState(0);

  const emojiRegex = /\p{Extended_Pictographic}/gu;

  const removeEmoji = useCallback(() => {
    if (!input) {
      setOutput('');
      setCount(0);
      return;
    }
    
    const matches = input.match(emojiRegex) || [];
    setOutput(input.replace(emojiRegex, ''));
    setCount(matches.length);
  }, [input]);

  const handleCopy = useCallback(() => {
    if (!output) {
      addToast({ message: '没有可复制的内容', type: 'warning' });
      return;
    }
    
    navigator.clipboard.writeText(output).then(() => {
      addToast({ message: '已复制到剪贴板', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [output, addToast]);

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
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Smile className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Emoji 清理器</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadSample}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            <FileText className="w-4 h-4" />
            示例
          </button>
          <button 
            onClick={handleCopy}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button 
            onClick={handleClear}
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 overflow-hidden flex flex-col">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
          <div className="flex flex-col min-h-0">
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">输入文本</label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:border-blue-500"
              placeholder="粘贴包含 Emoji 的文本..."
            />
          </div>
          
          <div className="flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">输出结果</label>
              <span className="text-sm text-green-600 dark:text-green-400">已移除 {count} 个 Emoji</span>
            </div>
            <textarea
              value={output}
              readOnly
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none outline-none"
              placeholder="清理后的文本..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmojiRemoverPage;