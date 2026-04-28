import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Droplets, Gauge, Sun, Cloud, CloudSun, CloudRain, CloudSnow, Wind, Clock } from 'lucide-react';
import { apiService } from '../../../services/api';
import type { WeatherInfo, DailyForecast, HourlyForecast } from '../../../types/weather';
import LoadingSpinner from '../../../components/LoadingSpinner';

const WeatherPage: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null);
  const [dailyForecast, setDailyForecast] = useState<DailyForecast[]>([]);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const city = localStorage.getItem('weatherCity') || '南京';

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

      const forecastData = await apiService.getWeatherForecast(city, 7);
      if (forecastData?.data?.daily_forecast) {
        setDailyForecast(forecastData.data.daily_forecast);
      }
      if (forecastData?.data?.hourly_forecast) {
        const hourlyData = forecastData.data.hourly_forecast.slice(0, 24);
        setHourlyForecast(hourlyData);
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) return '今天';
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return '明天';

    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}月${day}日`;
  };

  const formatHour = (datetime: string) => {
    return datetime.split(' ')[1]?.slice(0, 5) || '';
  };

  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('晴')) return <Sun className="w-5 h-5 text-yellow-500" />;
    if (lowerCondition.includes('多云')) return <CloudSun className="w-5 h-5 text-yellow-500" />;
    if (lowerCondition.includes('雨')) return <CloudRain className="w-5 h-5 text-blue-500" />;
    if (lowerCondition.includes('雪')) return <CloudSnow className="w-5 h-5 text-blue-300" />;
    return <Cloud className="w-5 h-5 text-gray-500" />;
  };

  const getLargeWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('晴')) return <Sun className="w-12 h-12 text-yellow-400" />;
    if (lowerCondition.includes('多云')) return <CloudSun className="w-12 h-12 text-yellow-400" />;
    if (lowerCondition.includes('雨')) return <CloudRain className="w-12 h-12 text-blue-400" />;
    if (lowerCondition.includes('雪')) return <CloudSnow className="w-12 h-12 text-blue-200" />;
    return <Cloud className="w-12 h-12 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex items-center justify-center min-h-[200px]">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <div className="flex flex-col items-center justify-center min-h-[200px] text-gray-500 dark:text-gray-400">
            <p>{error || '无法获取天气数据'}</p>
            <button
              onClick={fetchWeather}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 weather-container overflow-y-auto max-h-[calc(100vh-80px)]" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="bg-blue-600 rounded-lg p-4 mb-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm opacity-80">{weatherData.location?.city || city}</p>
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Clock className="w-3.5 h-3.5" />
              <span>{weatherData.weather?.updated || '-'}</span>
              <button
                onClick={fetchWeather}
                disabled={loading}
                className="p-1.5 hover:bg-white/20 rounded-md transition-colors disabled:opacity-50"
                title="刷新天气"
              >
                {loading ? <LoadingSpinner size="xs" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-bold">{weatherData.weather?.temperature ?? '--'}</span>
                <span className="text-lg opacity-80">°C</span>
              </div>
              <p className="text-base font-medium">{weatherData.weather?.condition || '未知'}</p>
            </div>
            <div className="flex items-center">
              {getLargeWeatherIcon(weatherData.weather?.condition || '')}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <Droplets className="w-5 h-5 text-blue-500 mb-1.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">湿度</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{weatherData.weather?.humidity ?? '--'}%</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <Wind className="w-5 h-5 text-gray-500 mb-1.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">风向风力</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{weatherData.weather?.wind_direction ?? '--'}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <Gauge className="w-5 h-5 text-gray-500 mb-1.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">气压</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{weatherData.weather?.pressure ?? '--'} hPa</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <Cloud className="w-5 h-5 text-blue-500 mb-1.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">降水</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{weatherData.weather?.precipitation ?? '--'}mm</p>
          </div>
        </div>

        {weatherData.air_quality && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">空气质量</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{weatherData.air_quality.quality}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{weatherData.air_quality.aqi}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">AQI指数</p>
              </div>
            </div>
          </div>
        )}

        {weatherData.sunrise && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-around">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">日出</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{weatherData.sunrise.sunrise_desc}</p>
                </div>
              </div>
              <div className="w-px h-10 bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">日落</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{weatherData.sunrise.sunset_desc}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {hourlyForecast.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4 border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">24小时预报</h3>
            <div className="overflow-x-auto max-w-full hourly-forecast-container">
              <div className="flex gap-1.5 flex-nowrap" style={{ width: 'fit-content' }}>
                {hourlyForecast.map((hour, index) => (
                  <div key={index} className="flex-shrink-0 w-12 bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{formatHour(hour.datetime)}</p>
                    <div className="mb-1">{getWeatherIcon(hour.condition || '')}</div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{hour.temperature}°</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {dailyForecast.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">7天预报</h3>
            <div className="space-y-1.5">
              {dailyForecast.map((day, index) => (
                <div key={index} className="flex items-center justify-between py-2 bg-white dark:bg-gray-800 rounded-md px-3 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <div className="w-14">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{getDayName(day.date)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(day.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getWeatherIcon(day.day_condition || '')}
                      <p className="text-xs text-gray-600 dark:text-gray-300">{day.day_condition}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{day.max_temperature}°</span>
                    <span className="text-gray-300 dark:text-gray-600">/</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{day.min_temperature}°</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherPage;