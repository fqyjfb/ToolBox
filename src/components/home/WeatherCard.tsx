import React, { useState, useRef, useLayoutEffect } from 'react';
import { RefreshCw, Cloud } from 'lucide-react';
import { useWeather } from '../../hooks/useWeather';
import LoadingSpinner from '../ui/LoadingSpinner';
import { getWeatherIcon } from '../../utils/weatherIcon';
import WeatherDetailPopup from './WeatherDetailPopup';
import './HomeCards.css';

interface WeatherCardProps {
  /** 首页里它就是一张工具卡片：点击打开天气预报工具，右键走工具卡片菜单；不传则为纯展示 */
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

// 天气卡片：桌面端首页网格与 Web 端首页共用；悬浮展示详情卡片（与头部天气入口同一个弹层）
const WeatherCard: React.FC<WeatherCardProps> = ({ onClick, onContextMenu }) => {
  const { weatherData, forecast, loading, error, currentTime, city, fetchWeather } = useWeather();
  const [showDetail, setShowDetail] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const interactions = { onClick, onContextMenu };

  // 布局阶段取锚点，避免弹层先在错误位置画一帧；显示期间跟随滚动 / 尺寸变化同步位置。
  // 位置不变时复用旧对象，防止每帧 setState 造成重渲染抖动
  useLayoutEffect(() => {
    if (!showDetail) return;

    const update = () => {
      const next = cardRef.current?.getBoundingClientRect();
      if (!next) return;
      setAnchorRect(prev => (
        prev && prev.top === next.top && prev.left === next.left && prev.width === next.width
          ? prev
          : next
      ));
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showDetail]);

  const formatDate = (date: Date) => {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}月${day}日`;
  };

  if (error) {
    return (
      <div className="home-card home-card--panel weather-card weather-card--center" {...interactions}>
        <Cloud className="w-5 h-5 text-content-secondary" />
        <p className="weather-card__hint">{error}</p>
        <button onClick={fetchWeather} className="weather-card__retry" title="重试">
          <RefreshCw size={14} />
        </button>
      </div>
    );
  }

  if (loading && !weatherData) {
    return (
      <div className="home-card home-card--panel weather-card weather-card--center" {...interactions}>
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  const bgStyle = {
    backgroundColor: weatherData?.weather?.weather_colors?.[0] || '#6366f1',
  };

  return (
    <>
      <div
        ref={cardRef}
        className="home-card weather-card"
        style={bgStyle}
        {...interactions}
        onMouseEnter={() => setShowDetail(true)}
        onMouseLeave={() => setShowDetail(false)}
        // 拖拽时收起弹层，避免详情页停在原位遮挡其它卡片
        onPointerDown={() => setShowDetail(false)}
      >
        <div className="weather-card__row">
          {getWeatherIcon(weatherData?.weather?.condition || '', 'sm', 'text-white')}
          <span className="weather-card__temp">{weatherData?.weather?.temperature ?? '--'}°</span>
        </div>
        <span className="weather-card__city">{weatherData?.location?.city || city}</span>
        <span className="weather-card__meta">{formatDate(currentTime)}</span>
        <span className="weather-card__meta">{weatherData?.weather?.condition || '未知'}</span>
      </div>
      {showDetail && anchorRect && (
        <WeatherDetailPopup weatherData={weatherData} forecast={forecast} anchorRect={anchorRect} />
      )}
    </>
  );
};

export default React.memo(WeatherCard);
