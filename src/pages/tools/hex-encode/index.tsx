import React, { useState, useEffect, useCallback } from 'react';
import { Binary, Copy, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const encodeHex = (text: string): string => {
  if (!text) {
    return '';
  }

  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
};

const HexEncodePage: React.FC = () => {
  const { handleCopy, addToast } = useToolPage();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  useEffect(() => {
    try {
      setTimeout(() => setOutput(encodeHex(input)), 0);
    } catch {
      addToast({ message: '编码失败', type: 'error' });
    }
  }, [input, addToast]);

  const loadSample = useCallback(() => {
    setInput('Hello, World!');
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Binary className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">HEX 编码</h2>
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
        </div>
      </div>

      <div className="flex-1 bg-surface rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-content">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">输入文本</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="输入要编码的文本..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">HEX 输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="编码后的 HEX 将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default HexEncodePage;