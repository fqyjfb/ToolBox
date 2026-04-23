import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUpDown, Copy } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const CaseConverterPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [input, setInput] = useState('hello world');
  const [results, setResults] = useState<Record<string, string>>({});

  const toTitleCase = (str: string): string => {
    return str.toLowerCase().replace(/\b\w/g, s => s.toUpperCase());
  };

  const toSentenceCase = (str: string): string => {
    return str.toLowerCase().replace(/(^\w|\.\s+\w)/g, s => s.toUpperCase());
  };

  const toCamelCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_m, chr) => chr.toUpperCase())
      .replace(/^[A-Z]/, s => s.toLowerCase());
  };

  const toPascalCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/(^|[^a-zA-Z0-9]+)(.)/g, (_m, _sep, chr) => chr.toUpperCase());
  };

  const toSnakeCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const toKebabCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const convert = useCallback(() => {
    if (!input.trim()) {
      setResults({});
      return;
    }

    setResults({
      lowercase: input.toLowerCase(),
      uppercase: input.toUpperCase(),
      titlecase: toTitleCase(input),
      sentencecase: toSentenceCase(input),
      camelcase: toCamelCase(input),
      pascalcase: toPascalCase(input),
      snakecase: toSnakeCase(input),
      constantcase: toSnakeCase(input).toUpperCase(),
      kebabcase: toKebabCase(input),
    });
  }, [input]);

  useEffect(() => {
    convert();
  }, [convert]);

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

  const caseTypes = [
    { id: 'lowercase', name: '小写 (lowercase)' },
    { id: 'uppercase', name: '大写 (UPPERCASE)' },
    { id: 'titlecase', name: '首字母大写 (Title Case)' },
    { id: 'sentencecase', name: '句首大写 (Sentence case)' },
    { id: 'camelcase', name: '驼峰命名 (camelCase)' },
    { id: 'pascalcase', name: '帕斯卡命名 (PascalCase)' },
    { id: 'snakecase', name: '蛇形命名 (snake_case)' },
    { id: 'constantcase', name: '常量命名 (CONSTANT_CASE)' },
    { id: 'kebabcase', name: '烤串命名 (kebab-case)' },
  ];

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-3 mb-4">
        <ArrowUpDown className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">大小写转换工具</h2>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">输入文本</label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:border-blue-500"
          rows={3}
          placeholder="输入要转换的文本..."
        />
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {caseTypes.map((caseType) => (
            <div key={caseType.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{caseType.name}</div>
              <div className="bg-white dark:bg-gray-600 rounded-lg px-3 py-2 mb-2 font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
                {results[caseType.id] || ''}
              </div>
              <button
                onClick={() => handleCopy(results[caseType.id])}
                disabled={!results[caseType.id]}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Copy className="w-3 h-3" />
                复制
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CaseConverterPage;