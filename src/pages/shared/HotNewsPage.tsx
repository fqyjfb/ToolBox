import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { hotNewsApi } from '../../services/hotNews';
import type { UnifiedHotItem, HotNewsPlatform } from '../../types/hotNews';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { openUrl } from '../../services/browserService';
import { debounce, formatHotValue } from '../../utils';
import { Inbox, RefreshCw } from 'lucide-react';
import './HotNewsPage.css';

const HotNewsPage: React.FC = () => {
  const [hotNewsData, setHotNewsData] = useState<Record<string, UnifiedHotItem[]>>({});
  const [loadingByPlatform, setLoadingByPlatform] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<HotNewsPlatform>('douyin');
  const controllerRef = useRef<AbortController | null>(null);
  const hotNewsDataRef = useRef(hotNewsData);

  useEffect(() => {
    hotNewsDataRef.current = hotNewsData;
  }, [hotNewsData]);

  const tabs = [
    { label: '抖音', value: 'douyin' as HotNewsPlatform, icon: './hot/抖音.png' },
    { label: '夸克', value: 'quark' as HotNewsPlatform, icon: './hot/夸克.png' },
    { label: '百度', value: 'baidu' as HotNewsPlatform, icon: './hot/百度.png' },
    { label: '头条', value: 'toutiao' as HotNewsPlatform, icon: './hot/头条.png' },
    { label: '知乎', value: 'zhihu' as HotNewsPlatform, icon: './hot/知乎.png' },
    { label: '小红书', value: 'rednote' as HotNewsPlatform, icon: './hot/小红书.png' },
    { label: '微博', value: 'weibo' as HotNewsPlatform, icon: './hot/微博.png' },
    { label: '懂车帝', value: 'dongchedi' as HotNewsPlatform, icon: './hot/懂车帝.png' }
  ];

  const currentHotNews = hotNewsData[activeTab] || [];
  const isCurrentPlatformLoading = loadingByPlatform[activeTab] || false;

  const openLink = (url: string): void => {
    openUrl(url);
  };

  const fetchPlatformHotNews = useCallback(async (platform: HotNewsPlatform, forceRefresh = false) => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    
    controllerRef.current = new AbortController();
    const currentController = controllerRef.current;
    
    setLoadingByPlatform(prev => ({ ...prev, [platform]: true }));
    
    try {
      const data = await hotNewsApi.getPlatformHotNews(platform, {
        signal: currentController.signal,
        forceRefresh
      });
      
      if (data && currentController.signal.aborted === false) {
        setHotNewsData(prev => ({ ...prev, [platform]: data }));
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
      }
    } finally {
      if (currentController.signal.aborted === false) {
        setLoadingByPlatform(prev => ({ ...prev, [platform]: false }));
      }
    }
  }, []);

  useEffect(() => {
    const currentData = hotNewsDataRef.current;
    if (!currentData[activeTab]?.length) {
      fetchPlatformHotNews(activeTab);
    }

    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [activeTab, fetchPlatformHotNews]);

  const refreshCurrentPlatform = useMemo(() => {
    const fetchData = () => {
      fetchPlatformHotNews(activeTab, true);
    };
    
    return debounce(fetchData, 500);
  }, [activeTab, fetchPlatformHotNews]);

  const handleTabChange = (platform: HotNewsPlatform) => {
    setActiveTab(platform);
  };

  const renderHotCard = (item: UnifiedHotItem) => {
    return (
      <div
        key={item.id || item.title}
        className={`hot-card ${item.cover ? 'hot-card-with-image' : 'hot-card-no-image'}`}
        onClick={() => openLink(item.link)}
      >
        {item.cover && (
          <div className="hot-card-cover">
            <img src={item.cover} alt={item.title} loading="lazy" />
          </div>
        )}
        <div className="hot-card-info">
          <div className="hot-card-header">
            <div className="hot-card-badges">
              {item.rank && <span className="hot-rank-badge">{item.rank}</span>}
              {item.wordType && item.wordType !== '无' && (
                <span className={`hot-word-type-badge hot-word-type-${item.wordType}`}>{item.wordType}</span>
              )}
              {item.typeDesc && <span className="hot-type-desc-badge">{item.typeDesc}</span>}
            </div>
            <h3 className="hot-title">
              {item.title}
              {(item.platform === 'douyin' || item.platform === 'rednote' || item.platform === 'dongchedi') && item.hotValue && (
                <span className="hot-title-value">{formatHotValue(item.hotValue)}</span>
              )}
            </h3>
          </div>
          
          {(item.desc || item.detail || item.summary) && (
            <div className="hot-card-desc">
              {item.desc || item.detail || item.summary}
            </div>
          )}
          
          {(item.commentCount || item.likeCount || item.shareCount || item.answerCount || item.followerCount || (item.hotValue && !['douyin', 'rednote', 'dongchedi'].includes(item.platform))) && (
            <div className="hot-card-stats">
              {item.hotValue && !['douyin', 'rednote', 'dongchedi'].includes(item.platform) && (
                <span className="hot-value">热度: {formatHotValue(item.hotValue)}</span>
              )}
              {item.commentCount && <span>评论: {item.commentCount}</span>}
              {item.likeCount && <span>点赞: {item.likeCount}</span>}
              {item.shareCount && <span>分享: {item.shareCount}</span>}
              {item.answerCount && <span>回答: {item.answerCount}</span>}
              {item.followerCount && <span>关注: {item.followerCount}</span>}
            </div>
          )}
          
          {(item.source || item.publishedAt || item.scoreDesc || item.typeDesc || item.releaseInfo || item.activeTimeAt || item.eventTimeAt || item.wordType || item.category || item.tags || item.avgSeatView || item.avgShowView || item.sumBoxDesc || item.splitBoxDesc) && (
            <div className="hot-card-extra">
              {item.activeTimeAt && (
                <span className="hot-time">激活时间：{new Date(item.activeTimeAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {item.eventTimeAt && (
                <span className="hot-time">事件时间：{new Date(item.eventTimeAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {item.publishedAt && (
                <span className="hot-time">{new Date(item.publishedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {item.source && <span className="hot-source">{item.source}</span>}
              {item.category && <span className="hot-category">{item.category}</span>}
              {item.scoreDesc && !['baidu', 'dongchedi'].includes(item.platform) && (
                <span className="hot-score-desc">{item.scoreDesc}</span>
              )}
              {item.releaseInfo && <span className="hot-release-info">{item.releaseInfo}</span>}
              {item.avgSeatView && <span className="hot-avg-seat-view">{item.avgSeatView} 上座率</span>}
              {item.avgShowView && <span className="hot-avg-show-view">{item.avgShowView} 场均</span>}
              {item.sumBoxDesc && <span className="hot-sum-box-desc">{item.sumBoxDesc}</span>}
              {item.splitBoxDesc && <span className="hot-split-box-desc">{item.splitBoxDesc}</span>}
              {item.tags && item.tags.slice(0, 3).map((tag: string, index: number) => (
                <span key={index} className="hot-tag" title={tag}>{tag.length > 8 ? tag.substring(0, 8) + '...' : tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="hot-news-content p-6">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="squircleClip" clipPathUnits="objectBoundingBox">
            <path d="M 0,0.5 C 0,0 0,0 0.5,0 S 1,0 1,0.5 1,1 0.5,1 0,1 0,0.5"></path>
          </clipPath>
        </defs>
      </svg>
      
      <div className="hot-platform-tabs">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`platform-tab ${activeTab === tab.value ? 'active' : ''}`}
              title={tab.label}
            >
              <img src={tab.icon} alt={tab.label} className="w-6 h-6" />
              <span className="platform-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={refreshCurrentPlatform}
          className="refresh-tab"
          title="刷新"
          disabled={isCurrentPlatformLoading}
        >
          {!isCurrentPlatformLoading ? (
            <RefreshCw className="w-5 h-5" />
          ) : (
            <LoadingSpinner size="xs" />
          )}
        </button>
      </div>
      
      <div className="hot-list-container">
        <div className="hot-list">
          {isCurrentPlatformLoading && currentHotNews.length === 0 ? (
            <div className="loading-state">
              <div className="loading-content">
                <LoadingSpinner size="lg" text="" />
              </div>
            </div>
          ) : (
            <>
              {currentHotNews.length > 0 && (
                <>
                  {currentHotNews.some(item => item.cover) && (
                    <div className="hot-masonry-grid">
                      {currentHotNews.filter(item => item.cover).map(renderHotCard)}
                    </div>
                  )}
                  
                  {currentHotNews.some(item => !item.cover) && (
                    <div className="hot-list-view">
                      {currentHotNews.filter(item => !item.cover).map(renderHotCard)}
                    </div>
                  )}
                </>
              )}
              
              {currentHotNews.length === 0 && !isCurrentPlatformLoading && (
                <div className="empty-state">
                  <Inbox className="empty-icon" size={48} />
                  <p>暂无热点数据</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default HotNewsPage;