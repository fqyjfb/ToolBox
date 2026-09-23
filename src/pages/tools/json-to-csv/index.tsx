import React, { useState, useEffect, useCallback } from 'react';
import { Table, Copy, Download, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const JsonToCsvPage: React.FC = () => {
  const { handleCopy, addToast } = useToolPage();
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
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Table className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">JSON 转 CSV</h2>
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
            className="flex items-center gap-2 px-3 py-2 bg-primary text-button-text rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
          <button 
            onClick={handleDownload}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-button-text rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
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
            className="rounded border-content bg-surface text-green-600"
          />
          <span className="text-sm text-content-secondary">包含表头</span>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-surface rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-content">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">JSON 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder='[{"name": "张三", "age": 28}]'
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">CSV 输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="转换后的 CSV 将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default JsonToCsvPage;