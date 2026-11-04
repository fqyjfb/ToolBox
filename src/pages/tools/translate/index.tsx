import React, { useState, useMemo } from 'react';
import { RefreshCw, Copy, ArrowRight, Check } from 'lucide-react';
import { apiService, type TranslateLanguageInfo } from '../../../services/api';
import { logError } from '../../../services/loggerService';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Select, { SelectOption } from '../../../components/ui/Select';
import { LANGUAGES } from '../../../constants/languages';

const TranslatePage: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceInfo, setSourceInfo] = useState<TranslateLanguageInfo | null>(null);
  const [targetInfo, setTargetInfo] = useState<TranslateLanguageInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const languageOptions = useMemo<SelectOption[]>(
    () => LANGUAGES.map((lang) => ({ value: lang.code, label: lang.label })),
    []
  );

  // 目标语言「自动选择」：由接口按文档规则决定，源语言为中文则译英文，否则译中文
  const targetLangOptions = useMemo<SelectOption[]>(
    () => [{ value: 'auto', label: '自动选择' }, ...languageOptions.filter((opt) => opt.value !== 'auto')],
    [languageOptions]
  );

  const handleTranslate = async () => {
    const text = inputText.trim();
    if (!text) return;

    setLoading(true);
    setError('');
    try {
      const { source, target } = await apiService.translate(text, sourceLang, targetLang);
      setOutputText(target.text);
      setSourceInfo(source);
      setTargetInfo(target);
    } catch (err) {
      logError('翻译失败', 'Translate', err as Error);
      setError(err instanceof Error ? err.message : '翻译失败');
      setOutputText('');
      setSourceInfo(null);
      setTargetInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto' && targetLang === 'auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    if (outputText) {
      setInputText(outputText);
      setOutputText('');
      setSourceInfo(null);
      setTargetInfo(null);
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logError('复制失败', 'Translate', err as Error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleTranslate();
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Select
          value={sourceLang}
          onChange={setSourceLang}
          options={languageOptions}
          className="px-3 py-2 bg-surface border border-content rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />

        <button
          onClick={handleSwapLanguages}
          disabled={sourceLang === 'auto' && targetLang === 'auto'}
          className={`p-2 rounded-lg transition-colors ${
            sourceLang === 'auto' && targetLang === 'auto'
              ? 'bg-surface-secondary text-content-tertiary cursor-not-allowed dark:bg-surface dark:text-content-tertiary'
              : 'bg-surface-secondary hover:bg-gray-200 text-gray-600 hover:text-gray-800 dark:bg-surface dark:hover:bg-menu-hover dark:text-content-secondary'
          }`}
          title="交换语言"
        >
          <ArrowRight size={18} className="rotate-180" />
        </button>

        <Select
          value={targetLang}
          onChange={setTargetLang}
          options={targetLangOptions}
          className="px-3 py-2 bg-surface border border-content rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        />

        <button
          onClick={handleTranslate}
          disabled={loading || !inputText.trim()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-button-text rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              翻译中
            </>
          ) : (
            '翻译'
          )}
        </button>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 flex flex-col bg-surface rounded-lg shadow-sm min-h-0">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-content-secondary">
              {sourceInfo ? `${sourceInfo.type_desc} (${sourceInfo.type})` : '请输入文本'}
            </span>
            {sourceInfo?.pronounce && (
              <span className="text-xs text-content-tertiary">{sourceInfo.pronounce}</span>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入要翻译的文本..."
            className="flex-1 p-3 resize-none focus:outline-none text-sm bg-transparent"
          />
          <div className="px-3 py-2">
            <p className="text-xs text-content-tertiary">Ctrl+Enter 快捷翻译</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-surface rounded-lg shadow-sm min-h-0">
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-content-secondary">
              {targetInfo ? `${targetInfo.type_desc} (${targetInfo.type})` : '翻译结果'}
            </span>
            {targetInfo?.pronounce && (
              <span className="text-xs text-content-tertiary">{targetInfo.pronounce}</span>
            )}
          </div>
          <div className="flex-1 p-3 overflow-y-auto scrollbar-5px">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
              </div>
            ) : error ? (
              <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            ) : outputText ? (
              <p className="text-sm whitespace-pre-wrap">{outputText}</p>
            ) : (
              <p className="text-sm text-content-tertiary">翻译结果将显示在这里</p>
            )}
          </div>
          {outputText && (
            <div className="px-3 py-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-content-secondary hover:bg-menu-hover rounded transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-500" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    复制
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TranslatePage;