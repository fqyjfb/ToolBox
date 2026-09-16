import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';
import { isElectron } from './environment';

// ip-api 免费版仅支持 HTTP：桌面端 file:// 源无 Mixed Content 限制，直接请求；
// web 端为 HTTPS 页面，需经同源代理 /api/ip 转发以避免 Mixed Content 拦截
export const IP_API_URL = isElectron()
  ? 'http://demo.ip-api.com/json/?lang=zh-CN'
  : '/api/ip/json/?lang=zh-CN';

export interface IpLocationResponse {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}

export const getCurrentCity = async (): Promise<string> => {
  try {
    const response = await fetch(IP_API_URL);
    const data: IpLocationResponse = await response.json();
    
    if (data.status === 'success' && data.city && data.countryCode === 'CN') {
      return data.city;
    }
  } catch {
    // 忽略网络错误，返回默认城市
  }
  
  return '南京';
};

export const getWeatherCity = async (): Promise<string> => {
  const savedCity = localStorageService.getString(STORAGE_KEYS.WEATHER_CITY);
  
  if (savedCity) {
    return savedCity;
  }
  
  return await getCurrentCity();
};