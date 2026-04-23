// 热点新闻基础响应类型
export interface HotNewsResponse<T> {
  code: number;
  data: T[];
  message: string;
}

// 抖音热点数据类型
export interface DouyinHotItem {
  active_time: string;
  active_time_at: number;
  cover: string;
  event_time: string;
  event_time_at: number;
  hot_value: number;
  link: string;
  title: string;
}

// 小红书热点数据类型
export interface RednoteHotItem {
  link: string;
  rank: number;
  score: string;
  title: string;
  word_type: string;
  work_type_icon: string;
}

// 哔哩哔哩热点数据类型
export interface BilibiliHotItem {
  link: string;
  rank: number;
  score: string;
  title: string;
  word_type: string;
  work_type_icon: string;
}

// 夸克热点数据类型
export interface QuarkHotItem {
  category: string[];
  comment_count: number;
  content: string;
  cover: string;
  id: string;
  images: {
    description?: string;
    height: number;
    type: string;
    url: string;
    width: number;
  }[];
  like_count: number;
  link: string;
  published: string;
  published_at: number;
  share_count: number;
  source: string;
  summary: string;
  tags: string[];
  title: string;
}

// 微博热点数据类型
export interface WeiboHotItem {
  hot_value: number;
  link: string;
  title: string;
}

// 百度实时热搜数据类型
export interface BaiduHotItem {
  cover: string;
  desc: string;
  rank: number;
  score: string;
  score_desc: string;
  title: string;
  type: string;
  type_desc: null | string;
  type_icon: null | string;
  url: string;
}

// 头条热搜榜数据类型
export interface ToutiaoHotItem {
  cover: string;
  hot_value: number;
  link: string;
  title: string;
}

// 知乎话题榜数据类型
export interface ZhihuHotItem {
  answer_cnt: number;
  comment_cnt: number;
  cover: string;
  created: string;
  created_at: number;
  detail: string;
  follower_cnt: number;
  hot_value_desc: string;
  link: string;
  title: string;
}

// 懂车帝热搜数据类型
export interface DongchediHotItem {
  rank: number;
  title: string;
  url: string;
  score: number;
  score_desc: string;
}

// 猫眼电影实时票房数据类型
export interface MaoyanMovieItem {
  avg_seat_view: string;
  avg_show_view: string;
  box_office: string;
  box_office_desc: string;
  box_office_rate: string;
  box_office_unit: string;
  movie_id: number;
  movie_name: string;
  release_info: string;
  show_count: number;
  show_count_rate: string;
  split_box_office: string;
  split_box_office_desc: string;
  split_box_office_rate: string;
  split_box_office_unit: string;
  sum_box_desc: string;
  sum_split_box_desc: string;
}

export interface MaoyanMovieResponse {
  box_office: string;
  box_office_unit: string;
  list: MaoyanMovieItem[];
  show_count_desc: string;
  split_box_office: string;
  split_box_office_unit: string;
  title: string;
  update_gap_second: number;
  updated: string;
  updated_at: number;
  view_count_desc: string;
}

// 统一热点数据类型，用于前端展示
export interface UnifiedHotItem {
  id: string;
  platform: string;
  platformName: string;
  title: string;
  link: string;
  hotValue: number | string;
  cover?: string;
  rank?: number;
  category?: string;
  source?: string;
  publishedAt?: number;
  createdAt?: number;
  
  // 描述信息字段
  desc?: string;
  detail?: string;
  summary?: string;
  content?: string;
  
  // 统计信息字段
  commentCount?: number;
  likeCount?: number;
  shareCount?: number;
  followerCount?: number;
  answerCount?: number;
  
  // 平台特有字段
  wordType?: string;
  workTypeIcon?: string;
  scoreDesc?: string;
  typeDesc?: string;
  typeIcon?: string;
  
  // 时间信息字段
  activeTimeAt?: number;
  eventTimeAt?: number;
  
  // 其他有用字段
  tags?: string[];
  images?: {
    description?: string;
    height: number;
    type: string;
    url: string;
    width: number;
  }[];
  
  // 电影特有字段
  avgSeatView?: string;
  avgShowView?: string;
  releaseInfo?: string;
  boxOfficeDesc?: string;
  sumBoxDesc?: string;
  splitBoxDesc?: string;
}

// 每天60秒读懂世界数据类型
export interface SixtySecondsAudio {
  music: string;
  news: string;
}

export interface SixtySecondsData {
  api_updated: string;
  api_updated_at: number;
  audio: SixtySecondsAudio;
  cover: string;
  created: string;
  created_at: number;
  date: string;
  day_of_week: string;
  image: string;
  link: string;
  lunar_date: string;
  news: string[];
  tip: string;
  updated: string;
  updated_at: number;
}

export interface SixtySecondsResponse {
  code: number;
  data: SixtySecondsData;
  message: string;
}

// 历史上的今天数据类型
export interface TodayInHistoryItem {
  description: string;
  event_type: string;
  link: string;
  title: string;
  year: string;
}

export interface TodayInHistoryData {
  date: string;
  day: number;
  items: TodayInHistoryItem[];
  month: number;
}

export interface TodayInHistoryResponse {
  code: number;
  data: TodayInHistoryData;
  message: string;
}

// 热点平台类型
export type HotNewsPlatform = 'douyin' | 'rednote' | 'bilibili' | 'quark' | 'weibo' | 'baidu' | 'toutiao' | 'zhihu' | 'dongchedi' | 'maoyan'