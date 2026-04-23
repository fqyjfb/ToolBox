import React, { useState, useEffect, useCallback } from 'react';
import { AlignLeft, Copy, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const MarkdownToTextPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const convertMarkdown = useCallback(() => {
    if (!input) {
      setOutput('');
      return;
    }

    let text = input;
    
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/^\#{1,6}\s+/gm, '');
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');
    text = text.replace(/\*(.+?)\*/g, '$1');
    text = text.replace(/___(.+?)___/g, '$1');
    text = text.replace(/__(.+?)__/g, '$1');
    text = text.replace(/_(.+?)_/g, '$1');
    text = text.replace(/~~(.+?)~~/g, '$1');
    text = text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '$1');
    text = text.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '$1');
    text = text.replace(/^\s*[-*+]\s+/gm, '');
    text = text.replace(/^\s*\d+\.\s+/gm, '');
    text = text.replace(/^>\s+/gm, '');
    text = text.replace(/^-{3,}$/gm, '');
    text = text.replace(/^\*{3,}$/gm, '');
    text = text.replace(/^\={3,}$/gm, '');
    text = text.replace(/\|/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();
    
    setOutput(text);
  }, [input]);

  useEffect(() => {
    convertMarkdown();
  }, [convertMarkdown]);

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
    setInput(`# 标题

## 副标题

这是一段**粗体**和*斜体*的文本。

- 列表项 1
- 列表项 2

> 引用内容

\`\`\`javascript
const code = '示例代码';
\`\`\`

[链接](https://example.com)`);
  }, []);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlignLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Markdown 转纯文本</h2>
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
            className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex">
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Markdown 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="在此输入 Markdown 文本..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">纯文本输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="转换后的纯文本将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default MarkdownToTextPage;