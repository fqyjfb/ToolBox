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
    // 时间只显示到分钟（formatTime 输出 HH:MM，formatMonthDayWeek 输出日期+星期），
    // 因此对齐到下一个分钟边界再更新，而不是每秒 setState。
    // 跨零点正好落在分钟边界上，日期与星期照常自动跟随，UI 表现与每秒刷新完全一致。
    let timer = 0;
    const scheduleNextMinute = () => {
      const current = new Date();
      const delay = 60000 - (current.getSeconds() * 1000 + current.getMilliseconds());
      timer = window.setTimeout(() => {
        setNow(new Date());
        scheduleNextMinute();
      }, delay);
    };
    scheduleNextMinute();
    return () => window.clearTimeout(timer);
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
