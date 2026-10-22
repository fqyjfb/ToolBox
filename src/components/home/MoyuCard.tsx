import React, { useState } from 'react';
import { RefreshCw, CalendarClock, TrendingUp, Quote } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import CalendarModal from './CalendarModal';
import { useAlmanacHover } from '../../hooks/useAlmanacHover';
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
  // 日历变体：点击开月历弹窗、悬浮看今日黄历（其余变体保持纯展示）
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { show: showAlmanac, hide: hideAlmanac, popover: almanacPopover } = useAlmanacHover(300);
  const now = new Date();
  const almanacToday = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  // 悬浮触发区收窄到「日期数字 + 圆点」；点击仍是整张卡片打开月历
  const calendarClick: React.DOMAttributes<HTMLDivElement> = variant === 'calendar'
    ? {
        onClick: () => {
          // 弹窗遮罩会立刻盖住卡片，主动收起浮层避免它压在弹窗之上
          hideAlmanac();
          setCalendarOpen(true);
        },
      }
    : {};
  const calendarHover: React.DOMAttributes<HTMLDivElement> = variant === 'calendar'
    ? {
        onMouseEnter: event => showAlmanac(event, almanacToday),
        onMouseLeave: hideAlmanac,
      }
    : {};

  if (loading) {
    return (
      <div className="home-card home-card--panel moyu-card moyu-card--center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className={`home-card home-card--panel moyu-card moyu-card--center${variant === 'calendar' ? ' moyu-card--interactive' : ''}`}
        {...calendarClick}
      >
        <span className="moyu-card__hint truncate">{error || '暂无数据'}</span>
        {variant === 'calendar' && (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRetry();
            }}
            className="moyu-card__refresh"
            title="重试"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
        {variant === 'calendar' && (
          <>
            {almanacPopover}
            <CalendarModal isOpen={calendarOpen} onClose={() => setCalendarOpen(false)} />
          </>
        )}
      </div>
    );
  }

  if (variant === 'calendar') {
    const badge = getHolidayBadge(data);
    const [, month, day] = data.date.gregorian.split('-');
    const festivals = data.today.lunarFestivals.length ? ` · ${data.today.lunarFestivals.join('·')}` : '';

    return (
      <>
        <div
          className="home-card home-card--panel moyu-card moyu-card--bar moyu-card--interactive"
          {...calendarClick}
        >
          <span className="moyu-calendar__dot-bar" aria-hidden="true" />
          <div className="moyu-card__body moyu-calendar">
            <span className="moyu-calendar__month">{Number(month)}月</span>
            <div className="moyu-calendar__day" {...calendarHover}>
              <span className="moyu-calendar__num">
                {day}
                <span className="moyu-calendar__char" aria-hidden="true">日</span>
              </span>
            </div>
            <div className="moyu-calendar__badge-row">
              <div className="moyu-calendar__badge">
                {badge && (
                  <span className="moyu-chip" style={{ backgroundColor: badge.bg }}>{badge.text}</span>
                )}
              </div>
              <span className="moyu-calendar__weekday">{data.date.weekday}</span>
            </div>
              <span className="moyu-calendar__lunar">
                <span className="moyu-calendar__lunar-date">
                  {data.date.lunar.monthCN}{data.date.lunar.dayCN}
                </span>
                <div className="moyu-calendar__lunar-year-row">
                  <span className="moyu-calendar__lunar-year">
                    {data.date.lunar.zodiac}年
                  </span>
                  {festivals && (
                    <span className="moyu-calendar__lunar-festivals">{festivals}</span>
                  )}
                </div>
              </span>
          </div>
        </div>
        {almanacPopover}
        <CalendarModal isOpen={calendarOpen} onClose={() => setCalendarOpen(false)} />
      </>
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
          <div className="moyu-holiday__block-row">
            <span className="moyu-holiday__badge" title="下个周末">周末</span>
            <span className="moyu-holiday__meta-date">{shortDate(nextWeekend.date)}</span>
          </div>
          <div className="moyu-holiday__info-bottom">
            <span className="moyu-holiday__meta-when">{nextWeekend.daysUntil}天后</span>
            <span className="moyu-holiday__weekday">{nextWeekend.weekday}</span>
          </div>
          {workdays.length > 0 && (
            <div className="moyu-holiday__block-row">
              <span className="moyu-holiday__badge moyu-holiday__badge--work" title="调休上班">调休</span>
              <div className="moyu-holiday__meta" title={workdays.join('、')}>
                {workdays.map(shortDate).map(d => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'quote') {
    return (
      <div className="home-card home-card--panel moyu-card moyu-quote-card">
        <div className="moyu-card__head">
          <Quote className="moyu-quote-card__icon" />
          <span className="moyu-card__title">摸鱼语录</span>
        </div>
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
      <div className="moyu-card__body moyu-countdown">
        {COUNTDOWN_ITEMS.map(({ key, label }) => {
          const days = data.countdown[key];
          return (
            <div key={key} className="moyu-countdown__item">
              <span className="moyu-countdown__label">{label}</span>
              <span className="moyu-countdown__value">
                <span className="moyu-countdown__num">{days}</span>
                <span className="moyu-countdown__unit">天</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(MoyuCard);
