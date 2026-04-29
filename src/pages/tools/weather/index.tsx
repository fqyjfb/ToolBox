import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Droplets, Gauge, Sun, Cloud, CloudSun, CloudRain, CloudSnow, Wind, Clock, MapPin, AlertTriangle } from 'lucide-react';
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
    return `${month}/${day}`;
  };

  const formatHour = (datetime: string) => {
    return datetime.split(' ')[1]?.slice(0, 5) || '';
  };

  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('晴')) return <Sun className="w-4 h-4 text-yellow-500" />;
    if (lowerCondition.includes('多云')) return <CloudSun className="w-4 h-4 text-yellow-500" />;
    if (lowerCondition.includes('雨')) return <CloudRain className="w-4 h-4 text-blue-500" />;
    if (lowerCondition.includes('雪')) return <CloudSnow className="w-4 h-4 text-blue-300" />;
    if (lowerCondition.includes('阴')) return <Cloud className="w-4 h-4 text-gray-500" />;
    return <Cloud className="w-4 h-4 text-gray-500" />;
  };

  const getLargeWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('晴')) return <Sun className="w-16 h-16 text-yellow-400" />;
    if (lowerCondition.includes('多云')) return <CloudSun className="w-16 h-16 text-yellow-400" />;
    if (lowerCondition.includes('雨')) return <CloudRain className="w-16 h-16 text-blue-400" />;
    if (lowerCondition.includes('雪')) return <CloudSnow className="w-16 h-16 text-blue-200" />;
    if (lowerCondition.includes('阴')) return <Cloud className="w-16 h-16 text-gray-400" />;
    return <Cloud className="w-16 h-16 text-gray-400" />;
  };

  const getAQIColor = (level: number) => {
    switch (level) {
      case 1: return 'text-green-600 dark:text-green-400';
      case 2: return 'text-yellow-600 dark:text-yellow-400';
      case 3: return 'text-orange-600 dark:text-orange-400';
      case 4: return 'text-red-600 dark:text-red-400';
      case 5: return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getAQIBgColor = (level: number) => {
    switch (level) {
      case 1: return 'bg-green-100 dark:bg-green-900/30';
      case 2: return 'bg-yellow-100 dark:bg-yellow-900/30';
      case 3: return 'bg-orange-100 dark:bg-orange-900/30';
      case 4: return 'bg-red-100 dark:bg-red-900/30';
      case 5: return 'bg-purple-100 dark:bg-purple-900/30';
      default: return 'bg-gray-100 dark:bg-gray-700';
    }
  };

  const getAQILevelText = (level: number) => {
    switch (level) {
      case 1: return '优';
      case 2: return '良';
      case 3: return '轻度污染';
      case 4: return '中度污染';
      case 5: return '重度污染';
      default: return '未知';
    }
  };

  const getLifeIndexLevelColor = (level: string) => {
    const levelMap: Record<string, string> = {
      '炎热': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      '易发': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      '不宜': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      '较差': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      '较不舒适': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      '较不宜': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      '一般': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      '部分时间开启': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
      '良': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      '少发': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      '无': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      '不需要': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      '弱': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      '最弱': 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
      '防脱水': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    };
    return levelMap[level] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  };

  const getAlertLevelStyle = (level: string) => {
    const levelMap: Record<string, string> = {
      '蓝色': 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-700 dark:text-blue-400',
      '黄色': 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 text-yellow-700 dark:text-yellow-400',
      '橙色': 'bg-orange-50 dark:bg-orange-900/20 border-orange-500 text-orange-700 dark:text-orange-400',
      '红色': 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400',
    };
    return levelMap[level] || 'bg-gray-50 dark:bg-gray-700/50 border-gray-500 text-gray-700 dark:text-gray-400';
  };

  const getLifeIndexBadgeColor = (level: string) => {
    const levelMap: Record<string, string> = {
      '炎热': 'bg-red-500 dark:bg-red-600 text-white',
      '易发': 'bg-red-500 dark:bg-red-600 text-white',
      '不宜': 'bg-red-500 dark:bg-red-600 text-white',
      '较差': 'bg-red-500 dark:bg-red-600 text-white',
      '较不舒适': 'bg-orange-500 dark:bg-orange-600 text-white',
      '较不宜': 'bg-orange-500 dark:bg-orange-600 text-white',
      '一般': 'bg-orange-500 dark:bg-orange-600 text-white',
      '部分时间开启': 'bg-yellow-500 dark:bg-yellow-600 text-white',
      '良': 'bg-green-500 dark:bg-green-600 text-white',
      '少发': 'bg-green-500 dark:bg-green-600 text-white',
      '无': 'bg-green-500 dark:bg-green-600 text-white',
      '不需要': 'bg-green-500 dark:bg-green-600 text-white',
      '弱': 'bg-green-500 dark:bg-green-600 text-white',
      '最弱': 'bg-green-500 dark:bg-green-600 text-white',
      '防脱水': 'bg-blue-500 dark:bg-blue-600 text-white',
    };
    return levelMap[level] || 'bg-gray-500 dark:bg-gray-600 text-white';
  };

  const getLifeIndexBadgeText = (level: string) => {
    const levelMap: Record<string, string> = {
      '炎热': '热',
      '易发': '易发',
      '不宜': '不宜',
      '较差': '差',
      '较不舒适': '较不适',
      '较不宜': '较不宜',
      '一般': '一般',
      '部分时间开启': '部分',
      '良': '良',
      '少发': '少发',
      '无': '无',
      '不需要': '无需',
      '弱': '弱',
      '最弱': '最弱',
      '防脱水': '防脱水',
    };
    return levelMap[level] || level;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <Cloud className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">{error || '无法获取天气数据'}</p>
            <button
              onClick={fetchWeather}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
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
    <div className="p-4 overflow-y-auto max-h-[calc(100vh-80px)] scrollbar-hide">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 opacity-80" />
              <span className="text-sm opacity-80">{weatherData.location?.city || city}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">{weatherData.weather?.updated || '-'}</span>
              <button
                onClick={fetchWeather}
                disabled={loading}
                className="p-1 hover:bg-white/20 rounded transition-colors disabled:opacity-50"
                title="刷新天气"
              >
                {loading ? <LoadingSpinner size="xs" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-1/4">
              <div className="flex items-center gap-3">
                <div className="text-center">
                  {getLargeWeatherIcon(weatherData.weather?.condition || '')}
                  <p className="text-sm font-medium mt-1">{weatherData.weather?.condition || '未知'}</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{weatherData.weather?.temperature ?? '--'}</span>
                    <span className="text-base opacity-80">°C</span>
                    {weatherData.air_quality && (
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${getAQIBgColor(weatherData.air_quality.level)} ${getAQIColor(weatherData.air_quality.level)}`}>
                        <Gauge className="w-3 h-3" />
                        <span>{getAQILevelText(weatherData.air_quality.level)}</span>
                        <span className="opacity-70">AQI {weatherData.air_quality.aqi}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs opacity-70">
                      {weatherData.weather?.wind_direction ?? '--'} {weatherData.weather?.wind_power ?? ''}级
                    </span>
                    <span className="text-xs opacity-70">|</span>
                    <span className="text-xs opacity-70">湿度 {weatherData.weather?.humidity ?? '--'}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {weatherData.life_indices && weatherData.life_indices.length > 0 && (
              <div className="flex-1 flex flex-col justify-end">
                <h3 className="text-xs font-semibold opacity-80 mb-1">生活指数</h3>
                <div className="flex flex-wrap gap-1">
                  {weatherData.life_indices.map((index, idx) => (
                    <div
                      key={idx}
                      className={`px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap cursor-help transition-transform hover:scale-105 ${getLifeIndexLevelColor(index.level)}`}
                      title={index.description}
                    >
                      <span className="font-medium">{index.name}</span>
                      <span className={`ml-1 px-1 py-0.25 rounded-full text-[9px] font-semibold ${getLifeIndexBadgeColor(index.level)}`}>
                        {getLifeIndexBadgeText(index.level)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 dark:text-gray-400">湿度</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{weatherData.weather?.humidity ?? '--'}%</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <Wind className="w-5 h-5 text-gray-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 dark:text-gray-400">风速</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{weatherData.weather?.wind_power ?? '--'}级</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <Gauge className="w-5 h-5 text-gray-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 dark:text-gray-400">气压</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{weatherData.weather?.pressure ?? '--'}hPa</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <CloudRain className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
              <p className="text-xs text-gray-500 dark:text-gray-400">降水</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{weatherData.weather?.precipitation ?? '--'}mm</p>
            </div>
            {weatherData.sunrise && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1.5">
                  <Sun className="w-5 h-5 text-orange-500" />
                  <Clock className="w-5 h-5 text-indigo-500" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">日出/日落</p>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {weatherData.sunrise.sunrise_desc}/{weatherData.sunrise.sunset_desc}
                </p>
              </div>
            )}
          </div>
        </div>

        {hourlyForecast.length > 0 && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">24小时预报</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">每小时更新</span>
            </div>
            <div className="overflow-x-auto hourly-scroll-container scrollbar-visible">
              <div className="flex gap-1.5" style={{ width: 'fit-content' }}>
                {hourlyForecast.map((hour, index) => (
                  <div key={index} className="flex-shrink-0 w-14 flex flex-col items-center py-2 px-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">{formatHour(hour.datetime)}</span>
                    <div className="mb-1.5">{getWeatherIcon(hour.condition || '')}</div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{hour.temperature}°</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{hour.wind_direction} {hour.wind_power}级</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {dailyForecast.length > 0 && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">7天预报</h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">每日更新</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {dailyForecast.map((day, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-0.5">{getDayName(day.date)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{formatDate(day.date)}</p>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    {getWeatherIcon(day.day_condition || '')}
                    <span className="text-xs text-gray-600 dark:text-gray-300">{day.day_condition}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 mb-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{day.max_temperature}°</span>
                    <span className="text-gray-300 dark:text-gray-600">/</span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{day.min_temperature}°</span>
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {day.day_wind_direction} {day.day_wind_power}级
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {weatherData.alerts && weatherData.alerts.length > 0 && (
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">天气预警</h3>
            </div>
            {weatherData.alerts.map((alert, idx) => (
              <div key={idx} className={`p-3 rounded-lg border-l-4 ${getAlertLevelStyle(alert.level)}`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <div>
                    <span className="font-semibold text-sm">{alert.type}</span>
                    <span className="text-xs ml-2">{alert.level}预警</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{alert.detail}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{alert.updated}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherPage;