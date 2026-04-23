import React, { useState, useEffect, useCallback } from 'react';
import { Binary, Copy, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const HexDecodePage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  const decodeHex = useCallback(() => {
    if (!input) {
      setOutput('');
      setError('');
      return;
    }

    try {
      const cleanInput = input.replace(/\s/g, '');
      
      if (!/^[0-9a-fA-F]*$/.test(cleanInput)) {
        throw new Error('无效的 HEX 字符');
      }
      
      if (cleanInput.length % 2 !== 0) {
        throw new Error('HEX 长度必须为偶数');
      }

      const bytes = [];
      for (let i = 0; i < cleanInput.length; i += 2) {
        bytes.push(parseInt(cleanInput.slice(i, i + 2), 16));
      }

      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(new Uint8Array(bytes));
      
      setOutput(text);
      setError('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '解码失败';
      setError(errorMsg);
      setOutput('');
      addToast({ message: errorMsg, type: 'error' });
    }
  }, [input, addToast]);

  useEffect(() => {
    decodeHex();
  }, [decodeHex]);

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

  const loadSample = useCallback(() => {
    setInput('48656c6c6f2c20576f726c6421');
  }, []);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Binary className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">HEX 解码</h2>
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
            className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">HEX 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="输入 HEX 字符串..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">文本输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="解码后的文本将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default HexDecodePage;