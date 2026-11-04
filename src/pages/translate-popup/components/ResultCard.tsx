import React from 'react';
import { AlertCircle, Check, Copy, Languages } from 'lucide-react';
import { PROVIDER_LABELS, TranslateRecordResult } from '../../../types/translate';

interface ResultCardProps {
  result: TranslateRecordResult;
  onCopy: (text: string) => void;
}

const ResultCard: React.FC<ResultCardProps> = ({ result, onCopy }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    if (!result.text) return;
    onCopy(result.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <section className="tp-card">
      <header className="tp-card-header">
        <span className="tp-card-provider">
          <Languages size={16} />
          {PROVIDER_LABELS[result.provider] || result.provider}
        </span>
        {result.status === 'success' && result.text && (
          <button type="button" className="tp-icon-button" onClick={handleCopy} title="复制译文">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
        )}
      </header>

      {result.status === 'pending' && <p className="tp-card-hint">翻译中…</p>}

      {result.status === 'failed' && (
        <p className="tp-card-error">
          <AlertCircle size={16} />
          {result.error || '翻译失败'}
        </p>
      )}

      {result.status === 'success' && (
        <>
          <p className="tp-card-text">{result.text}</p>
          {result.pronounce && <p className="tp-card-pronounce">{result.pronounce}</p>}
          {!!result.explains?.length && (
            <p className="tp-card-explains">{result.explains.join('；')}</p>
          )}
        </>
      )}
    </section>
  );
};

export default ResultCard;
