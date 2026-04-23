import React from 'react';
import LoadingSpinner from '../LoadingSpinner';
import { openUrl } from '../../services/browserService';

export interface HistoryItem {
  title: string;
  description: string;
  link: string;
}

interface HistoryCardProps {
  loading: boolean;
  error: string;
  historyData: HistoryItem[] | null;
  onRetry: () => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ loading, error, historyData, onRetry }) => {
  return (
    <div className="card flex-1">
      <div className="tools">
        <div className="flex space-x-2">
          <div className="circle">
            <span className="red box"></span>
          </div>
          <div className="circle">
            <span className="yellow box"></span>
          </div>
          <div className="circle">
            <span className="green box"></span>
          </div>
        </div>
        <h2>历史上的今天</h2>
      </div>
      <div className="card__content">
        {loading ? (
          <div className="info-loading flex items-center justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        ) : error ? (
          <div className="info-error">
            <p>{error}</p>
            <button 
              className="retry-btn mt-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-700 dark:hover:bg-blue-600" 
              onClick={onRetry}
            >
              重新加载
            </button>
          </div>
        ) : historyData ? (
          <ul className="daily-history-list space-y-2 max-h-64 overflow-y-auto">
            {historyData.map((item, index) => (
              <li
                key={index}
                className="history-item text-sm cursor-pointer hover:text-blue-500"
                onClick={() => openUrl(item.link)}
              >
                <span className="history-title" title={item.description}>{index + 1}. {item.title}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export default HistoryCard;