import React, { useState, useEffect, useCallback } from 'react';
import { AtSign, Copy, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const UrlEncodePage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [encoded, setEncoded] = useState('');
  const [decoded, setDecoded] = useState('');
  const [encodeError, setEncodeError] = useState('');
  const [decodeError, setDecodeError] = useState('');

  const encodeUrl = useCallback(() => {
    if (!input) {
      setEncoded('');
      setEncodeError('');
      return;
    }

    try {
      const result = encodeURIComponent(input);
      setEncoded(result);
      setEncodeError('');
    } catch (err) {
      setEncodeError('编码失败');
      addToast({ message: '编码失败', type: 'error' });
    }
  }, [input, addToast]);

  const decodeUrl = useCallback(() => {
    if (!input) {
      setDecoded('');
      setDecodeError('');
      return;
    }

    try {
      const result = decodeURIComponent(input);
      setDecoded(result);
      setDecodeError('');
    } catch (err) {
      setDecodeError('解码失败 - 无效的编码格式');
      addToast({ message: '解码失败', type: 'error' });
    }
  }, [input, addToast]);

  useEffect(() => {
    encodeUrl();
    decodeUrl();
  }, [encodeUrl, decodeUrl]);

  const handleCopy = useCallback((text: string) => {
    if (!text) {
      addToast({ message: '没有可复制的内容', type: 'warning' });
      return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
      addToast({ message: '已复制到剪贴板', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [addToast]);

  const loadSample = useCallback(() => {
    setInput('https://example.com/path?name=张三&age=28&city=北京');
  }, []);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AtSign className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">URL 编码解码</h2>
        </div>
        <button 
          onClick={loadSample}
          className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
        >
          <FileText className="w-4 h-4" />
          示例
        </button>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">输入文本</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none focus:border-blue-500"
          rows={3}
          placeholder="输入要编码或解码的 URL..."
        />
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">URL 编码 (Encode)</span>
              <button
                onClick={() => handleCopy(encoded)}
                disabled={!encoded}
                className="flex items-center gap-1 px-2 py-1 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
              >
                <Copy className="w-3 h-3" />
                复制
              </button>
            </div>
            {encodeError ? (
              <div className="text-red-600 dark:text-red-400 text-sm">{encodeError}</div>
            ) : (
              <textarea
                value={encoded}
                readOnly
                className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
                placeholder="编码结果..."
              />
            )}
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">URL 解码 (Decode)</span>
              <button
                onClick={() => handleCopy(decoded)}
                disabled={!decoded}
                className="flex items-center gap-1 px-2 py-1 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs"
              >
                <Copy className="w-3 h-3" />
                复制
              </button>
            </div>
            {decodeError ? (
              <div className="text-red-600 dark:text-red-400 text-sm">{decodeError}</div>
            ) : (
              <textarea
                value={decoded}
                readOnly
                className="w-full h-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
                placeholder="解码结果..."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UrlEncodePage;