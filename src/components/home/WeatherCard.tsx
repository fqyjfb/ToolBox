import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Droplets, Gauge, Sun, Cloud, CloudSun, CloudRain, CloudSnow, Wind } from 'lucide-react';
import { apiService } from '../../services/api';
import type { WeatherInfo, DailyForecast } from '../../types/weather';
import LoadingSpinner from '../LoadingSpinner';

const getWeatherIcon = (condition: string, size: 'sm' | 'md' | 'lg' = 'md', color?: string) => {
  const lowerCondition = condition.toLowerCase();
  const sizeClasses = { sm: 'w-5 h-5', md: 'w-8 h-8', lg: 'w-12 h-12' };
  const defaultColors = {
    sunny: color || 'text-yellow-500',
    cloudy: color || 'text-yellow-500',
    rainy: color || 'text-blue-500',
    snowy: color || 'text-blue-300',
    default: color || 'text-gray-500',
  };

  if (lowerCondition.includes('晴')) return <Sun className={`${sizeClasses[size]} ${defaultColors.sunny}`} />;
  if (lowerCondition.includes('多云')) return <CloudSun className={`${sizeClasses[size]} ${defaultColors.cloudy}`} />;
  if (lowerCondition.includes('雨')) return <CloudRain className={`${sizeClasses[size]} ${defaultColors.rainy}`} />;
  if (lowerCondition.includes('雪')) return <CloudSnow className={`${sizeClasses[size]} ${defaultColors.snowy}`} />;
  return <Cloud className={`${sizeClasses[size]} ${defaultColors.default}`} />;
};

const WeatherCard: React.FC = () => {
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showDetail, setShowDetail] = useState(false);

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

      const forecastData = await apiService.getWeatherForecast(city, 4);
      if (forecastData?.data?.daily_forecast) {
        setForecast(forecastData.data.daily_forecast.slice(1));
      }
    } catch (err) {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, [city]);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return '明天';
    if (date.toDateString() === tomorrow.toDateString()) return '后天';

    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
  };

  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}月${day}日`;
  };

  if (error) {
    return (
      <div className="w-full h-full rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex flex-col items-center justify-center text-white gap-2 shadow-md">
        <p className="text-xs opacity-80">{error}</p>
        <button
          onClick={fetchWeather}
          className="flex items-center gap-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-full text-xs transition-colors"
        >
          <RefreshCw size={12} />
          重试
        </button>
      </div>
    );
  }

  if (loading && !weatherData) {
    return (
      <div className="w-full h-full rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center shadow-md">
        <LoadingSpinner />
      </div>
    );
  }

  const colors = weatherData?.weather?.weather_colors || ['#6366f1', '#8b5cf6'];
  const bgStyle = {
    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
  };

  return (
    <div className="relative w-full h-full">
      {/* 主天气卡片 */}
      <div
        className="w-full h-full rounded-lg overflow-hidden shadow-md cursor-pointer transition-all duration-300 hover:shadow-lg"
        style={bgStyle}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
      >
        <div className="h-full flex flex-col items-center justify-center gap-2 p-3">
          <div className="text-center">
            <h2 className="text-sm font-semibold text-white">
              {weatherData?.location?.city || city}
            </h2>
            <p className="text-xs text-white/70">{formatDate(currentTime)}</p>
          </div>
          
          {getWeatherIcon(weatherData?.weather?.condition || '', 'lg', 'text-white')}
          
          <div className="text-2xl font-semibold text-white">
            {weatherData?.weather?.temperature || '--'}°
          </div>
          <p className="text-xs text-white/70">
            {weatherData?.weather?.condition || '未知'}
          </p>
        </div>
      </div>

      {/* 悬浮详细信息 */}
      {showDetail && (
        <div className="absolute top-0 left-full ml-2 z-[100]">
          <div className="w-52 rounded-lg overflow-hidden shadow-xl transition-all duration-300">
            <div className="bg-gradient-to-br from-sky-500 to-indigo-500 text-white">
              <div className="p-2.5">
                {/* 核心天气指标 */}
                <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/10 p-1.5 backdrop-blur-sm mb-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <Droplets size={12} className="text-white/80" />
                    <span className="text-[9px] opacity-80">湿度</span>
                    <span className="text-xs font-semibold">
                      {weatherData?.weather?.humidity ?? '--'}%
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Wind size={12} className="text-white/80" />
                    <span className="text-[9px] opacity-80">风向</span>
                    <span className="text-xs font-semibold">
                      {weatherData?.weather?.wind_direction ?? '--'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Gauge size={12} className="text-white/80" />
                    <span className="text-[9px] opacity-80">气压</span>
                    <span className="text-xs font-semibold">
                      {weatherData?.weather?.pressure ?? '--'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Cloud size={12} className="text-white/80" />
                    <span className="text-[9px] opacity-80">降水</span>
                    <span className="text-xs font-semibold">
                      {weatherData?.weather?.precipitation ?? '--'}mm
                    </span>
                  </div>
                </div>

                {/* 空气质量 */}
                {weatherData?.air_quality && (
                  <div className="flex items-center justify-between rounded-lg bg-white/10 px-1.5 py-1 mb-1.5">
                    <div className="flex items-center gap-1">
                      <Sun size={12} className="text-white/80" />
                      <span className="text-[9px]">空气质量</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-semibold">
                        {weatherData.air_quality.quality}
                      </span>
                      <span className="text-[9px] opacity-80">
                        AQI {weatherData.air_quality.aqi}
                      </span>
                    </div>
                  </div>
                )}

                {/* 日出日落 */}
                {weatherData?.sunrise && (
                  <div className="flex items-center justify-between rounded-lg bg-white/10 px-1.5 py-1 mb-1.5">
                    <div className="flex items-center gap-1">
                      <Sun size={12} className="text-yellow-300" />
                      <span className="text-[9px]">日出</span>
                      <span className="text-[10px] font-semibold">
                        {weatherData.sunrise.sunrise_desc}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px]">日落</span>
                      <span className="text-[10px] font-semibold">
                        {weatherData.sunrise.sunset_desc}
                      </span>
                    </div>
                  </div>
                )}

                {/* 未来预报 */}
                {forecast.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-[9px] font-medium text-white/80">未来2天</h4>
                    <div className="space-y-1">
                      {forecast.slice(0, 2).map((day, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg bg-white/10 px-1.5 py-1"
                        >
                          <span className="text-[10px] font-medium">{getDayName(day.date)}</span>
                          <div className="flex items-center gap-2">
                            {getWeatherIcon(day.day_condition || '', 'sm', 'text-white')}
                            <div className="flex gap-1.5">
                              <span className="text-[10px] font-semibold">{day.min_temperature}°</span>
                              <span className="text-[10px] text-white/80">{day.max_temperature}°</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherCard;
