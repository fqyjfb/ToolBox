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