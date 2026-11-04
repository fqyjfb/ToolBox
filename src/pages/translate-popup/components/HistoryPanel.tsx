import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Trash2 } from 'lucide-react';
import {
  clearTranslateHistory,
  listTranslateHistory,
  removeTranslateHistory,
} from '../../../services/translateHistoryClient';
import type { TranslateRecord } from '../../../types/translate';

interface HistoryPanelProps {
  /** 点击某条记录：回填原文到输入框（自动翻译由输入防抖 effect 承接） */
  onSelect: (text: string) => void;
  onCopy: (text: string) => void;
}

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString();

const preview = (text: string) => {
  const value = (text || '').replace(/\s+/g, ' ').trim();
  return value.length > 60 ? `${value.slice(0, 60)}…` : value;
};

/** 取首条成功译文作为预览/复制内容 */
const firstTranslation = (record: TranslateRecord) =>
  record.results.find((result) => result.status === 'success' && result.text)?.text || '';

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onSelect, onCopy }) => {
  const [records, setRecords] = useState<TranslateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // 服务端写入时已按设置上限裁剪，这里直接取全量
      setRecords(await listTranslateHistory());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRemove = async (event: React.MouseEvent, id: string) => {
    event.stopPropagation();
    await removeTranslateHistory(id);
    setRecords((previous) => previous.filter((record) => record.id !== id));
  };

  const handleCopy = (event: React.MouseEvent, record: TranslateRecord) => {
    event.stopPropagation();
    const text = firstTranslation(record) || record.source_text;
    if (text) onCopy(text);
  };

  const handleClear = async () => {
    await clearTranslateHistory();
    setRecords([]);
  };

  return (
    <aside className="tp-history">
      <div className="tp-history-header">
        <span className="tp-history-title">翻译记录</span>
        <button
          type="button"
          className="tp-history-clear"
          onClick={() => void handleClear()}
          disabled={records.length === 0}
        >
          清空
        </button>
      </div>

      {loading ? (
        <p className="tp-history-empty">
          <Loader2 size={14} className="tp-spin" />
          加载中…
        </p>
      ) : records.length === 0 ? (
        <p className="tp-history-empty">暂无翻译记录</p>
      ) : (
        <div className="tp-history-list">
          {records.map((record) => (
            <div
              key={record.id}
              className="tp-history-item"
              role="button"
              tabIndex={0}
              title="点击回填原文"
              onClick={() => onSelect(record.source_text)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSelect(record.source_text);
              }}
            >
              <p className="tp-history-source">{preview(record.source_text)}</p>
              <p className="tp-history-meta">
                {record.source_language_name} → {record.target_language_name} · {formatTime(record.created_at)}
              </p>
              <div className="tp-history-actions">
                <button
                  type="button"
                  className="tp-icon-button"
                  title="复制译文"
                  onClick={(event) => handleCopy(event, record)}
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  className="tp-icon-button"
                  title="删除"
                  onClick={(event) => void handleRemove(event, record.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default HistoryPanel;
