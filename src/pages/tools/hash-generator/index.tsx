import React, { useState, useEffect, useCallback } from 'react';
import { Hash, Copy, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';
import { md5 } from '../../../utils/md5';

const hashAlgorithms = [
  { id: 'md5', name: 'MD5', bits: '128 位' },
  { id: 'sha1', name: 'SHA-1', bits: '160 位' },
  { id: 'sha256', name: 'SHA-256', bits: '256 位' },
  { id: 'sha384', name: 'SHA-384', bits: '384 位' },
  { id: 'sha512', name: 'SHA-512', bits: '512 位' },
  { id: 'base64', name: 'Base64', bits: '编码' },
];

const HashGeneratorPage: React.FC = () => {
  const { handleCopy } = useToolPage();
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Record<string, string>>({});

  const bufferToHex = (buffer: ArrayBuffer): string => {
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const computeHash = useCallback(async () => {
    if (!input.trim()) {
      setResults({});
      return;
    }

    const textEncoder = new TextEncoder();
    const data = textEncoder.encode(input);
    const newResults: Record<string, string> = {};

    for (const algo of hashAlgorithms) {
      try {
        if (algo.id === 'md5') {
          newResults[algo.id] = md5(input);
        } else if (algo.id === 'base64') {
          newResults[algo.id] = btoa(input);
        } else {
          const webCryptoAlgo = algo.id.toUpperCase().replace('SHA', 'SHA-');
          const hashBuffer = await crypto.subtle.digest(webCryptoAlgo, data);
          newResults[algo.id] = bufferToHex(hashBuffer);
        }
      } catch {
        newResults[algo.id] = '不支持';
      }
    }

    setResults(newResults);
  }, [input]);

  useEffect(() => {
    computeHash();
  }, [computeHash]);

  const loadSample = useCallback(() => {
    setInput('Hello, World!');
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Hash className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">哈希生成器</h2>
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
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 resize-none outline-none focus:border-blue-500"
          rows={3}
          placeholder="输入要计算哈希值的文本..."
        />
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {hashAlgorithms.map((algo) => (
            <div key={algo.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{algo.name}</span>
                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-full">
                  {algo.bits}
                </span>
              </div>
              <div className="bg-white dark:bg-gray-600 rounded-lg px-3 py-2 mb-2 font-mono text-xs text-gray-800 dark:text-gray-200 break-all min-h-[40px]">
                {results[algo.id] || ''}
              </div>
              <button
                onClick={() => handleCopy(results[algo.id])}
                disabled={!results[algo.id] || results[algo.id] === '不支持'}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
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

export default HashGeneratorPage;