import React, { useState, useEffect, useRef, useCallback } from 'react';
import { hotNewsApi } from '../../services/hotNews';
import type { UnifiedHotItem, HotNewsPlatform } from '../../types/hotNews';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { openUrl } from '../../services/browserService';
import { debounce, formatHotValue } from '../../utils';
import { AlertCircle, Inbox } from 'lucide-react';
import './HotNewsPage.css';

const HotNewsPage: React.FC = () => {
  const [hotNewsData, setHotNewsData] = useState<Record<string, UnifiedHotItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<HotNewsPlatform>('douyin');
  const controllerRef = useRef<AbortController | null>(null);

  const tabs = [
    { label: '抖音', value: 'douyin' as HotNewsPlatform, icon: './hot/抖音.png' },
    { label: '夸克', value: 'quark' as HotNewsPlatform, icon: './hot/夸克.png' },
    { label: '百度', value: 'baidu' as HotNewsPlatform, icon: './hot/百度.png' },
    { label: '头条', value: 'toutiao' as HotNewsPlatform, icon: './hot/头条.png' },
    { label: '知乎', value: 'zhihu' as HotNewsPlatform, icon: './hot/知乎.png' },
    { label: '小红书', value: 'rednote' as HotNewsPlatform, icon: './hot/小红书.png' },
    { label: '哔哩哔哩', value: 'bilibili' as HotNewsPlatform, icon: './hot/哔哩哔哩.png' },
    { label: '微博', value: 'weibo' as HotNewsPlatform, icon: './hot/微博.png' },
    { label: '懂车帝', value: 'dongchedi' as HotNewsPlatform, icon: './hot/懂车帝.png' },
    { label: '猫眼电影', value: 'maoyan' as HotNewsPlatform, icon: './hot/猫眼电影.png' }
  ];

  const currentHotNews = hotNewsData[activeTab] || [];

  const openLink = (url: string): void => {
    openUrl(url);
  };

  // 获取热点数据
  const fetchHotNews = useCallback(async () => {
    setLoading(true);
    setError('');
    
    // 取消之前的请求
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    
    controllerRef.current = new AbortController();
    
    try {
      const data = await hotNewsApi.getAllHotNews({
        signal: controllerRef.current.signal
      });
      
      if (data) {
        setHotNewsData(data);
      } else {
        setError('获取热点数据失败，请稍后重试');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('网络错误，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // 刷新热点数据 - 使用防抖优化，避免频繁点击
  const refreshHotNews = useCallback(debounce(async () => {
    // 取消之前的请求
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    
    controllerRef.current = new AbortController();
    
    setLoading(true);
    setError('');
    
    try {
      const data = await hotNewsApi.refreshAllHotNews();
      if (data) {
        setHotNewsData(data);
      } else {
        setError('刷新热点数据失败，请稍后重试');
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('刷新失败，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
    }
  }, 500), []);

  // 组件挂载时获取数据
  useEffect(() => {
    fetchHotNews();

    // 组件卸载时取消请求
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
      }
    };
  }, [fetchHotNews]);

  return (
    <div className="hot-news-content p-6">
      {/* SVG 定义 */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="squircleClip" clipPathUnits="objectBoundingBox">
            <path d="M 0,0.5 C 0,0 0,0 0.5,0 S 1,0 1,0.5 1,1 0.5,1 0,1 0,0.5"></path>
          </clipPath>
        </defs>
      </svg>
      
      {/* 控制栏：分类切换标签 + 刷新按钮 */}
      {!loading && !error && (
          <div className="relative flex items-end justify-between p-2">
            <div className="flex items-end gap-x-2">
              {tabs.map((tab) => (
                <div key={tab.value} className="relative">
                  <div
                    style={{ clipPath: 'url(#squircleClip)' }}
                    className={`w-12 h-12 bg-gradient-to-br ${activeTab === tab.value ? 'from-gray-700 to-gray-900 border-gray-600/50 dark:from-gray-200 dark:to-gray-300 dark:border-gray-400/50' : 'from-gray-200 to-gray-300 border-gray-400/50 dark:from-gray-700 dark:to-gray-900 dark:border-gray-600/50'} rounded-xl flex items-center justify-center shadow-lg border cursor-pointer transform transition-all duration-300 ease-out hover:scale-110 hover:-translate-y-2 hover:shadow-2xl`}
                    onClick={() => setActiveTab(tab.value)}
                    title={tab.label}
                  >
                    <img src={tab.icon} alt={tab.label} className="h-8 w-8" />
                  </div>
                </div>
              ))}
            </div>
            
            <div className="relative">
              <div
                style={{ clipPath: 'url(#squircleClip)' }}
                className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center shadow-lg border border-green-500/50 cursor-pointer transform transition-all duration-300 ease-out hover:scale-110 hover:-translate-y-2 hover:shadow-2xl"
                onClick={refreshHotNews}

                title="刷新热点数据"
              >
                {!loading ? (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <LoadingSpinner size="xs" />
                )}
              </div>
            </div>
          </div>
      )}
      
      {loading && (
        <div className="loading-state">
          <div className="loading-content">
            <LoadingSpinner size="lg" text="" />
          </div>
        </div>
      )}
      
      {error && (
        <div className="error-state">
          <div className="error-content">
            <AlertCircle className="error-icon" size={48} />
            <h3>加载失败</h3>
            <p>{error}</p>
            <button className="retry-btn" onClick={fetchHotNews}>重新加载</button>
          </div>
        </div>
      )}
      
      {!loading && !error && (
        <div className="hot-list-container">
          {/* 单个平台热点 */}
          <div className="hot-list">
            {currentHotNews.map((item) => (
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
                      {(item.platform === 'douyin' || item.platform === 'rednote' || item.platform === 'dongchedi' || item.platform === 'maoyan') && item.hotValue && (
                        <span className="hot-title-value">{formatHotValue(item.hotValue)}</span>
                      )}
                    </h3>
                  </div>
                  
                  {(item.desc || item.detail || item.summary) && (
                    <div className="hot-card-desc">
                      {item.desc || item.detail || item.summary}
                    </div>
                  )}
                  
                  {(item.commentCount || item.likeCount || item.shareCount || item.answerCount || item.followerCount || (item.hotValue && !['douyin', 'rednote', 'dongchedi', 'maoyan'].includes(item.platform))) && (
                    <div className="hot-card-stats">
                      {item.hotValue && !['douyin', 'rednote', 'dongchedi', 'maoyan'].includes(item.platform) && (
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
            ))}
            
            {currentHotNews.length === 0 && (
              <div className="empty-state">
                <Inbox className="empty-icon" size={48} />
                <p>暂无热点数据</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HotNewsPage;