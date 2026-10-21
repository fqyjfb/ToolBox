import React, { useEffect, useState } from 'react';

interface HomeClockProps {
  /** 农历文案（如「腊月十七」），取自摸鱼日报数据；未加载时该段自动隐藏 */
  lunar?: string;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const pad = (value: number) => String(value).padStart(2, '0');

const formatTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const formatDate = (date: Date) => `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${WEEKDAYS[date.getDay()]}`;

/**
 * 首页搜索框上方的时间日期显示（大号时钟 + 公历 / 星期 / 农历）。
 * 时间每秒刷新一次，日期跨零点自动跟随，无需外部驱动。
 */
const HomeClock: React.FC<HomeClockProps> = ({ lunar }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="home-clock">
      <time className="home-clock__time" dateTime={now.toISOString()}>
        {formatTime(now)}
      </time>
      <p className="home-clock__meta">
        {formatDate(now)}
        {lunar ? ` ${lunar}` : ''}
      </p>
    </div>
  );
};

export default React.memo(HomeClock);
