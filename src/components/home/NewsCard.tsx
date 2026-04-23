import React from 'react';
import LoadingSpinner from '../LoadingSpinner';

interface NewsCardProps {
  loading: boolean;
  error: string;
  newsData: string[] | null;
  onRetry: () => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ loading, error, newsData, onRetry }) => {
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
        <h2>今日热点</h2>
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
        ) : newsData ? (
          <ul className="daily-news-list space-y-2 max-h-64 overflow-y-auto">
            {newsData.map((news, index) => (
              <li key={index} className="text-sm">{index + 1}. {news}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export default NewsCard;