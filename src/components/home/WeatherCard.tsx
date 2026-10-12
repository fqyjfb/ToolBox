import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Cloud } from 'lucide-react';
import { useWeather } from '../../hooks/useWeather';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getWeatherIcon } from '../../utils/weatherIcon';
import WeatherDetailPopup from './WeatherDetailPopup';

const WeatherCard: React.FC = () => {
  const { weatherData, forecast, loading, error, currentTime, city, fetchWeather } = useWeather();
  const [showDetail, setShowDetail] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showDetail && cardRef.current) {
      setAnchorRect(cardRef.current.getBoundingClientRect());
    }
  }, [showDetail]);

  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}月${day}日`;
  };

  if (error) {
    return (
      <div className="w-full h-full rounded-lg bg-gray-500 flex flex-col items-center justify-center text-white gap-3 shadow-md">
        <Cloud className="w-8 h-8 text-white/60" />
        <p className="text-xs text-white/80">{error}</p>
        <button
          onClick={fetchWeather}
          className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          title="重试"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    );
  }

  if (loading && !weatherData) {
    return (
      <div className="w-full h-full rounded-lg bg-gray-400 flex items-center justify-center shadow-md">
        <LoadingSpinner />
      </div>
    );
  }

  const bgStyle = {
    backgroundColor: weatherData?.weather?.weather_colors?.[0] || '#6366f1',
  };

  return (
    <>
      <div className="relative w-full h-full" ref={cardRef}>
        <div
          className="w-full h-full rounded-lg overflow-hidden shadow-md cursor-pointer transition-all duration-300 hover:shadow-lg"
          style={bgStyle}
          onMouseEnter={() => setShowDetail(true)}
          onMouseLeave={() => setShowDetail(false)}
        >
          <div className="h-full flex items-center gap-1.5 p-1.5">
            <div className="flex flex-col items-center">
              {getWeatherIcon(weatherData?.weather?.condition || '', 'sm', 'text-white')}
              <div className="text-base font-semibold text-white">
                {weatherData?.weather?.temperature ?? '--'}°
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <h2 className="text-[10px] font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-[50px]">
                {weatherData?.location?.city || city}
              </h2>
              <p className="text-[9px] text-white/70">{formatDate(currentTime)}</p>
              <p className="text-[9px] text-white/70">
                {weatherData?.weather?.condition || '未知'}
              </p>
            </div>
          </div>
        </div>
      </div>
      {showDetail && anchorRect && (
        <WeatherDetailPopup weatherData={weatherData} forecast={forecast} anchorRect={anchorRect} />
      )}
    </>
  );
};

export default React.memo(WeatherCard);
