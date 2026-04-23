import React, { useState, useCallback, useEffect } from 'react';
import { Code2, Copy, Download, Trash2, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const JsonFormatterPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [indentStyle, setIndentStyle] = useState<'2' | '4' | 'tab'>('4');
  const [sortKeys, setSortKeys] = useState(false);

  const sortObjectKeys = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (Array.isArray(obj)) return obj.map(sortObjectKeys);
    
    const sorted: Record<string, any> = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = sortObjectKeys(obj[key]);
    });
    return sorted;
  };

  const formatJSON = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError('');
      return;
    }

    try {
      let jsonObj = JSON.parse(input);
      
      if (sortKeys) {
        jsonObj = sortObjectKeys(jsonObj);
      }

      const indent = indentStyle === 'tab' ? '\t' : parseInt(indentStyle);
      setOutput(JSON.stringify(jsonObj, null, indent));
      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'JSON 格式错误';
      setError(errorMsg);
      addToast({ message: errorMsg, type: 'error' });
    }
  }, [input, indentStyle, sortKeys, addToast]);

  const minifyJSON = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError('');
      return;
    }

    try {
      const jsonObj = JSON.parse(input);
      setOutput(JSON.stringify(jsonObj));
      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'JSON 格式错误';
      setError(errorMsg);
      addToast({ message: errorMsg, type: 'error' });
    }
  }, [input, addToast]);

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

  const handleDownload = useCallback(() => {
    if (!output) {
      addToast({ message: '没有可下载的内容', type: 'warning' });
      return;
    }
    
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'formatted.json';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ message: '文件已下载', type: 'success' });
  }, [output, addToast]);

  const handleClear = useCallback(() => {
    setInput('');
    setOutput('');
    setError('');
    addToast({ message: '已清空', type: 'info' });
  }, [addToast]);

  const loadSample = useCallback(() => {
    setInput(`{
  "name": "张三",
  "age": 28,
  "city": "北京",
  "hobbies": ["阅读", "旅游", "编程"],
  "address": {
    "street": "长安街",
    "number": 123
  },
  "isActive": true,
  "balance": 1234.56
}`);
  }, []);

  useEffect(() => {
    formatJSON();
  }, [formatJSON]);

  const charCount = output.length;
  const lineCount = output.split('\n').length;
  const size = formatBytes(new Blob([output]).size);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Code2 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">JSON 格式化工具</h2>
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
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button 
            onClick={handleDownload}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            下载
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
          <button
            onClick={formatJSON}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            格式化
          </button>
          <button
            onClick={minifyJSON}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
          >
            压缩
          </button>
        </div>
        
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-400">缩进:</span>
            <select
              value={indentStyle}
              onChange={(e) => setIndentStyle(e.target.value as '2' | '4' | 'tab')}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
            >
              <option value="2">2 空格</option>
              <option value="4">4 空格</option>
              <option value="tab">Tab</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sortKeys}
              onChange={(e) => setSortKeys(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-blue-600"
            />
            <span className="text-gray-600 dark:text-gray-400">排序键名</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          <strong>JSON 格式错误:</strong> {error}
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">输入 JSON</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder='在此输入 JSON，例如：{"name": "John", "age": 30}'
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">输出结果</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="格式化后的 JSON 将显示在这里..."
          />
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>字符: <strong className="text-blue-600 dark:text-blue-400">{charCount.toLocaleString()}</strong></span>
            <span>行数: <strong className="text-blue-600 dark:text-blue-400">{lineCount.toLocaleString()}</strong></span>
            <span>大小: <strong className="text-blue-600 dark:text-blue-400">{size}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonFormatterPage;