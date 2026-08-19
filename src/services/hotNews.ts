import { cacheService } from './cacheService';
import { baseApi } from './baseApi';
import { logError } from './loggerService';
import type {
  HotNewsResponse,
  DouyinHotItem,
  RednoteHotItem,
  QuarkHotItem,
  WeiboHotItem,
  BaiduHotItem,
  ToutiaoHotItem,
  ZhihuHotItem,
  UnifiedHotItem,
  HotNewsPlatform,
  SixtySecondsResponse,
  TodayInHistoryResponse,
  ItNewsResponse,
  AiNewsResponse,
  MoyuResponse
} from '../types/hotNews';

const PLATFORM_NAMES: Record<HotNewsPlatform, string> = {
  douyin: '抖音',
  rednote: '小红书',
  quark: '夸克',
  weibo: '微博',
  baidu: '百度',
  toutiao: '头条',
  zhihu: '知乎'
};

// 将 HTTP 图片 URL 升级为 HTTPS，避免 HTTPS 页面 Mixed Content 错误
const toHttps = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  return url.replace(/^http:\/\//i, 'https://');
};

const fetchData = async <T>(url: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<T | null> => {
  const cacheKey = `hot_news_${url.replace(/\//g, '_')}`;
  
  if (!options?.forceRefresh) {
    const cachedData = cacheService.get<T>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }
  
  try {
    const data = await baseApi.fetch<T>(url, options);
    
    if (data) {
      cacheService.set(cacheKey, data, 30 * 60 * 1000, 'hotNews');
    }
    
    return data;
  } catch (error) {
    logError(`获取热点数据失败: ${url}`, 'hotNews', error as Error);
    return null;
  }
};

const getDouyinHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<DouyinHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<DouyinHotItem>>('/douyin', options);
  return data?.data || null;
};

const getRednoteHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<RednoteHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<RednoteHotItem>>('/rednote', options);
  return data?.data || null;
};

const getQuarkHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<QuarkHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<QuarkHotItem>>('/quark', options);
  return data?.data || null;
};

const getWeiboHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<WeiboHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<WeiboHotItem>>('/weibo', options);
  return data?.data || null;
};

const getBaiduHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<BaiduHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<BaiduHotItem>>('/baidu/hot', options);
  return data?.data || null;
};

const getToutiaoHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<ToutiaoHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<ToutiaoHotItem>>('/toutiao', options);
  return data?.data || null;
};

const getZhihuHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<ZhihuHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<ZhihuHotItem>>('/zhihu', options);
  return data?.data || null;
};

const formatHotNews = (data: unknown[], platform: HotNewsPlatform): UnifiedHotItem[] => {
  const platformName = PLATFORM_NAMES[platform];
  
  return data.map((item, index) => {
    const baseItem: UnifiedHotItem = {
      id: `${platform}_${index}`,
      platform,
      platformName,
      title: '',
      link: '',
      hotValue: 0
    };
    
    switch (platform) {
      case 'douyin': {
        const itemData = item as unknown as DouyinHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.hot_value,
          cover: toHttps(itemData.cover),
          activeTimeAt: itemData.active_time_at,
          eventTimeAt: itemData.event_time_at
        };
      }
      
      case 'rednote': {
        const itemData = item as unknown as RednoteHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.score,
          rank: itemData.rank,
          wordType: itemData.word_type,
          workTypeIcon: toHttps(itemData.work_type_icon)
        };
      }
      
      case 'quark': {
        const itemData = item as unknown as QuarkHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: Math.max(itemData.comment_count, itemData.like_count, itemData.share_count),
          cover: toHttps(itemData.cover),
          source: itemData.source,
          publishedAt: itemData.published_at,
          desc: itemData.summary,
          content: itemData.content,
          category: itemData.category?.[0],
          commentCount: itemData.comment_count,
          likeCount: itemData.like_count,
          shareCount: itemData.share_count,
          tags: itemData.tags,
          images: itemData.images?.map(img => ({ ...img, url: toHttps(img.url) || '' }))
        };
      }
      
      case 'weibo': {
        const itemData = item as unknown as WeiboHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.hot_value
        };
      }
      
      case 'baidu': {
        const itemData = item as unknown as BaiduHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.url,
          hotValue: itemData.score_desc,
          cover: toHttps(itemData.cover),
          rank: itemData.rank,
          desc: itemData.desc,
          scoreDesc: itemData.score_desc,
          typeDesc: itemData.type_desc || undefined,
          typeIcon: toHttps(itemData.type_icon) || undefined
        };
      }
      
      case 'toutiao': {
        const itemData = item as unknown as ToutiaoHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.hot_value,
          cover: toHttps(itemData.cover)
        };
      }
      
      case 'zhihu': {
        const itemData = item as unknown as ZhihuHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.hot_value_desc,
          cover: toHttps(itemData.cover),
          createdAt: itemData.created_at,
          publishedAt: itemData.created_at,
          detail: itemData.detail,
          answerCount: itemData.answer_cnt,
          commentCount: itemData.comment_cnt,
          followerCount: itemData.follower_cnt
        };
      }

      default:
        return baseItem;
    }
  });
};

export const hotNewsApi = {
  async getPlatformHotNews(platform: HotNewsPlatform, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<UnifiedHotItem[] | null> {
    let data = null;
    
    switch (platform) {
      case 'douyin':
        data = await getDouyinHotNews(options);
        break;
      case 'rednote':
        data = await getRednoteHotNews(options);
        break;
      case 'quark':
        data = await getQuarkHotNews(options);
        break;
      case 'weibo':
        data = await getWeiboHotNews(options);
        break;
      case 'baidu':
        data = await getBaiduHotNews(options);
        break;
      case 'toutiao':
        data = await getToutiaoHotNews(options);
        break;
      case 'zhihu':
        data = await getZhihuHotNews(options);
        break;
    }
    
    if (data) {
      return formatHotNews(data, platform);
    }
    
    return null;
  },
  
  async getAllHotNews(options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<Record<HotNewsPlatform, UnifiedHotItem[]>> {
    const platforms: HotNewsPlatform[] = ['douyin', 'rednote', 'quark', 'weibo', 'baidu', 'toutiao', 'zhihu'];
    
    const results: Record<HotNewsPlatform, UnifiedHotItem[]> = {} as Record<HotNewsPlatform, UnifiedHotItem[]>;
    
    const promises = platforms.map(async (platform) => {
      const data = await this.getPlatformHotNews(platform, options);
      if (data) {
        results[platform] = data;
      } else {
        results[platform] = [];
      }
    });
    
    await Promise.all(promises);
    
    return results;
  },
  
  async refreshAllHotNews(): Promise<Record<HotNewsPlatform, UnifiedHotItem[]>> {
    return this.getAllHotNews({ forceRefresh: true });
  },
  
  getPlatformName(platform: HotNewsPlatform): string {
    return PLATFORM_NAMES[platform];
  },
  
  async getSixtySecondsData(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<SixtySecondsResponse>('/60s', options);
  },
  
  async getTodayInHistory(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<TodayInHistoryResponse>('/today-in-history', options);
  },
  
  async getItNews(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<ItNewsResponse>('/it-news', options);
  },
  
  async getAiNews(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<AiNewsResponse>('/ai-news', options);
  },

  async getMoyuData(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<MoyuResponse>('/moyu', options);
  }
};
