import React, { useState, useEffect, useCallback } from 'react';
import { Code, Copy, FileText } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const RegexTesterPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [testString, setTestString] = useState('');
  const [matches, setMatches] = useState<Array<{ match: string; index: number; groups?: Record<string, string> }>>([]);
  const [error, setError] = useState('');
  const [isValid, setIsValid] = useState(true);

  const flagOptions = [
    { value: 'g', label: 'global', desc: '全局匹配' },
    { value: 'i', label: 'ignoreCase', desc: '忽略大小写' },
    { value: 'm', label: 'multiline', desc: '多行模式' },
    { value: 's', label: 'dotAll', desc: '. 匹配换行' },
  ];

  const testRegex = useCallback(() => {
    if (!pattern) {
      setMatches([]);
      setError('');
      setIsValid(true);
      return;
    }

    try {
      const regex = new RegExp(pattern, flags);
      setIsValid(true);
      setError('');

      if (!testString) {
        setMatches([]);
        return;
      }

      const results: typeof matches = [];
      let match;

      if (flags.includes('g')) {
        while ((match = regex.exec(testString)) !== null) {
          results.push({
            match: match[0],
            index: match.index,
            groups: match.groups,
          });
          if (match[0].length === 0) {
            regex.lastIndex++;
          }
        }
      } else {
        match = regex.exec(testString);
        if (match) {
          results.push({
            match: match[0],
            index: match.index,
            groups: match.groups,
          });
        }
      }

      setMatches(results);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '无效的正则表达式';
      setError(errorMsg);
      setIsValid(false);
      setMatches([]);
    }
  }, [pattern, flags, testString]);

  useEffect(() => {
    testRegex();
  }, [testRegex]);

  const toggleFlag = useCallback((flag: string) => {
    if (flags.includes(flag)) {
      setFlags(flags.replace(flag, ''));
    } else {
      setFlags(flags + flag);
    }
  }, [flags]);

  const handleCopy = useCallback(() => {
    if (!pattern) {
      addToast({ message: '没有可复制的内容', type: 'warning' });
      return;
    }
    
    navigator.clipboard.writeText(`/${pattern}/${flags}`).then(() => {
      addToast({ message: '已复制到剪贴板', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [pattern, flags, addToast]);

  const loadSample = useCallback(() => {
    setPattern('\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b');
    setTestString(`联系我们：
email: test@example.com
电话: 123-456-7890
备用邮箱: user.name@company.org
无效邮箱: @invalid.com, missing.at.sign.com`);
  }, []);

  const highlightMatches = () => {
    if (!testString || matches.length === 0) return testString;
    
    let result = testString;
    const sortedMatches = [...matches].sort((a, b) => b.index - a.index);
    
    sortedMatches.forEach(match => {
      const before = result.slice(0, match.index);
      const matched = result.slice(match.index, match.index + match.match.length);
      const after = result.slice(match.index + match.match.length);
      result = before + `<mark class="bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded">${matched}</mark>` + after;
    });
    
    return result;
  };

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Code className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">正则表达式测试器</h2>
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
            disabled={!pattern}
            className="flex items-center gap-2 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            <span className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500">/</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono outline-none"
              placeholder="输入正则表达式"
            />
            <span className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500">/</span>
            <input
              type="text"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              className="w-12 px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono outline-none text-center"
            />
          </div>
        </div>
        
        <div className="flex gap-1">
          {flagOptions.map(flag => (
            <button
              key={flag.value}
              onClick={() => toggleFlag(flag.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                flags.includes(flag.value)
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
              title={flag.desc}
            >
              {flag.value}
            </button>
          ))}
        </div>
      </div>

      {!isValid && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0">
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t-lg">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">测试文本</span>
            </div>
            <textarea
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              className="flex-1 w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg"
              placeholder="在此输入测试文本..."
            />
          </div>
          
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-t-lg flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">匹配结果</span>
              <span className="text-sm text-gray-500">找到 {matches.length} 个匹配</span>
            </div>
            <div className="flex-1 w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 font-mono text-sm overflow-auto border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-lg whitespace-pre-wrap break-all">
              {testString ? (
                <span dangerouslySetInnerHTML={{ __html: highlightMatches() }} />
              ) : (
                <span className="text-gray-400">输入测试文本查看匹配结果...</span>
              )}
            </div>
          </div>
        </div>

        {matches.length > 0 && (
          <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">匹配详情</h4>
            <div className="flex flex-wrap gap-2">
              {matches.map((match, index) => (
                <div key={index} className="bg-white dark:bg-gray-700 px-3 py-1.5 rounded text-sm">
                  <span className="text-gray-500">#{index + 1}: </span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">"${match.match}"</span>
                  <span className="text-gray-500 ml-2">@ {match.index}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegexTesterPage;