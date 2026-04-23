import React, { useState, useEffect, useCallback } from 'react';
import { Table, Copy, Download, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const JsonToCsvPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [includeHeader, setIncludeHeader] = useState(true);

  const parseJSON = useCallback(() => {
    if (!input.trim()) {
      setOutput('');
      setError('');
      return;
    }

    try {
      const data = JSON.parse(input);
      
      if (!Array.isArray(data)) {
        throw new Error('JSON 必须是数组格式');
      }

      if (data.length === 0) {
        setOutput('');
        setError('');
        return;
      }

      const headers = [...new Set(data.flatMap(obj => Object.keys(obj)))];
      
      let csv = '';
      if (includeHeader) {
        csv += headers.join(',') + '\n';
      }
      
      csv += data.map(row => {
        return headers.map(header => {
          const value = row[header];
          const escaped = typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          return escaped ?? '';
        }).join(',');
      }).join('\n');

      setOutput(csv);
      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '解析失败';
      setError(errorMsg);
      addToast({ message: errorMsg, type: 'error' });
    }
  }, [input, includeHeader, addToast]);

  useEffect(() => {
    parseJSON();
  }, [parseJSON]);

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
    
    const blob = new Blob([output], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.csv';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ message: '文件已下载', type: 'success' });
  }, [output, addToast]);

  const loadSample = useCallback(() => {
    setInput(`[
  {"name": "张三", "age": 28, "city": "北京"},
  {"name": "李四", "age": 32, "city": "上海"},
  {"name": "王五", "age": 25, "city": "广州"}
]`);
  }, []);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Table className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">JSON 转 CSV</h2>
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
            onClick={handleDownload}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            下载
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeHeader}
            onChange={(e) => setIncludeHeader(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-green-600"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">包含表头</span>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">JSON 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder='[{"name": "张三", "age": 28}]'
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">CSV 输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="转换后的 CSV 将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default JsonToCsvPage;