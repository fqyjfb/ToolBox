import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import { openUrl } from '../../services/browserService';
import type { TodayInHistoryItem, ItNewsItem, AiNewsItem } from '../../types/hotNews';

interface NewsItem {
  title: string;
  link?: string;
  description?: string;
  source?: string;
}

interface NewsContainerProps {
  sixtySecondsLoading: boolean;
  sixtySecondsError: string;
  sixtySecondsData: string[] | null;
  
  historyLoading: boolean;
  historyError: string;
  historyData: TodayInHistoryItem[] | null;
  
  itNewsLoading: boolean;
  itNewsError: string;
  itNewsData: ItNewsItem[] | null;
  
  aiNewsLoading: boolean;
  aiNewsError: string;
  aiNewsData: AiNewsItem[] | null;
  
  onRetrySixtySeconds: () => void;
  onRetryHistory: () => void;
  onRetryItNews: () => void;
  onRetryAiNews: () => void;
}

type TabType = 'news' | 'history' | 'it' | 'ai';

const NewsContainer: React.FC<NewsContainerProps> = ({
  sixtySecondsLoading,
  sixtySecondsError,
  sixtySecondsData,
  historyLoading,
  historyError,
  historyData,
  itNewsLoading,
  itNewsError,
  itNewsData,
  aiNewsLoading,
  aiNewsError,
  aiNewsData,
  onRetrySixtySeconds,
  onRetryHistory,
  onRetryItNews,
  onRetryAiNews
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('news');

  const tabs = [
    { id: 'news' as TabType, label: '热点' },
    { id: 'history' as TabType, label: '历史今天' },
    { id: 'it' as TabType, label: 'IT资讯' },
    { id: 'ai' as TabType, label: 'AI快报' }
  ];

  const getTabData = (): {
    loading: boolean;
    error: string;
    data: NewsItem[] | null;
    onRetry: () => void;
  } => {
    switch (activeTab) {
      case 'news':
        return {
          loading: sixtySecondsLoading,
          error: sixtySecondsError,
          data: sixtySecondsData?.map(title => ({ title })) || null,
          onRetry: onRetrySixtySeconds
        };
      case 'history':
        return {
          loading: historyLoading,
          error: historyError,
          data: historyData?.map(item => ({
            title: item.title,
            link: item.link,
            description: item.description
          })) || null,
          onRetry: onRetryHistory
        };
      case 'it':
        return {
          loading: itNewsLoading,
          error: itNewsError,
          data: itNewsData?.map(item => ({
            title: item.title,
            link: item.link,
            description: item.description
          })) || null,
          onRetry: onRetryItNews
        };
      case 'ai':
        return {
          loading: aiNewsLoading,
          error: aiNewsError,
          data: aiNewsData?.map(item => ({
            title: item.title,
            link: item.link,
            description: item.detail,
            source: item.source
          })) || null,
          onRetry: onRetryAiNews
        };
      default:
        return { loading: false, error: '', data: null, onRetry: () => {} };
    }
  };

  const { loading, error, data, onRetry } = getTabData();

  const handleRefresh = () => {
    onRetry();
  };

  return (
    <div className="card flex-1 h-full flex flex-col">
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
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="card__content flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="news-tabs flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-600 mb-2">
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
        ) : data ? (
          <ul className="news-list flex-1 overflow-y-auto space-y-2 min-h-0">
            {data.map((item, index) => (
              <li
                key={index}
                className={`news-item text-xs ${item.link ? 'cursor-pointer hover:text-blue-500' : ''}`}
                onClick={() => item.link && openUrl(item.link)}
              >
                <span className="news-title" title={item.description}>
                  {index + 1}. {item.title}
                </span>
                {item.source && (
                  <span className="news-source ml-2 text-xs text-gray-400">
                    ({item.source})
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export default NewsContainer;