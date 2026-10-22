import React, { useEffect, useState } from 'react';
import { formatMonthDayWeek, pad2 } from '../../utils/format';

interface HomeClockProps {
  /** 农历文案（如「腊月十七」），取自摸鱼日报数据；未加载时该段自动隐藏 */
  lunar?: string;
}

const formatTime = (date: Date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

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
        {formatMonthDayWeek(now, 'long')}
        {lunar ? ` ${lunar}` : ''}
      </p>
    </div>
  );
};

export default React.memo(HomeClock);
