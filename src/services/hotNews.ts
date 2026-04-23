import { cacheService } from './cacheService';
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
  TodayInHistoryResponse
} from '../types/hotNews';

// 接口基础URL
const BASE_URL = 'https://60s.crystelf.top/v2';

// 平台名称映射
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

// 通用请求方法
const fetchData = async <T>(url: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<T | null> => {
  try {
    const cacheKey = `hot_news_${url.replace(BASE_URL, '').replace(/\//g, '_')}`;
    
    // 检查缓存
    if (!options?.forceRefresh) {
      const cachedData = cacheService.get<T>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }
    
    // 发送请求
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'GET',
      signal: options?.signal,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as T;
    
    // 设置缓存，缓存时间30分钟
    cacheService.set(cacheKey, data, 30 * 60 * 1000, 'hotNews');
    
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // 请求已中止，无需处理
    }
    return null;
  }
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
const formatHotNews = (data: any[], platform: HotNewsPlatform): UnifiedHotItem[] => {
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
      case 'douyin':
        const douyinItem = item as DouyinHotItem;
        return {
          ...baseItem,
          title: douyinItem.title,
          link: douyinItem.link,
          hotValue: douyinItem.hot_value,
          cover: douyinItem.cover,
          activeTimeAt: douyinItem.active_time_at,
          eventTimeAt: douyinItem.event_time_at
        };
      
      case 'rednote':
        const rednoteItem = item as RednoteHotItem;
        return {
          ...baseItem,
          title: rednoteItem.title,
          link: rednoteItem.link,
          hotValue: rednoteItem.score,
          rank: rednoteItem.rank,
          wordType: rednoteItem.word_type,
          workTypeIcon: rednoteItem.work_type_icon
        };
      
      case 'bilibili':
        const bilibiliItem = item as BilibiliHotItem;
        return {
          ...baseItem,
          title: bilibiliItem.title,
          link: bilibiliItem.link,
          hotValue: bilibiliItem.score,
          rank: bilibiliItem.rank,
          wordType: bilibiliItem.word_type,
          workTypeIcon: bilibiliItem.work_type_icon
        };
      
      case 'quark':
        const quarkItem = item as QuarkHotItem;
        return {
          ...baseItem,
          title: quarkItem.title,
          link: quarkItem.link,
          hotValue: Math.max(quarkItem.comment_count, quarkItem.like_count, quarkItem.share_count),
          cover: quarkItem.cover,
          source: quarkItem.source,
          publishedAt: quarkItem.published_at,
          desc: quarkItem.summary,
          content: quarkItem.content,
          category: quarkItem.category?.[0],
          commentCount: quarkItem.comment_count,
          likeCount: quarkItem.like_count,
          shareCount: quarkItem.share_count,
          tags: quarkItem.tags,
          images: quarkItem.images
        };
      
      case 'weibo':
        const weiboItem = item as WeiboHotItem;
        return {
          ...baseItem,
          title: weiboItem.title,
          link: weiboItem.link,
          hotValue: weiboItem.hot_value
        };
      
      case 'baidu':
        const baiduItem = item as BaiduHotItem;
        return {
          ...baseItem,
          title: baiduItem.title,
          link: baiduItem.url,
          hotValue: baiduItem.score_desc,
          cover: baiduItem.cover,
          rank: baiduItem.rank,
          desc: baiduItem.desc,
          scoreDesc: baiduItem.score_desc,
          typeDesc: baiduItem.type_desc || undefined,
          typeIcon: baiduItem.type_icon || undefined
        };
      
      case 'toutiao':
        const toutiaoItem = item as ToutiaoHotItem;
        return {
          ...baseItem,
          title: toutiaoItem.title,
          link: toutiaoItem.link,
          hotValue: toutiaoItem.hot_value,
          cover: toutiaoItem.cover
        };
      
      case 'zhihu':
        const zhihuItem = item as ZhihuHotItem;
        return {
          ...baseItem,
          title: zhihuItem.title,
          link: zhihuItem.link,
          hotValue: zhihuItem.hot_value_desc,
          cover: zhihuItem.cover,
          createdAt: zhihuItem.created_at,
          publishedAt: zhihuItem.created_at, // 复用created_at作为publishedAt
          detail: zhihuItem.detail,
          answerCount: zhihuItem.answer_cnt,
          commentCount: zhihuItem.comment_cnt,
          followerCount: zhihuItem.follower_cnt
        };
      
      case 'dongchedi':
        const dongchediItem = item as DongchediHotItem;
        return {
          ...baseItem,
          title: dongchediItem.title,
          link: dongchediItem.url,
          hotValue: dongchediItem.score_desc,
          rank: dongchediItem.rank,
          scoreDesc: dongchediItem.score_desc
        };
      
      case 'maoyan':
        // 猫眼电影数据结构特殊，这里处理单个电影项
        const movieItem = item as any;
        return {
          ...baseItem,
          title: movieItem.movie_name || movieItem.title,
          link: `https://maoyan.com/films/${movieItem.movie_id}`,
          hotValue: movieItem.box_office_desc || movieItem.score || 0,
          rank: index + 1,
          avgSeatView: movieItem.avg_seat_view,
          avgShowView: movieItem.avg_show_view,
          releaseInfo: movieItem.release_info,
          boxOfficeDesc: movieItem.box_office_desc,
          sumBoxDesc: movieItem.sum_box_desc,
          splitBoxDesc: movieItem.split_box_desc
        };
      
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
  }
};