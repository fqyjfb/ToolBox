import { cacheService } from './cacheService';
import { baseApi } from './baseApi';
import type {
  HotNewsResponse,
  DouyinHotItem,
  RednoteHotItem,
  BilibiliHotItem,
  QuarkHotItem,
  WeiboHotItem,
  BaiduHotItem,
  ToutiaoHotItem,
  ZhihuHotItem,
  DongchediHotItem,
  MaoyanMovieResponse,
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
  bilibili: '哔哩哔哩',
  quark: '夸克',
  weibo: '微博',
  baidu: '百度',
  toutiao: '头条',
  zhihu: '知乎',
  dongchedi: '懂车帝',
  maoyan: '猫眼电影'
};

const fetchData = async <T>(url: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<T | null> => {
  const cacheKey = `hot_news_${url.replace(/\//g, '_')}`;
  
  if (!options?.forceRefresh) {
    const cachedData = cacheService.get<T>(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }
  
  const data = await baseApi.fetch<T>(url, options);
  
  if (data) {
    cacheService.set(cacheKey, data, 30 * 60 * 1000, 'hotNews');
  }
  
  return data;
};

// 抖音热点
const getDouyinHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<DouyinHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<DouyinHotItem>>('/douyin', options);
  return data?.data || null;
};

// 小红书热点
const getRednoteHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<RednoteHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<RednoteHotItem>>('/rednote', options);
  return data?.data || null;
};

// 哔哩哔哩热点
const getBilibiliHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<BilibiliHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<BilibiliHotItem>>('/bili', options);
  return data?.data || null;
};

// 夸克热点
const getQuarkHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<QuarkHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<QuarkHotItem>>('/quark', options);
  return data?.data || null;
};

// 微博热点
const getWeiboHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<WeiboHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<WeiboHotItem>>('/weibo', options);
  return data?.data || null;
};

// 百度实时热搜
const getBaiduHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<BaiduHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<BaiduHotItem>>('/baidu/hot', options);
  return data?.data || null;
};

// 头条热搜榜
const getToutiaoHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<ToutiaoHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<ToutiaoHotItem>>('/toutiao', options);
  return data?.data || null;
};

// 知乎话题榜
const getZhihuHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<ZhihuHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<ZhihuHotItem>>('/zhihu', options);
  return data?.data || null;
};

// 懂车帝热搜
const getDongchediHotNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<DongchediHotItem[] | null> => {
  const data = await fetchData<HotNewsResponse<DongchediHotItem>>('/dongchedi', options);
  return data?.data || null;
};

// 猫眼电影实时票房
const getMaoyanMovieNews = async (options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<MaoyanMovieResponse | null> => {
  const data = await fetchData<HotNewsResponse<MaoyanMovieResponse>>('/maoyan/realtime/movie', options);
  return data?.data[0] || null;
};

// 数据格式化：将各个平台的数据转换为统一格式
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
          cover: itemData.cover,
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
          workTypeIcon: itemData.work_type_icon
        };
      }
      
      case 'bilibili': {
        const itemData = item as unknown as BilibiliHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.score,
          rank: itemData.rank,
          wordType: itemData.word_type,
          workTypeIcon: itemData.work_type_icon
        };
      }
      
      case 'quark': {
        const itemData = item as unknown as QuarkHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: Math.max(itemData.comment_count, itemData.like_count, itemData.share_count),
          cover: itemData.cover,
          source: itemData.source,
          publishedAt: itemData.published_at,
          desc: itemData.summary,
          content: itemData.content,
          category: itemData.category?.[0],
          commentCount: itemData.comment_count,
          likeCount: itemData.like_count,
          shareCount: itemData.share_count,
          tags: itemData.tags,
          images: itemData.images
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
          cover: itemData.cover,
          rank: itemData.rank,
          desc: itemData.desc,
          scoreDesc: itemData.score_desc,
          typeDesc: itemData.type_desc || undefined,
          typeIcon: itemData.type_icon || undefined
        };
      }
      
      case 'toutiao': {
        const itemData = item as unknown as ToutiaoHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.hot_value,
          cover: itemData.cover
        };
      }
      
      case 'zhihu': {
        const itemData = item as unknown as ZhihuHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.link,
          hotValue: itemData.hot_value_desc,
          cover: itemData.cover,
          createdAt: itemData.created_at,
          publishedAt: itemData.created_at,
          detail: itemData.detail,
          answerCount: itemData.answer_cnt,
          commentCount: itemData.comment_cnt,
          followerCount: itemData.follower_cnt
        };
      }
      
      case 'dongchedi': {
        const itemData = item as unknown as DongchediHotItem;
        return {
          ...baseItem,
          title: itemData.title,
          link: itemData.url,
          hotValue: itemData.score_desc,
          rank: itemData.rank,
          scoreDesc: itemData.score_desc
        };
      }
      
      case 'maoyan': {
        const maoyanItem = item as unknown as { movie_name?: string; title?: string; movie_id?: string; box_office_desc?: string; score?: number; avg_seat_view?: string; avg_show_view?: string; release_info?: string; sum_box_desc?: string; split_box_desc?: string };
        const boxOfficeDesc = maoyanItem.box_office_desc;
        return {
          ...baseItem,
          title: maoyanItem.movie_name || maoyanItem.title || '',
          link: `https://maoyan.com/films/${maoyanItem.movie_id}`,
          hotValue: boxOfficeDesc ? parseInt(boxOfficeDesc.replace(/[^0-9]/g, '')) || 0 : maoyanItem.score || 0,
          rank: index + 1,
          avgSeatView: maoyanItem.avg_seat_view,
          avgShowView: maoyanItem.avg_show_view,
          releaseInfo: maoyanItem.release_info,
          boxOfficeDesc: maoyanItem.box_office_desc,
          sumBoxDesc: maoyanItem.sum_box_desc,
          splitBoxDesc: maoyanItem.split_box_desc
        };
      }
      
      default:
        return baseItem;
    }
  });
};

// 获取所有热点新闻
export const hotNewsApi = {
  // 获取单个平台热点
  async getPlatformHotNews(platform: HotNewsPlatform, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<UnifiedHotItem[] | null> {
    let data = null;
    
    switch (platform) {
      case 'douyin':
        data = await getDouyinHotNews(options);
        break;
      case 'rednote':
        data = await getRednoteHotNews(options);
        break;
      case 'bilibili':
        data = await getBilibiliHotNews(options);
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
      case 'dongchedi':
        data = await getDongchediHotNews(options);
        break;
      case 'maoyan':
        const maoyanData = await getMaoyanMovieNews(options);
        data = maoyanData?.list || [];
        break;
    }
    
    if (data) {
      return formatHotNews(data, platform);
    }
    
    return null;
  },
  
  // 获取所有平台热点
  async getAllHotNews(options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<Record<HotNewsPlatform, UnifiedHotItem[]>> {
    const platforms: HotNewsPlatform[] = ['douyin', 'rednote', 'bilibili', 'quark', 'weibo', 'baidu', 'toutiao', 'zhihu', 'dongchedi', 'maoyan'];
    
    const results: Record<HotNewsPlatform, UnifiedHotItem[]> = {} as Record<HotNewsPlatform, UnifiedHotItem[]>;
    
    // 并行请求所有平台数据
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
  
  // 刷新所有热点数据
  async refreshAllHotNews(): Promise<Record<HotNewsPlatform, UnifiedHotItem[]>> {
    return this.getAllHotNews({ forceRefresh: true });
  },
  
  // 获取平台名称
  getPlatformName(platform: HotNewsPlatform): string {
    return PLATFORM_NAMES[platform];
  },
  
  // 获取每天60秒读懂世界数据
  async getSixtySecondsData(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<SixtySecondsResponse>('/60s', options);
  },
  
  // 获取历史上的今天数据
  async getTodayInHistory(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<TodayInHistoryResponse>('/today-in-history', options);
  },
  
  // 获取实时IT资讯
  async getItNews(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<ItNewsResponse>('/it-news', options);
  },
  
  // 获取AI资讯快报
  async getAiNews(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<AiNewsResponse>('/ai-news', options);
  },

  // 获取摸鱼日报
  async getMoyuData(options?: { signal?: AbortSignal; forceRefresh?: boolean }) {
    return await fetchData<MoyuResponse>('/moyu', options);
  }
};