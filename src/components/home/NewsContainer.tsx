import React, { useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { openUrl } from '../../services/browserService';
import { hotNewsApi } from '../../services/hotNews';
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
  
  onRetrySixtySeconds: () => void;
}

type TabType = 'news' | 'history' | 'it' | 'ai';

const NewsContainer: React.FC<NewsContainerProps> = ({
  sixtySecondsLoading,
  sixtySecondsError,
  sixtySecondsData,
  onRetrySixtySeconds
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('news');
  
  const [historyData, setHistoryData] = useState<TodayInHistoryItem[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  
  const [itNewsData, setItNewsData] = useState<ItNewsItem[] | null>(null);
  const [itNewsLoading, setItNewsLoading] = useState(false);
  const [itNewsError, setItNewsError] = useState('');
  
  const [aiNewsData, setAiNewsData] = useState<AiNewsItem[] | null>(null);
  const [aiNewsLoading, setAiNewsLoading] = useState(false);
  const [aiNewsError, setAiNewsError] = useState('');

  const tabs = [
    { id: 'news' as TabType, label: '热点' },
    { id: 'history' as TabType, label: '历史今天' },
    { id: 'it' as TabType, label: 'IT资讯' },
    { id: 'ai' as TabType, label: 'AI快报' }
  ];

  const fetchHistoryData = useCallback(async () => {
    if (historyData) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const data = await hotNewsApi.getTodayInHistory();
      if (data) {
        setHistoryData(data.data.items);
      } else {
        setHistoryError('获取数据失败');
      }
    } catch {
      setHistoryError('网络错误');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyData]);

  const fetchItNewsData = useCallback(async () => {
    if (itNewsData) return;
    setItNewsLoading(true);
    setItNewsError('');
    try {
      const data = await hotNewsApi.getItNews();
      if (data) {
        setItNewsData(data.data);
      } else {
        setItNewsError('获取数据失败');
      }
    } catch {
      setItNewsError('网络错误');
    } finally {
      setItNewsLoading(false);
    }
  }, [itNewsData]);

  const fetchAiNewsData = useCallback(async () => {
    if (aiNewsData) return;
    setAiNewsLoading(true);
    setAiNewsError('');
    try {
      const data = await hotNewsApi.getAiNews();
      if (data) {
        setAiNewsData(data.data.news);
      } else {
        setAiNewsError('获取数据失败');
      }
    } catch {
      setAiNewsError('网络错误');
    } finally {
      setAiNewsLoading(false);
    }
  }, [aiNewsData]);

  const handleTabChange = useCallback((tabId: TabType) => {
    setActiveTab(tabId);
    
    switch (tabId) {
      case 'history':
        fetchHistoryData();
        break;
      case 'it':
        fetchItNewsData();
        break;
      case 'ai':
        fetchAiNewsData();
        break;
    }
  }, [fetchHistoryData, fetchItNewsData, fetchAiNewsData]);

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
          onRetry: fetchHistoryData
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
          onRetry: fetchItNewsData
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
          onRetry: fetchAiNewsData
        };
      default:
        return { loading: false, error: '', data: null, onRetry: () => {} };
    }
  };

  const { loading, error, data, onRetry } = getTabData();

  const handleRefresh = () => {
    switch (activeTab) {
      case 'news':
        onRetrySixtySeconds();
        break;
      case 'history':
        setHistoryData(null);
        fetchHistoryData();
        break;
      case 'it':
        setItNewsData(null);
        fetchItNewsData();
        break;
      case 'ai':
        setAiNewsData(null);
        fetchAiNewsData();
        break;
    }
  };

  return (
    <div className="card flex-1 h-full flex flex-col">
      <div className="card__content flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="news-tabs flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-600 mb-2 items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:dark:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
              title="刷新"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
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

export default React.memo(NewsContainer);