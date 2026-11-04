import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, History, Pin, PinOff, RefreshCw, X, Loader2, AlertCircle } from 'lucide-react';
import { getLanguageLabel, LANGUAGES } from '../../constants/languages';
import { useAIConfigStore } from '../../store/aiConfigStore';
import { useTranslateConfigStore } from '../../store/translateConfigStore';
import { runTranslate } from '../../services/translateRunner';
import { saveTranslateHistory } from '../../services/translateHistoryClient';
import { applyBaseClass, applyCustomTheme, clearCustomThemeStyles } from '../../utils/themeInject';
import { withThemeDefaults } from '../../types/theme';
import type { CustomThemeColorSnapshot } from '../../types/theme';
import type {
  TranslateRecord,
  TranslateRecordResult,
  TranslateTrigger,
} from '../../types/translate';
import ResultCard from './components/ResultCard';
import HistoryPanel from './components/HistoryPanel';

interface PopupVisiblePayload {
  visible: boolean;
  text?: string;
  autoTranslate?: boolean;
  trigger?: TranslateTrigger;
  fallback?: boolean;
  error?: string;
  pinned?: boolean;
}

interface ThemePayload {
  isDark: boolean;
  snapshot: CustomThemeColorSnapshot | null;
}

const AUTO_TRANSLATE_DEBOUNCE = 500;

/** 截图翻译错误分类（与主进程 formatError 文案对应） */
type OcrErrorKind = 'missing-service' | 'port-migrated' | 'unknown';

const classifyOcrError = (message: string): OcrErrorKind => {
  if (!message) return 'unknown';
  if (message.includes('识别组件缺失')) return 'missing-service';
  if (message.includes('自动迁移')) return 'port-migrated';
  return 'unknown';
};

const applyTheme = (payload: ThemePayload | null) => {
  if (!payload) return;
  applyBaseClass(payload.isDark);
  if (payload.snapshot) {
    applyCustomTheme(withThemeDefaults(payload.snapshot, payload.isDark), payload.isDark);
  } else {
    clearCustomThemeStyles();
  }
};

const TranslatePopup: React.FC = () => {
  const config = useTranslateConfigStore((state) => state.config);
  const updateConfig = useTranslateConfigStore((state) => state.update);

  const [text, setText] = useState('');
  const [results, setResults] = useState<TranslateRecordResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [pinned, setPinned] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<TranslateTrigger>('selection');
  const lastTranslatedRef = useRef('');
  const skipAutoRef = useRef(false);
  const requestIdRef = useRef(0);

  const translate = useCallback(async (rawText: string) => {
    const value = rawText.trim();
    if (!value) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    lastTranslatedRef.current = value;
    setLoading(true);
    setNotice('');
    setResults([]);

    const current = useTranslateConfigStore.getState().config;
    let latest: TranslateRecord | null = null;

    try {
      const { record } = await runTranslate(
        {
          text: value,
          sourceLang: current.source_lang,
          targetLang: current.target_lang,
          trigger: triggerRef.current,
          config: current,
        },
        {
          onRecordCreated: (created) => {
            latest = created;
            void saveTranslateHistory(created);
          },
          onResult: (provider, result) => {
            if (requestId !== requestIdRef.current) return;
            if (latest) {
              latest = {
                ...latest,
                results: latest.results.map((item) =>
                  item.provider === provider ? { ...item, ...result } : item,
                ),
              };
              void saveTranslateHistory(latest);
            }
            setResults((previous) => [
              ...previous.filter((item) => item.provider !== provider),
              { ...result },
            ]);
          },
        },
      );

      if (requestId !== requestIdRef.current) return;
      void saveTranslateHistory(record);
      setResults(record.results);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setNotice(error instanceof Error ? error.message : '翻译失败');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // 主题 / AI 配置快照 + 主进程下发内容
  useEffect(() => {
    let disposed = false;

    const handleVisible = (payload: PopupVisiblePayload | null) => {
      if (!payload || disposed) return;
      // 浮层常驻隐藏，设置页修改翻译配置后需重新读一次 localStorage
      useTranslateConfigStore.getState().reload();
      triggerRef.current = payload.trigger || 'selection';
      setPinned(Boolean(payload.pinned));
      // 快捷键重新触发翻译时自动收起历史记录，避免遮挡新结果
      setHistoryOpen(false);
      const nextText = payload.text || '';
      setText(nextText);
      setNotice(payload.error || '');
      if (payload.fallback) {
        setNotice((current) => current || '未能读取选中文本，已使用剪贴板内容');
      }
      if (payload.autoTranslate && nextText.trim()) {
        skipAutoRef.current = true;
        void translate(nextText);
      } else {
        setResults([]);
      }
    };

    void (async () => {
      const theme = await window.translateAPI?.getThemeSnapshot();
      if (!disposed) applyTheme(theme || null);
      const aiConfig = await window.translateAPI?.getAIConfig();
      if (!disposed && aiConfig) useAIConfigStore.getState().replaceConfig(aiConfig);
    })();

    const offTheme = window.translateAPI?.onThemeChanged((payload) => applyTheme(payload));
    const offAI = window.translateAPI?.onAIConfigChanged((payload) => {
      if (payload) useAIConfigStore.getState().replaceConfig(payload);
    });
    const offVisible = window.translateAPI?.onVisible(handleVisible);

    return () => {
      disposed = true;
      offTheme?.();
      offAI?.();
      offVisible?.();
    };
  }, [translate]);

  // 高度自适应：内容变化时把实际高度回报给主进程；历史面板开关影响窗口宽度
  useEffect(() => {
    const element = containerRef.current;
    if (!element || !window.translateAPI) return;
    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        window.translateAPI?.resize(element.getBoundingClientRect().height, historyOpen);
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [historyOpen]);

  // 输入自动翻译（防抖 500ms）
  useEffect(() => {
    if (!config.auto_translate_on_input) return;
    if (skipAutoRef.current) {
      skipAutoRef.current = false;
      return;
    }
    const value = text.trim();
    if (!value || lastTranslatedRef.current === value) return;
    const timer = window.setTimeout(() => {
      void translate(value);
    }, AUTO_TRANSLATE_DEBOUNCE);
    return () => window.clearTimeout(timer);
  }, [text, config.auto_translate_on_input, translate]);

  const handleCopy = useCallback((value: string) => {
    void window.translateAPI?.copy(value);
  }, []);

  const handlePin = () => {
    const next = !pinned;
    setPinned(next);
    void window.translateAPI?.setPinned(next);
  };

  const handleToggleHistory = () => {
    setHistoryOpen((previous) => !previous);
  };

  /** 历史记录回填：写入输入框，开启「输入时自动翻译」时由防抖 effect 自动翻译 */
  const handleHistorySelect = useCallback((value: string) => {
    setNotice('');
    setText(value);
  }, []);

  const handleOpenSettings = () => {
    void window.translateAPI?.openOcrSettings();
  };

  const languageOptions = LANGUAGES.map((language) => ({
    value: language.code,
    label: language.label,
  }));

  const errorKind = classifyOcrError(notice);

  return (
    <div className="tp-root" ref={containerRef}>
      <header className="tp-header">
        <span className="tp-title">翻译</span>
        <div className="tp-actions">
          <button
            type="button"
            className={`tp-icon-button${historyOpen ? ' is-active' : ''}`}
            onClick={handleToggleHistory}
            title={historyOpen ? '收起翻译记录' : '翻译记录'}
          >
            <History size={16} />
          </button>
          <button
            type="button"
            className={`tp-icon-button${pinned ? ' is-active' : ''}`}
            onClick={handlePin}
            title={pinned ? '取消置顶' : '始终置顶'}
          >
            {pinned ? <Pin size={16} /> : <PinOff size={16} />}
          </button>
          <button
            type="button"
            className="tp-icon-button"
            onClick={() => void window.translateAPI?.close()}
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="tp-body">
        {historyOpen && <HistoryPanel onSelect={handleHistorySelect} onCopy={handleCopy} />}

        <div className="tp-main">
          <div className="tp-lang-row">
        <select
          className="tp-select"
          value={config.source_lang}
          onChange={(event) => updateConfig({ source_lang: event.target.value })}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="tp-lang-arrow">→</span>
        <select
          className="tp-select"
          value={config.target_lang}
          onChange={(event) => updateConfig({ target_lang: event.target.value })}
        >
          {languageOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="tp-input-wrap">
        <textarea
          className="tp-input"
          value={text}
          placeholder="输入或粘贴需要翻译的内容"
          onChange={(event) => setText(event.target.value)}
          rows={2}
        />
        <button
          type="button"
          className="tp-icon-button tp-copy-origin-btn"
          onClick={() => handleCopy(text)}
          disabled={!text.trim()}
          title="复制原文"
        >
          <Copy size={14} />
        </button>
      </div>

      {notice && (
        <div className="tp-error">
          <p className="tp-notice">
            <AlertCircle size={16} />
            {notice}
          </p>
          {errorKind !== 'port-migrated' && (
            <div className="tp-error-actions">
              {errorKind === 'missing-service' && (
                <button type="button" className="tp-text-button" onClick={handleOpenSettings}>
                  打开设置
                </button>
              )}
              {errorKind === 'unknown' && text.trim() && (
                <button
                  type="button"
                  className="tp-primary-button"
                  onClick={() => void translate(text)}
                  disabled={loading}
                >
                  <RefreshCw size={16} />
                  重试
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="tp-results">
        {results.map((result) => (
          <ResultCard key={result.provider} result={result} onCopy={handleCopy} />
        ))}
        {loading && results.length === 0 && (
          <p className="tp-loading">
            <Loader2 size={16} className="tp-spin" />
            正在翻译…
          </p>
        )}
        {!loading && results.length === 0 && !notice && (
          <p className="tp-empty">
            选中文字后按 Alt+E 可快速取词翻译；当前语言：{getLanguageLabel(config.source_lang)}
          </p>
        )}
      </div>

      <footer className="tp-footer">
        <button
          type="button"
          className="tp-primary-button"
          onClick={() => void translate(text)}
          disabled={!text.trim() || loading}
        >
          <RefreshCw size={16} />
          {loading ? '翻译中' : '重新翻译'}
        </button>
      </footer>
        </div>
      </div>
    </div>
  );
};

export default TranslatePopup;
