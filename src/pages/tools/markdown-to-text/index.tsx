import React, { useState, useCallback } from 'react';
import { AlignLeft, Copy, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const MarkdownToTextPage: React.FC = () => {
  const { handleCopy } = useToolPage();
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const convertMarkdown = useCallback((text: string) => {
    if (!text) {
      return '';
    }

    let result = text;
    
    result = result.replace(/```[\s\S]*?```/g, '');
    result = result.replace(/`([^`]+)`/g, '$1');
    result = result.replace(/^#{1,6}\s+/gm, '');
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
    result = result.replace(/\*\*(.+?)\*\*/g, '$1');
    result = result.replace(/\*(.+?)\*/g, '$1');
    result = result.replace(/___(.+?)___/g, '$1');
    result = result.replace(/__(.+?)__/g, '$1');
    result = result.replace(/_(.+?)_/g, '$1');
    result = result.replace(/~~(.+?)~~/g, '$1');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
    result = result.replace(/^\s*[-*+]\s+/gm, '');
    result = result.replace(/^\s*\d+\.\s+/gm, '');
    result = result.replace(/^>\s+/gm, '');
    result = result.replace(/^-{3,}$/gm, '');
    result = result.replace(/^\*{3,}$/gm, '');
    result = result.replace(/^={3,}$/gm, '');
    result = result.replace(/\|/g, ' ');
    result = result.replace(/\n{3,}/g, '\n\n');
    result = result.trim();
    
    return result;
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setOutput(convertMarkdown(value));
  }, [convertMarkdown]);

  const loadSample = useCallback(() => {
    handleInputChange(`# 标题

## 副标题

这是一段**粗体**和*斜体*的文本。

- 列表项 1
- 列表项 2

> 引用内容

\`\`\`javascript
const code = '示例代码';
\`\`\`

[链接](https://example.com)`);
  }, [handleInputChange]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlignLeft className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">Markdown 转纯文本</h2>
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
            <span className="text-sm font-medium text-content-secondary">Markdown 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="在此输入 Markdown 文本..."
          />
        </div>
        
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border-b border-content">
            <span className="text-sm font-medium text-content-secondary">纯文本输出</span>
          </div>
          <textarea
            value={output}
            readOnly
            className="flex-1 w-full p-4 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none"
            placeholder="转换后的纯文本将显示在这里..."
          />
        </div>
      </div>
    </div>
  );
};

export default MarkdownToTextPage;