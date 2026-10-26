import { apiService } from './api'
import { queryKeys } from '../queries/keys'
import type { WeatherInfo, DailyForecast } from '../types/weather'

// 首页天气卡与顶栏天气入口共用同一份缓存：
// 两者各自实例化 useWeather，若各自维护 state 会按实例数重复发起
// getWeather / getWeatherForecast（原先共 4 次网络请求）。
// 改为 React Query 后按 city 去重，同一城市只请求一次。
const STALE_TIME = 5 * 60 * 1000
const GC_TIME = 10 * 60 * 1000

export const weatherQuery = (city: string) => ({
  queryKey: queryKeys.weather.current(city),
  queryFn: async (): Promise<WeatherInfo | null> => {
    const data = await apiService.getWeather(city)
    return data?.data ?? null
  },
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
})

export const weatherForecastQuery = (city: string) => ({
  queryKey: queryKeys.weather.forecast(city),
  queryFn: async (): Promise<DailyForecast[]> => {
    const data = await apiService.getWeatherForecast(city, 4)
    return data?.data?.daily_forecast?.slice(1) ?? []
  },
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
})
