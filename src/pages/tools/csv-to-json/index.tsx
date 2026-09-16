import React, { useState, useEffect, useCallback } from 'react';
import { Table, Copy, Download, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const parseCSV = (text: string, hasHeader: boolean): { output: string; error: string } => {
  if (!text.trim()) {
    return { output: '', error: '' };
  }

  try {
    const lines = text.trim().split('\n');
    const headers = hasHeader ? lines[0].split(',').map(h => h.trim()) : lines[0].split(',').map((_, i) => `column${i}`);
    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    const result = dataLines.map((line) => {
      const values = line.split(',');
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] ? values[i].trim() : '';
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v));

    return { output: JSON.stringify(result, null, 2), error: '' };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '解析失败';
    return { output: '', error: errorMsg };
  }
};

const CsvToJsonPage: React.FC = () => {
  const { handleCopy, addToast } = useToolPage();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [hasHeader, setHasHeader] = useState(true);

  useEffect(() => {
    const result = parseCSV(input, hasHeader);
    setTimeout(() => {
      setOutput(result.output);
      setError(result.error);
      if (result.error) {
        addToast({ message: result.error, type: 'error' });
      }
    }, 0);
  }, [input, hasHeader, addToast]);

  const handleDownload = useCallback(() => {
    if (!output) {
      addToast({ message: '没有可下载的内容', type: 'warning' });
      return;
    }
    
    const blob = new Blob([output], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.json';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ message: '文件已下载', type: 'success' });
  }, [output, addToast]);

  const loadSample = useCallback(() => {
    setInput(`name,age,city
张三,28,北京
李四,32,上海
王五,25,广州`);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Table className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">CSV 转 JSON</h2>
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
            checked={hasHeader}
            onChange={(e) => setHasHeader(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-green-600"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">第一行为表头</span>
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
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">CSV 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="name,age,city&#10;张三,28,北京&#10;李四,32,上海"
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">JSON 输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="转换后的 JSON 将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default CsvToJsonPage;