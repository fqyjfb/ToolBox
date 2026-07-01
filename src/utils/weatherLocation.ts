import { localStorageService, STORAGE_KEYS } from '../services/localStorageService';

const IP_API_URL = 'http://demo.ip-api.com/json/?lang=zh-CN';

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