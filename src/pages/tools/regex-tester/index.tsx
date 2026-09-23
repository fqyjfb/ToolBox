import React, { useState, useEffect, useCallback } from 'react';
import { Code, Copy, FileText } from 'lucide-react';
import { useToolPage } from '../../../hooks/useToolPage';

const RegexTesterPage: React.FC = () => {
  const { handleCopy } = useToolPage();
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
    const timer = setTimeout(() => {
      testRegex();
    }, 0);
    return () => clearTimeout(timer);
  }, [testRegex]);

  const toggleFlag = useCallback((flag: string) => {
    if (flags.includes(flag)) {
      setFlags(flags.replace(flag, ''));
    } else {
      setFlags(flags + flag);
    }
  }, [flags]);

  const loadSample = useCallback(() => {
    setPattern('\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b');
    setTestString(`联系我们：
email: test@example.com
电话: 123-456-7890
备用邮箱: user.name@company.org
无效邮箱: @invalid.com, missing.at.sign.com`);
  }, []);

  const renderHighlighted = () => {
    if (!testString) {
      return <span className="text-content-tertiary">输入测试文本查看匹配结果...</span>;
    }
    if (matches.length === 0) return testString;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    [...matches]
      .sort((a, b) => a.index - b.index)
      .forEach((match, i) => {
        const start = match.index;
        const end = start + match.match.length;
        if (start < lastIndex) return;

        if (start > lastIndex) {
          parts.push(testString.slice(lastIndex, start));
        }
        parts.push(
          <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded">
            {testString.slice(start, end)}
          </mark>
        );
        lastIndex = end;
      });

    if (lastIndex < testString.length) {
      parts.push(testString.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Code className="w-6 h-6 text-content-secondary" />
          <h2 className="text-lg font-semibold text-content-primary">正则表达式测试器</h2>
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
            onClick={() => handleCopy(pattern)}
            disabled={!pattern}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-button-text rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Copy className="w-4 h-4" />
            复制
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center border border-content rounded-lg overflow-hidden">
            <span className="px-3 py-2 bg-surface-secondary text-content-tertiary">/</span>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="flex-1 px-3 py-2 bg-surface text-content-primary font-mono outline-none"
              placeholder="输入正则表达式"
            />
            <span className="px-3 py-2 bg-surface-secondary text-content-tertiary">/</span>
            <input
              type="text"
              value={flags}
              onChange={(e) => setFlags(e.target.value)}
              className="w-12 px-3 py-2 bg-surface text-content-primary font-mono outline-none text-center"
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
                  : 'bg-gray-200 dark:bg-surface text-content-primary hover:bg-gray-300 dark:hover:bg-menu-hover'
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

      <div className="flex-1 bg-surface rounded-lg shadow-md overflow-hidden flex flex-col">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0">
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border border-content rounded-t-lg">
              <span className="text-sm font-medium text-content-secondary">测试文本</span>
            </div>
            <textarea
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
              className="flex-1 w-full px-4 py-3 bg-surface-secondary dark:bg-content-primary text-content-primary font-mono text-sm resize-none outline-none border border-t-0 border-content rounded-b-lg"
              placeholder="在此输入测试文本..."
            />
          </div>
          
          <div className="flex flex-col min-h-0">
            <div className="px-4 py-2 bg-surface-secondary dark:bg-content-primary border border-content rounded-t-lg flex items-center justify-between">
              <span className="text-sm font-medium text-content-secondary">匹配结果</span>
              <span className="text-sm text-content-tertiary">找到 {matches.length} 个匹配</span>
            </div>
            <div className="flex-1 w-full px-4 py-3 bg-surface-secondary dark:bg-content-primary font-mono text-sm overflow-auto border border-t-0 border-content rounded-b-lg whitespace-pre-wrap break-all">
              {renderHighlighted()}
            </div>
          </div>
        </div>

        {matches.length > 0 && (
          <div className="px-4 py-3 bg-surface-secondary dark:bg-content-primary">
            <h4 className="text-sm font-medium text-content-primary mb-2">匹配详情</h4>
            <div className="flex flex-wrap gap-2">
              {matches.map((match, index) => (
                <div key={index} className="bg-surface px-3 py-1.5 rounded text-sm">
                  <span className="text-content-tertiary">#{index + 1}: </span>
                  <span className="font-mono text-content-primary">"${match.match}"</span>
                  <span className="text-content-tertiary ml-2">@ {match.index}</span>
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