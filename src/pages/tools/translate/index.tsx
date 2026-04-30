import React, { useState, useMemo } from 'react';
import { RefreshCw, Copy, ArrowRight, Check } from 'lucide-react';
import { apiService } from '../../../services/api';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

interface Language {
  code: string;
  label: string;
  alphabet: string;
}

const LANGUAGES: Language[] = [
  { code: 'auto', label: '自动检测', alphabet: '' },
  { code: 'sq', label: '阿尔巴尼亚语', alphabet: 'A' },
  { code: 'ga', label: '爱尔兰语', alphabet: 'A' },
  { code: 'et', label: '爱沙尼亚语', alphabet: 'A' },
  { code: 'ar', label: '阿拉伯语', alphabet: 'A' },
  { code: 'am', label: '阿姆哈拉语', alphabet: 'A' },
  { code: 'az', label: '阿塞拜疆语', alphabet: 'A' },
  { code: 'be', label: '白俄罗斯语', alphabet: 'B' },
  { code: 'bg', label: '保加利亚语', alphabet: 'B' },
  { code: 'eu', label: '巴斯克语', alphabet: 'B' },
  { code: 'is', label: '冰岛语', alphabet: 'B' },
  { code: 'pl', label: '波兰语', alphabet: 'B' },
  { code: 'bs-Latn', label: '波斯尼亚语(拉丁语)', alphabet: 'B' },
  { code: 'fa', label: '波斯语', alphabet: 'B' },
  { code: 'da', label: '丹麦语', alphabet: 'D' },
  { code: 'de', label: '德语', alphabet: 'D' },
  { code: 'ru', label: '俄语', alphabet: 'E' },
  { code: 'fr', label: '法语', alphabet: 'F' },
  { code: 'tl', label: '菲律宾语', alphabet: 'F' },
  { code: 'fi', label: '芬兰语', alphabet: 'F' },
  { code: 'fy', label: '弗里斯兰语', alphabet: 'F' },
  { code: 'km', label: '高棉语', alphabet: 'G' },
  { code: 'ka', label: '格鲁吉亚语', alphabet: 'G' },
  { code: 'gu', label: '古吉拉特语', alphabet: 'G' },
  { code: 'ht', label: '海地语', alphabet: 'H' },
  { code: 'ko', label: '韩语', alphabet: 'H' },
  { code: 'ha', label: '豪萨语', alphabet: 'H' },
  { code: 'kk', label: '哈萨克语', alphabet: 'H' },
  { code: 'nl', label: '荷兰语', alphabet: 'H' },
  { code: 'gl', label: '加利西亚语', alphabet: 'J' },
  { code: 'ca', label: '加泰罗尼亚语', alphabet: 'J' },
  { code: 'cs', label: '捷克语', alphabet: 'J' },
  { code: 'ky', label: '吉尔吉斯斯坦语', alphabet: 'J' },
  { code: 'kn', label: '卡纳达语', alphabet: 'K' },
  { code: 'tlh', label: '克林贡语', alphabet: 'K' },
  { code: 'hr', label: '克罗地亚语', alphabet: 'K' },
  { code: 'otq', label: '克洛塔罗乙巳语', alphabet: 'K' },
  { code: 'co', label: '科西嘉语', alphabet: 'K' },
  { code: 'ku', label: '库尔德语', alphabet: 'K' },
  { code: 'la', label: '拉丁语', alphabet: 'L' },
  { code: 'lo', label: '老挝语', alphabet: 'L' },
  { code: 'lv', label: '拉脱维亚语', alphabet: 'L' },
  { code: 'lt', label: '立陶宛语', alphabet: 'L' },
  { code: 'ro', label: '罗马尼亚语', alphabet: 'L' },
  { code: 'lb', label: '卢森堡语', alphabet: 'L' },
  { code: 'mg', label: '马尔加什语', alphabet: 'M' },
  { code: 'mt', label: '马耳他语', alphabet: 'M' },
  { code: 'mr', label: '马拉地语', alphabet: 'M' },
  { code: 'ms', label: '马来语', alphabet: 'M' },
  { code: 'ml', label: '马拉雅拉姆语', alphabet: 'M' },
  { code: 'mi', label: '毛利语', alphabet: 'M' },
  { code: 'mk', label: '马其顿语', alphabet: 'M' },
  { code: 'mn', label: '蒙古语', alphabet: 'M' },
  { code: 'bn', label: '孟加拉语', alphabet: 'M' },
  { code: 'my', label: '缅甸语', alphabet: 'M' },
  { code: 'mww', label: '苗族昂山土语', alphabet: 'M' },
  { code: 'hmn', label: '苗族语', alphabet: 'M' },
  { code: 'xh', label: '南非科萨语', alphabet: 'N' },
  { code: 'zu', label: '南非祖鲁语', alphabet: 'N' },
  { code: 'ne', label: '尼泊尔语', alphabet: 'N' },
  { code: 'no', label: '挪威语', alphabet: 'N' },
  { code: 'pa', label: '旁遮普语', alphabet: 'P' },
  { code: 'ps', label: '普什图语', alphabet: 'P' },
  { code: 'pt', label: '葡萄牙语', alphabet: 'P' },
  { code: 'ny', label: '齐切瓦语', alphabet: 'Q' },
  { code: 'ja', label: '日语', alphabet: 'R' },
  { code: 'sv', label: '瑞典语', alphabet: 'R' },
  { code: 'sr-Latn', label: '塞尔维亚语(拉丁语)', alphabet: 'S' },
  { code: 'sr-Cyrl', label: '塞尔维亚语(西里尔)', alphabet: 'S' },
  { code: 'st', label: '塞索托语', alphabet: 'S' },
  { code: 'sm', label: '萨摩亚语', alphabet: 'S' },
  { code: 'si', label: '僧伽罗语', alphabet: 'S' },
  { code: 'eo', label: '世界语', alphabet: 'S' },
  { code: 'sk', label: '斯洛伐克语', alphabet: 'S' },
  { code: 'sl', label: '斯洛文尼亚语', alphabet: 'S' },
  { code: 'sw', label: '斯瓦希里语', alphabet: 'S' },
  { code: 'gd', label: '苏格兰盖尔语', alphabet: 'S' },
  { code: 'so', label: '索马里语', alphabet: 'S' },
  { code: 'ceb', label: '宿务语', alphabet: 'S' },
  { code: 'te', label: '泰卢固语', alphabet: 'T' },
  { code: 'ta', label: '泰米尔语', alphabet: 'T' },
  { code: 'th', label: '泰语', alphabet: 'T' },
  { code: 'tg', label: '塔吉克语', alphabet: 'T' },
  { code: 'tr', label: '土耳其语', alphabet: 'T' },
  { code: 'cy', label: '威尔士语', alphabet: 'W' },
  { code: 'zh-lzh', label: '文言文', alphabet: 'W' },
  { code: 'ur', label: '乌尔都语', alphabet: 'W' },
  { code: 'uk', label: '乌克兰语', alphabet: 'W' },
  { code: 'uz', label: '乌兹别克语', alphabet: 'W' },
  { code: 'haw', label: '夏威夷语', alphabet: 'X' },
  { code: 'es', label: '西班牙语', alphabet: 'X' },
  { code: 'he', label: '希伯来语', alphabet: 'X' },
  { code: 'el', label: '希腊语', alphabet: 'X' },
  { code: 'sd', label: '信德语', alphabet: 'X' },
  { code: 'hu', label: '匈牙利语', alphabet: 'X' },
  { code: 'sn', label: '修纳语', alphabet: 'X' },
  { code: 'hy', label: '亚美尼亚语', alphabet: 'Y' },
  { code: 'ig', label: '伊博语', alphabet: 'Y' },
  { code: 'it', label: '意大利语', alphabet: 'Y' },
  { code: 'yi', label: '意第绪语', alphabet: 'Y' },
  { code: 'hi', label: '印地语', alphabet: 'Y' },
  { code: 'id', label: '印度尼西亚语', alphabet: 'Y' },
  { code: 'en', label: '英语', alphabet: 'Y' },
  { code: 'su', label: '印尼巽他语', alphabet: 'Y' },
  { code: 'jw', label: '印尼爪哇语', alphabet: 'Y' },
  { code: 'yua', label: '尤卡坦玛雅语', alphabet: 'Y' },
  { code: 'yo', label: '约鲁巴语', alphabet: 'Y' },
  { code: 'vi', label: '越南语', alphabet: 'Y' },
  { code: 'zh-CHS', label: '中文', alphabet: 'Z' },
  { code: 'zh-CHT', label: '中文(繁体)', alphabet: 'Z' },
];

const TranslatePage: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('zh-CHS');
  const [loading, setLoading] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<{ type: string; type_desc: string; pronounce: string } | null>(null);
  const [targetInfo, setTargetInfo] = useState<{ type: string; type_desc: string; pronounce: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const groupedLanguages = useMemo(() => {
    const groups: Record<string, Language[]> = {};
    LANGUAGES.forEach((lang) => {
      const key = lang.alphabet || 'other';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(lang);
    });
    return groups;
  }, []);

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const result = await apiService.translate(inputText, sourceLang, targetLang);
      if (result.data) {
        setOutputText(result.data.target.text);
        setSourceInfo({
          type: result.data.source.type,
          type_desc: result.data.source.type_desc,
          pronounce: result.data.source.pronounce,
        });
        setTargetInfo({
          type: result.data.target.type,
          type_desc: result.data.target.type_desc,
          pronounce: result.data.target.pronounce,
        });
      }
    } catch (error) {
      console.error('翻译失败:', error);
      setOutputText('');
      setSourceInfo(null);
      setTargetInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSwapLanguages = () => {
    if (sourceLang === 'auto') return;
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp);
    if (outputText) {
      setInputText(outputText);
      setOutputText('');
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleTranslate();
    }
  };

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        >
          {Object.entries(groupedLanguages).map(([alphabet, langs]) => (
            <optgroup key={alphabet} label={alphabet === 'other' ? '常用' : alphabet}>
              {langs.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <button
          onClick={handleSwapLanguages}
          disabled={sourceLang === 'auto'}
          className={`p-2 rounded-lg transition-colors ${
            sourceLang === 'auto'
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300'
          }`}
          title="交换语言"
        >
          <ArrowRight size={18} className="rotate-180" />
        </button>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
        >
          {Object.entries(groupedLanguages).map(([alphabet, langs]) => (
            <optgroup key={alphabet} label={alphabet === 'other' ? '常用' : alphabet}>
              {langs.filter((lang) => lang.code !== 'auto').map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <button
          onClick={handleTranslate}
          disabled={loading || !inputText.trim()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
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
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 min-h-0">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {sourceInfo ? `${sourceInfo.type_desc} (${sourceInfo.type})` : '请输入文本'}
            </span>
            {sourceInfo?.pronounce && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{sourceInfo.pronounce}</span>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入要翻译的文本..."
            className="flex-1 p-3 resize-none focus:outline-none text-sm bg-transparent"
          />
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500">Ctrl+Enter 快捷翻译</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 min-h-0">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {targetInfo ? `${targetInfo.type_desc} (${targetInfo.type})` : '翻译结果'}
            </span>
            {targetInfo?.pronounce && (
              <span className="text-xs text-gray-400 dark:text-gray-500">{targetInfo.pronounce}</span>
            )}
          </div>
          <div className="flex-1 p-3 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
              </div>
            ) : outputText ? (
              <p className="text-sm whitespace-pre-wrap">{outputText}</p>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">翻译结果将显示在这里</p>
            )}
          </div>
          {outputText && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
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