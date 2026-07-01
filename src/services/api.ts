import { baseApi } from './baseApi';
import { localStorageService } from './localStorageService';
import type { WeatherData, ForecastData } from '../types/weather';

export interface TranslateResult {
  code: number;
  message: string;
  data?: {
    source: {
      pronounce: string;
      text: string;
      type: string;
      type_desc: string;
    };
    target: {
      pronounce: string;
      text: string;
      type: string;
      type_desc: string;
    };
  };
}

export interface ExchangeRateResult {
  code: number;
  message: string;
  data?: Record<string, unknown>;
}

const WEATHER_CACHE_TTL = 15 * 60 * 1000;

interface WeatherCache<T> {
  timestamp: number;
  data: T;
}

const getCachedWeather = <T>(city: string, type: 'weather' | 'forecast'): T | null => {
  const cacheKey = `weather_${type}_${city}`;
  const cached = localStorageService.get<WeatherCache<T>>(cacheKey, null as unknown as WeatherCache<T>);
  if (cached && Date.now() - cached.timestamp < WEATHER_CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedWeather = <T>(city: string, type: 'weather' | 'forecast', data: T): void => {
  const cacheKey = `weather_${type}_${city}`;
  localStorageService.set<WeatherCache<T>>(cacheKey, {
    timestamp: Date.now(),
    data,
  });
};

export const apiService = {
  async getExchangeRates(): Promise<ExchangeRateResult> {
    const data = await baseApi.fetch<ExchangeRateResult>('/exchange-rate');

    if (!data) {
      throw new Error('获取汇率数据失败');
    }

    if (data.code === 200) {
      return data;
    } else {
      throw new Error(data.message || '获取汇率数据失败');
    }
  },

  async translate(text: string, from: string = 'auto', to: string = 'auto'): Promise<TranslateResult> {
    const encodedText = encodeURIComponent(text);
    const data = await baseApi.fetch<TranslateResult>(`/fanyi?text=${encodedText}&from=${from}&to=${to}`);

    if (!data) {
      throw new Error('翻译请求失败');
    }

    if (data.code === 200) {
      return data;
    } else {
      throw new Error(data.message || '翻译失败');
    }
  },

  async getWeather(city: string): Promise<WeatherData> {
    const cached = getCachedWeather<WeatherData>(city, 'weather');
    if (cached) {
      return cached;
    }
    
    const encodedCity = encodeURIComponent(city);
    const data = await baseApi.fetch<WeatherData>(`/weather?query=${encodedCity}`);

    if (!data) {
      throw new Error('获取天气数据失败');
    }

    if (data.code === 200) {
      setCachedWeather(city, 'weather', data);
      return data;
    } else {
      throw new Error(data.message || '获取天气数据失败');
    }
  },

  async getWeatherForecast(city: string, days: number = 4): Promise<ForecastData> {
    const cached = getCachedWeather<ForecastData>(city, 'forecast');
    if (cached) {
      return cached;
    }
    
    const encodedCity = encodeURIComponent(city);
    const data = await baseApi.fetch<ForecastData>(`/weather/forecast?query=${encodedCity}&days=${days}`);

    if (!data) {
      throw new Error('获取天气预报失败');
    }

    if (data.code === 200) {
      setCachedWeather(city, 'forecast', data);
      return data;
    } else {
      throw new Error(data.message || '获取天气预报失败');
    }
  }
};