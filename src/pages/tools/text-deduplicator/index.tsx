import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Trash2, FileText, List } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const TextDeduplicatorPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [originalCount, setOriginalCount] = useState(0);
  const [uniqueCount, setUniqueCount] = useState(0);
  const [separator, setSeparator] = useState('\n');

  const deduplicate = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setOriginalCount(0);
      setUniqueCount(0);
      return;
    }

    const items = input.split(separator).map(item => item.trim()).filter(item => item);
    setOriginalCount(items.length);
    
    const uniqueItems = [...new Set(items)];
    setUniqueCount(uniqueItems.length);
    setOutput(uniqueItems.join(separator));
  }, [input, separator]);

  useEffect(() => {
    deduplicate();
  }, [deduplicate]);

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
    setOriginalCount(0);
    setUniqueCount(0);
    addToast({ message: '已清空', type: 'info' });
  }, [addToast]);

  const loadSample = useCallback(() => {
    setInput(`苹果
香蕉
苹果
橙子
香蕉
葡萄
橙子`);
  }, []);

  const separatorOptions = [
    { value: '\n', label: '换行符' },
    { value: ',', label: '逗号' },
    { value: ';', label: '分号' },
    { value: '|', label: '竖线' },
  ];

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <List className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">文本去重工具</h2>
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
            className="flex items-center gap-2 px-3 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
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

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">分隔符:</span>
          <select
            value={separator}
            onChange={(e) => setSeparator(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm"
          >
            {separatorOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            原始数量: <strong className="text-gray-800 dark:text-gray-200">{originalCount}</strong>
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            去重后: <strong className="text-green-600 dark:text-green-400">{uniqueCount}</strong>
          </span>
          {originalCount > uniqueCount && (
            <span className="text-orange-600 dark:text-orange-400">
              已移除 {originalCount - uniqueCount} 项重复
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">输入文本</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="每行一个条目，或使用指定分隔符..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">去重结果</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="去重后的文本将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default TextDeduplicatorPage;