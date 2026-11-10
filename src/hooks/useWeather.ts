import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isWeb } from '../utils/environment';
import { getWeatherCity } from '../utils/weatherLocation';
import localStorageService, { STORAGE_KEYS } from '../services/localStorageService';
import { weatherQuery, weatherForecastQuery } from '../services/weatherQueries';

/**
 * 天气数据获取：首页天气卡片与头部天气入口共用。
 * 负责城市初始化（Web 端自动定位）、实时天气 / 预报拉取，以及每分钟刷新当前时间。
 *
 * 实时天气与预报改走 React Query 缓存（见 services/weatherQueries.ts）：
 * 两个入口按 city 命中同一份缓存，避免同一城市重复发起两轮网络请求。
 * 对外返回值与原先保持一致（含手动刷新入口 fetchWeather）。
 */
export const useWeather = () => {
  const queryClient = useQueryClient();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isInitialized, setIsInitialized] = useState(false);
  const [city, setCity] = useState(localStorageService.getString(STORAGE_KEYS.WEATHER_CITY) || '无锡');

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

  // 城市确定后才发起：避免先用默认城市请求一次、定位完成后再请求一次
  const currentWeather = useQuery({ ...weatherQuery(city), enabled: isInitialized });
  const forecastResult = useQuery({ ...weatherForecastQuery(city), enabled: isInitialized });

  const fetchWeather = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: weatherQuery(city).queryKey }),
      queryClient.refetchQueries({ queryKey: weatherForecastQuery(city).queryKey }),
    ]);
  }, [queryClient, city]);

  const weatherData = currentWeather.data ?? null;
  const forecast = forecastResult.data ?? [];

  // 天气快照推给主进程：悬浮球「今日天气/启动卡」的内容源（ai.json 同款快照惯例，主进程不重复发请求）。
  // 预格式化成一行文案，主进程只做过期判断与展示；Web 端 window.electron 不存在，自动跳过；推送失败静默。
  useEffect(() => {
    if (!weatherData || !window.electron?.floatDailySnapshot) return;
    try {
      const { location, weather } = weatherData;
      window.electron.floatDailySnapshot({
        weather: { summary: `${location.name} ${weather.temperature}°C ${weather.condition}`, updatedAt: Date.now() },
      });
    } catch { /* 快照仅是缓存，推送失败静默 */ }
  }, [weatherData]);
  // isFetching 对应原实现「请求进行中」的语义（手动刷新时同样为 true）
  const loading = currentWeather.isFetching || forecastResult.isFetching;
  const error =
    currentWeather.isError || forecastResult.isError
      ? '网络错误'
      : currentWeather.isSuccess && !currentWeather.data
        ? '获取天气失败'
        : '';

  return { weatherData, forecast, loading, error, currentTime, city, fetchWeather };
};
