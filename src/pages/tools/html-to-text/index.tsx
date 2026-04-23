import React, { useState, useEffect, useCallback } from 'react';
import { AlignLeft, Copy, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const HtmlToTextPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');

  const convertHtml = useCallback(() => {
    if (!input) {
      setOutput('');
      return;
    }

    let text = input;
    
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/\s{2,}/g, ' ');
    text = text.trim();
    
    setOutput(text);
  }, [input]);

  useEffect(() => {
    convertHtml();
  }, [convertHtml]);

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
    setInput(`<html>
<head><title>测试页面</title></head>
<body>
  <h1>这是标题</h1>
  <p>这是一段<span style="color: red;">红色</span>的文本。</p>
  <ul>
    <li>列表项 1</li>
    <li>列表项 2</li>
  </ul>
  <a href="https://example.com">链接文本</a>
</body>
</html>`);
  }, []);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AlignLeft className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">HTML 转纯文本</h2>
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
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">HTML 输入</span>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
            placeholder="在此输入 HTML 代码..."
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

export default HtmlToTextPage;