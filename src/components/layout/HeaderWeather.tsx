import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeather } from '../../hooks/useWeather';
import { getWeatherIcon } from '../../utils/weatherIcon';
import WeatherDetailPopup from '../home/WeatherDetailPopup';

// 头部天气入口：显示 天气图标 + 天气 + 温度，悬浮展示详情卡片，点击进入天气页面
const HeaderWeather: React.FC = () => {
  const navigate = useNavigate();
  const { weatherData, forecast } = useWeather();
  const [showDetail, setShowDetail] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showDetail && buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }
  }, [showDetail]);

  const city = weatherData?.location?.city;
  const condition = weatherData?.weather?.condition || '天气';
  const temperature = weatherData?.weather?.temperature ?? '--';

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => navigate('/tools/weather')}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
        className="flex items-center gap-1 h-9 px-2 text-content-secondary transition-colors duration-200 hover:bg-menu-hover"
        title={`${city ? `${city} ` : ''}${condition} ${temperature}°`}
      >
        {getWeatherIcon(weatherData?.weather?.condition || '', 'sm')}
        <span className="text-xs whitespace-nowrap max-w-[48px] truncate">{condition}</span>
        <span className="text-xs font-medium whitespace-nowrap">{temperature}°</span>
      </button>
      {showDetail && anchorRect && (
        <WeatherDetailPopup weatherData={weatherData} forecast={forecast} anchorRect={anchorRect} />
      )}
    </>
  );
};

export default HeaderWeather;
