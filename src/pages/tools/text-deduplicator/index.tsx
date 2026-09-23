import React, { useState, useEffect, useCallback } from 'react';
import { Copy, Trash2, FileText, List } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';
import Select from '../../../components/ui/Select';

const TextDeduplicatorPage: React.FC = () => {
  const { handleCopy, addToast } = useToolPage();
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
    const timer = setTimeout(() => {
      deduplicate();
    }, 0);
    return () => clearTimeout(timer);
  }, [deduplicate]);

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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <List className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">文本去重工具</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadSample}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-surface text-content-primary rounded-lg hover:bg-gray-300 dark:hover:bg-menu-hover transition-colors text-sm"
          >
            <FileText className="w-4 h-4" />
            示例
          </button>
          <button 
            onClick={() => handleCopy(output)}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button 
            onClick={handleClear}
            className="p-2 text-content-secondary hover:bg-menu-hover dark:hover:bg-surface rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-content-secondary">分隔符:</span>
          <Select
            value={separator}
            onChange={setSeparator}
            options={separatorOptions}
            className="px-3 py-1 border border-content rounded-lg bg-surface text-content-primary text-sm"
          />
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <span className="text-content-secondary">
            原始数量: <strong className="text-content-primary">{originalCount}</strong>
          </span>
          <span className="text-content-secondary">
            去重后: <strong className="text-green-600 dark:text-green-400">{uniqueCount}</strong>
          </span>
          {originalCount > uniqueCount && (
            <span className="text-orange-600 dark:text-orange-400">
              已移除 {originalCount - uniqueCount} 项重复
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 bg-surface rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-content">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">输入文本</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="每行一个条目，或使用指定分隔符..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">去重结果</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="去重后的文本将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default TextDeduplicatorPage;