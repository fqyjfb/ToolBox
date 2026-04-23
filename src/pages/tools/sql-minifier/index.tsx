import React, { useState, useEffect, useCallback } from 'react';
import { Code2, Copy, Download, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const SqlMinifierPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [originalSize, setOriginalSize] = useState(0);
  const [minifiedSize, setMinifiedSize] = useState(0);

  const minifySql = useCallback(() => {
    if (!input) {
      setOutput('');
      setOriginalSize(0);
      setMinifiedSize(0);
      return;
    }

    let sql = input;
    
    sql = sql.replace(/--.*$/gm, '');
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    sql = sql.replace(/\s+/g, ' ');
    sql = sql.replace(/\s*([,;()])\s*/g, '$1');
    sql = sql.replace(/\s*=\s*/g, '=');
    sql = sql.replace(/\s*<>\s*/g, '<>');
    sql = sql.replace(/\s*<=\s*/g, '<=');
    sql = sql.replace(/\s*>=\s*/g, '>=');
    sql = sql.replace(/\s*<\s*/g, '<');
    sql = sql.replace(/\s*>\s*/g, '>');
    sql = sql.replace(/\s*AND\s*/gi, ' AND ');
    sql = sql.replace(/\s*OR\s*/gi, ' OR ');
    sql = sql.replace(/\s*NOT\s*/gi, ' NOT ');
    sql = sql.replace(/\s*IN\s*/gi, ' IN ');
    sql = sql.replace(/\s*LIKE\s*/gi, ' LIKE ');
    sql = sql.replace(/\s*BETWEEN\s*/gi, ' BETWEEN ');
    sql = sql.replace(/\s*ON\s*/gi, ' ON ');
    sql = sql.replace(/\s*AS\s*/gi, ' AS ');
    sql = sql.replace(/\s*FROM\s*/gi, ' FROM ');
    sql = sql.replace(/\s*WHERE\s*/gi, ' WHERE ');
    sql = sql.replace(/\s*SELECT\s*/gi, ' SELECT ');
    sql = sql.replace(/\s*INSERT\s*/gi, ' INSERT ');
    sql = sql.replace(/\s*UPDATE\s*/gi, ' UPDATE ');
    sql = sql.replace(/\s*DELETE\s*/gi, ' DELETE ');
    sql = sql.replace(/\s*JOIN\s*/gi, ' JOIN ');
    sql = sql.replace(/\s*LEFT\s*/gi, ' LEFT ');
    sql = sql.replace(/\s*RIGHT\s*/gi, ' RIGHT ');
    sql = sql.replace(/\s*INNER\s*/gi, ' INNER ');
    sql = sql.replace(/\s*OUTER\s*/gi, ' OUTER ');
    sql = sql.replace(/\s*GROUP\s*/gi, ' GROUP ');
    sql = sql.replace(/\s*ORDER\s*/gi, ' ORDER ');
    sql = sql.replace(/\s*BY\s*/gi, ' BY ');
    sql = sql.replace(/\s*HAVING\s*/gi, ' HAVING ');
    sql = sql.replace(/\s*LIMIT\s*/gi, ' LIMIT ');
    sql = sql.replace(/\s+$/g, '');
    sql = sql.replace(/^\s+/g, '');
    sql = sql.replace(/\s{2,}/g, ' ');
    
    setOutput(sql);
    setOriginalSize(input.length);
    setMinifiedSize(sql.length);
  }, [input]);

  useEffect(() => {
    minifySql();
  }, [minifySql]);

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
    
    const blob = new Blob([output], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'minified.sql';
    a.click();
    URL.revokeObjectURL(url);
    addToast({ message: '文件已下载', type: 'success' });
  }, [output, addToast]);

  const loadSample = useCallback(() => {
    setInput(`SELECT 
    id, 
    name, 
    email 
FROM 
    users 
WHERE 
    status = 'active' 
    AND age >= 18 
ORDER BY 
    created_at DESC;`);
  }, [output, addToast]);

  const percentageSaved = originalSize > 0 ? ((originalSize - minifiedSize) / originalSize * 100).toFixed(1) : '0';

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Code2 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">SQL 压缩器</h2>
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

      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          原始: <strong className="text-gray-800 dark:text-gray-200">{originalSize.toLocaleString()}</strong> 字符
        </span>
        <span className="text-gray-600 dark:text-gray-400">
          压缩后: <strong className="text-green-600 dark:text-green-400">{minifiedSize.toLocaleString()}</strong> 字符
        </span>
        {originalSize > minifiedSize && (
          <span className="text-green-600 dark:text-green-400">
            节省 {percentageSaved}%
          </span>
        )}
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">SQL 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="在此输入 SQL 代码..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">压缩输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="压缩后的 SQL 将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default SqlMinifierPage;