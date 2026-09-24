import React, { useState, useEffect, useCallback } from 'react';
import { Code2, Copy, Download, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const SqlMinifierPage: React.FC = () => {
  const { handleCopy, addToast } = useToolPage();
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
    const timer = setTimeout(() => {
      minifySql();
    }, 0);
    return () => clearTimeout(timer);
  }, [minifySql]);

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
  }, []);

  const percentageSaved = originalSize > 0 ? ((originalSize - minifiedSize) / originalSize * 100).toFixed(1) : '0';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Code2 className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">SQL 压缩器</h2>
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
            onClick={handleDownload}
            disabled={!output}
            className="flex items-center gap-2 px-3 py-1 text-xs font-medium bg-primary text-button-text rounded-md hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            下载
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-content-secondary">
          原始: <strong className="text-content-primary">{originalSize.toLocaleString()}</strong> 字符
        </span>
        <span className="text-content-secondary">
          压缩后: <strong className="text-green-600 dark:text-green-400">{minifiedSize.toLocaleString()}</strong> 字符
        </span>
        {originalSize > minifiedSize && (
          <span className="text-green-600 dark:text-green-400">
            节省 {percentageSaved}%
          </span>
        )}
      </div>

      <div className="flex-1 bg-surface rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-content">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">SQL 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="在此输入 SQL 代码..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">压缩输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="压缩后的 SQL 将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default SqlMinifierPage;