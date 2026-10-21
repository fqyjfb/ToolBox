import React from 'react';
import { RefreshCw, Calendar, CalendarClock, Clock, TrendingUp } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import type { MoyuData } from '../../types/hotNews';

// 摸鱼日报按区块拆成四张独立卡片，数据由首页统一拉取后传入
export type MoyuVariant = 'calendar' | 'holiday' | 'quote' | 'progress' | 'countdown';

interface MoyuCardProps {
  variant: MoyuVariant;
  data: MoyuData | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}

const PROGRESS_ROWS = [
  { key: 'year', label: '年度', color: '#3b82f6' },
  { key: 'month', label: '月度', color: '#22c55e' },
  { key: 'week', label: '本周', color: '#f59e0b' },
] as const;

const COUNTDOWN_ITEMS = [
  { key: 'toWeekEnd', label: '周末' },
  { key: 'toFriday', label: '周五' },
  { key: 'toMonthEnd', label: '月底' },
  { key: 'toYearEnd', label: '年终' },
] as const;

const getHolidayBadge = (data: MoyuData): { text: string; bg: string } | null => {
  if (data.today.isHoliday) return { text: data.today.holidayName || '假日', bg: '#22c55e' };
  if (data.today.isWeekend) return { text: '周末', bg: '#3b82f6' };
  if (data.today.isWorkday) return { text: '工作日', bg: '#f59e0b' };
  return null;
};

/** 2025-10-25 -> 10-25 */
const shortDate = (date: string) => (date.length >= 10 ? date.slice(5) : date);

const MoyuCard: React.FC<MoyuCardProps> = ({ variant, data, loading, error, onRetry }) => {
  if (loading) {
    return (
      <div className="home-card home-card--panel moyu-card moyu-card--center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="home-card home-card--panel moyu-card moyu-card--center">
        <span className="moyu-card__hint truncate">{error || '暂无数据'}</span>
        {variant === 'calendar' && (
          <button onClick={onRetry} className="moyu-card__refresh" title="重试">
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  if (variant === 'calendar') {
    const badge = getHolidayBadge(data);
    const [, month, day] = data.date.gregorian.split('-');
    const festivals = data.today.lunarFestivals.length ? ` · ${data.today.lunarFestivals.join('·')}` : '';

    return (
      <div className="home-card home-card--panel moyu-card">
        <div className="moyu-card__head">
          <Calendar className="w-3 h-3 text-content-secondary" />
          <span className="moyu-card__title">摸鱼日历</span>
          <button onClick={onRetry} className="moyu-card__refresh" title="刷新">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        <div className="moyu-card__body moyu-calendar">
          <span className="moyu-calendar__num">{day}</span>
          <span className="moyu-calendar__sub">{Number(month)}月 · {data.date.weekday}</span>
          <span
            className="moyu-calendar__lunar"
            title={`${data.date.lunar.monthCN}${data.date.lunar.dayCN} · ${data.date.lunar.zodiac}年${festivals}`}
          >
            {data.date.lunar.monthCN}{data.date.lunar.dayCN} · {data.date.lunar.zodiac}年{festivals}
          </span>
          {badge && <span className="moyu-chip" style={{ backgroundColor: badge.bg }}>{badge.text}</span>}
        </div>
      </div>
    );
  }

  if (variant === 'holiday') {
    const { nextHoliday, nextWeekend } = data;
    const workdays = nextHoliday?.workdays ?? [];

    return (
      <div className="home-card home-card--panel moyu-card">
        <div className="moyu-card__head">
          <CalendarClock className="w-3 h-3 text-content-secondary" />
          <span className="moyu-card__title">假期提醒</span>
        </div>
        <div className="moyu-card__body moyu-holiday">
          <div className="moyu-holiday__hero">
            <span className="moyu-holiday__hero-name" title={nextHoliday?.name}>
              {nextHoliday?.name ?? '放假安排待公布'}
            </span>
            {nextHoliday ? (
              <span className="moyu-holiday__hero-countdown">
                <span className="moyu-holiday__hero-days">{nextHoliday.until}</span>
                <span className="moyu-holiday__hero-unit">天后</span>
              </span>
            ) : null}
            <span className="moyu-holiday__hero-date">
              {nextHoliday
                ? `${shortDate(nextHoliday.date)} · 休 ${nextHoliday.duration} 天`
                : '国务院尚未公布次年安排'}
            </span>
          </div>
          <div className="moyu-holiday__block">
            <span className="moyu-holiday__badge" title="下个周末">周末</span>
            <span className="moyu-holiday__meta" title={`${nextWeekend.date} ${nextWeekend.weekday}`}>
              {shortDate(nextWeekend.date)} · {nextWeekend.daysUntil}天后
            </span>
          </div>
          {workdays.length > 0 && (
            <div className="moyu-holiday__block">
              <span className="moyu-holiday__badge moyu-holiday__badge--work" title="调休上班">调休</span>
              <span className="moyu-holiday__meta" title={workdays.join('、')}>
                {workdays.map(shortDate).join('、')}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'quote') {
    return (
      <div className="home-card home-card--panel moyu-card moyu-quote-card">
        <p className="moyu-quote" title={data.moyuQuote}>{data.moyuQuote}</p>
      </div>
    );
  }

  if (variant === 'progress') {
    return (
      <div className="home-card home-card--panel moyu-card">
        <div className="moyu-card__head">
          <TrendingUp className="w-3 h-3 text-content-secondary" />
          <span className="moyu-card__title">今日进度</span>
        </div>
        <div className="moyu-card__body moyu-progress">
          {PROGRESS_ROWS.map(({ key, label, color }) => {
            const detail = data.progress[key];
            return (
              <div key={key} className="moyu-progress__row">
                <div className="moyu-card__line moyu-card__line--row">
                  <span>{label}</span>
                  <span title={`${detail.passed}/${detail.total} 天`}>{detail.percentage}%</span>
                </div>
                <div className="moyu-progress__track">
                  <div className="moyu-progress__bar" style={{ width: `${detail.percentage}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="home-card home-card--panel moyu-card">
      <div className="moyu-card__head">
        <Clock className="w-3 h-3 text-content-secondary" />
        <span className="moyu-card__title">倒计时</span>
      </div>
      <div className="moyu-card__body moyu-countdown">
        {COUNTDOWN_ITEMS.map(({ key, label }) => (
          <div key={key} className="moyu-countdown__item">
            <span className="moyu-countdown__label">{label}</span>
            <span className="moyu-countdown__value">{data.countdown[key]}天</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default React.memo(MoyuCard);
