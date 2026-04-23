import React, { useState, useEffect, useCallback } from 'react';
import { Link, Copy, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const UrlParserPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<URL | null>(null);
  const [error, setError] = useState('');

  const parseURL = useCallback(() => {
    if (!input.trim()) {
      setParsed(null);
      setError('');
      return;
    }

    try {
      const url = new URL(input);
      setParsed(url);
      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '无效的 URL';
      setError(errorMsg);
      setParsed(null);
    }
  }, [input]);

  useEffect(() => {
    parseURL();
  }, [parseURL]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast({ message: '已复制', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [addToast]);

  const loadSample = useCallback(() => {
    setInput('https://www.example.com:8080/path/to/page?query=value&lang=zh#section');
  }, []);

  const handleReset = useCallback(() => {
    setInput('');
    setParsed(null);
    setError('');
  }, []);

  const urlParts = parsed ? [
    { label: '完整 URL', value: parsed.href },
    { label: '协议', value: parsed.protocol },
    { label: '主机', value: parsed.host },
    { label: '域名', value: parsed.hostname },
    { label: '端口', value: parsed.port || '默认' },
    { label: '路径', value: parsed.pathname },
    { label: '查询参数', value: parsed.search || '无' },
    { label: '锚点', value: parsed.hash || '无' },
    { label: '用户名', value: parsed.username || '无' },
    { label: '密码', value: parsed.password || '无' },
  ] : [];

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">URL 解析器</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadSample}
            className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
          >
            <FileText className="w-4 h-4" />
            示例
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">输入 URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && parseURL()}
            placeholder="https://example.com/path?query=value"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            重置
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-4">
          {parsed ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {urlParts.map((part, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{part.label}</div>
                  <div className="text-gray-800 dark:text-gray-200 font-mono text-sm break-all mb-2">
                    {part.value}
                  </div>
                  <button
                    onClick={() => handleCopy(part.value)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-xs"
                  >
                    <Copy className="w-3 h-3" />
                    复制
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              输入 URL 查看解析结果
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UrlParserPage;