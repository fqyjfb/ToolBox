import { baseApi } from './baseApi';
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

export const apiService = {
  async getExchangeRates(): Promise<any> {
    const data = await baseApi.fetch<any>('/exchange-rate');

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
    const encodedCity = encodeURIComponent(city);
    const data = await baseApi.fetch<WeatherData>(`/weather?query=${encodedCity}`);

    if (!data) {
      throw new Error('获取天气数据失败');
    }

    if (data.code === 200) {
      return data;
    } else {
      throw new Error(data.message || '获取天气数据失败');
    }
  },

  async getWeatherForecast(city: string, days: number = 4): Promise<ForecastData> {
    const encodedCity = encodeURIComponent(city);
    const data = await baseApi.fetch<ForecastData>(`/weather/forecast?query=${encodedCity}&days=${days}`);

    if (!data) {
      throw new Error('获取天气预报失败');
    }

    if (data.code === 200) {
      return data;
    } else {
      throw new Error(data.message || '获取天气预报失败');
    }
  }
};