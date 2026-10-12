import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { isWeb } from '../utils/environment';
import { getWeatherCity } from '../utils/weatherLocation';
import type { WeatherInfo, DailyForecast } from '../types/weather';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';

/**
 * 天气数据获取：首页天气卡片与头部天气入口共用。
 * 负责城市初始化（Web 端自动定位）、实时天气 / 预报拉取，以及每分钟刷新当前时间。
 */
export const useWeather = () => {
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isInitialized, setIsInitialized] = useState(false);
  const [city, setCity] = useState(localStorageService.getString(STORAGE_KEYS.WEATHER_CITY) || '无锡');

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiService.getWeather(city);
      if (data?.data) {
        setWeatherData(data.data);
      } else {
        setError('获取天气失败');
      }

      const forecastData = await apiService.getWeatherForecast(city, 4);
      if (forecastData?.data?.daily_forecast) {
        setForecast(forecastData.data.daily_forecast.slice(1));
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    const initializeCity = async () => {
      let detectedCity = localStorageService.getString(STORAGE_KEYS.WEATHER_CITY);

      if (!detectedCity && isWeb()) {
        try {
          detectedCity = await getWeatherCity();
        } catch {
          detectedCity = '';
        }
      }

      if (detectedCity) {
        setCity(detectedCity);
      }

      setIsInitialized(true);
    };

    initializeCity();
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      const timer = setTimeout(() => fetchWeather(), 0);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, fetchWeather]);

  return { weatherData, forecast, loading, error, currentTime, city, fetchWeather };
};
