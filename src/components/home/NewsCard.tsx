import React, { useState } from 'react';
import LoadingSpinner from '../LoadingSpinner';
import { openUrl } from '../../services/browserService';
import type { TodayInHistoryItem } from '../../types/hotNews';

interface NewsCardProps {
  sixtySecondsLoading: boolean;
  sixtySecondsError: string;
  sixtySecondsData: string[] | null;
  historyLoading: boolean;
  historyError: string;
  historyData: TodayInHistoryItem[] | null;
  onRetrySixtySeconds: () => void;
  onRetryHistory: () => void;
}

type TabType = 'news' | 'history';

const NewsCard: React.FC<NewsCardProps> = ({
  sixtySecondsLoading,
  sixtySecondsError,
  sixtySecondsData,
  historyLoading,
  historyError,
  historyData,
  onRetrySixtySeconds,
  onRetryHistory
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('news');

  const tabs = [
    { id: 'news' as TabType, label: '今日热点' },
    { id: 'history' as TabType, label: '历史上的今天' }
  ];

  const isLoading = activeTab === 'news' ? sixtySecondsLoading : historyLoading;
  const error = activeTab === 'news' ? sixtySecondsError : historyError;
  const data = activeTab === 'news' ? sixtySecondsData : historyData;
  const onRetry = activeTab === 'news' ? onRetrySixtySeconds : onRetryHistory;

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
        <h2>新闻热点</h2>
      </div>
      
      <div className="card__content">
        <div className="news-tabs flex border-b border-gray-200 dark:border-gray-600 mb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
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
        ) : data ? (
          <ul className="daily-news-list space-y-2 max-h-64 overflow-y-auto">
            {activeTab === 'news' ? (
              (data as string[]).map((news, index) => (
                <li key={index} className="text-sm">{index + 1}. {news}</li>
              ))
            ) : (
              (data as TodayInHistoryItem[]).map((item, index) => (
                <li
                  key={index}
                  className="history-item text-sm cursor-pointer hover:text-blue-500"
                  onClick={() => openUrl(item.link)}
                >
                  <span className="history-title" title={item.description}>
                    {index + 1}. {item.title}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export default NewsCard;