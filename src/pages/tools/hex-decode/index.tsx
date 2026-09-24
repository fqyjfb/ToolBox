import React, { useState, useEffect, useCallback } from 'react';
import { Binary, Copy, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const HexDecodePage: React.FC = () => {
  const { handleCopy, addToast } = useToolPage();
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

  const loadSample = useCallback(() => {
    setInput('48656c6c6f2c20576f726c6421');
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Binary className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">HEX 解码</h2>
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
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-surface rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-content">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">HEX 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="输入 HEX 字符串..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">文本输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="解码后的文本将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default HexDecodePage;