import React, { useState, useMemo, lazy, Suspense } from 'react';
import { CalendarClock, TrendingUp, Quote } from 'lucide-react';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useAlmanacHover } from '../../hooks/useAlmanacHover';

// 月历弹窗按需加载：CalendarModal -> utils/almanac -> tyme4ts（另含 201 项年份选项常量）。
// 它只在用户点击日历卡后才需要，静态导入会把这些一并塞进首屏包体。
// Modal 在 isOpen 为 false 时直接 return null（无关闭动画），
// 因此改为条件渲染不会改变任何可见行为。
const CalendarModal = lazy(() => import('./CalendarModal'));
import type { MoyuData } from '../../types/hotNews';

// 摸鱼日报按区块拆成四张独立卡片，数据由首页统一拉取后传入
export type MoyuVariant = 'calendar' | 'holiday' | 'quote' | 'progress' | 'countdown';

interface MoyuCardProps {
  variant: MoyuVariant;
  data: MoyuData | null;
  loading: boolean;
  error: string;
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

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const LUNAR_DAY_NAMES = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const ZODIAC_NAMES = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

interface LocalDateInfo {
  year: number;
  month: number;
  day: number;
  weekday: string;
  isWeekend: boolean;
  lunarMonth: string;
  lunarDay: string;
  zodiac: string;
}

/** 本地日期信息：日历卡不再依赖 60s 接口，农历由 Intl 中国历法计算 */
const buildLocalDateInfo = (date: Date): LocalDateInfo => {
  const weekdayIndex = date.getDay();
  const info: LocalDateInfo = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: WEEKDAY_NAMES[weekdayIndex],
    isWeekend: weekdayIndex === 0 || weekdayIndex === 6,
    lunarMonth: '',
    lunarDay: '',
    zodiac: '',
  };
  try {
    const parts = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).formatToParts(date);
    const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
    const lunarYear = Number(part('relatedYear'));
    return {
      ...info,
      lunarMonth: part('month'),
      lunarDay: LUNAR_DAY_NAMES[Number(part('day')) - 1] ?? '',
      zodiac: lunarYear ? ZODIAC_NAMES[(lunarYear - 4) % 12] : '',
    };
  } catch {
    // 运行时不支持中国历法时只保留公历信息
    return info;
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** 本地进度 / 倒计时：按当天日期直接计算，避免请求 60s 接口 */
const buildLocalStats = (info: LocalDateInfo) => {
  const today = new Date(info.year, info.month - 1, info.day);
  const yearStart = new Date(info.year, 0, 1);
  const passedYear = Math.round((today.getTime() - yearStart.getTime()) / DAY_MS) + 1;
  const totalYear = Math.round((new Date(info.year + 1, 0, 1).getTime() - yearStart.getTime()) / DAY_MS);
  const totalMonth = new Date(info.year, info.month, 0).getDate();
  const passedWeek = ((today.getDay() + 6) % 7) + 1;
  const percentage = (passed: number, total: number) => Math.round((passed / total) * 100);

  return {
    progress: {
      year: { passed: passedYear, total: totalYear, percentage: percentage(passedYear, totalYear) },
      month: { passed: info.day, total: totalMonth, percentage: percentage(info.day, totalMonth) },
      week: { passed: passedWeek, total: 7, percentage: percentage(passedWeek, 7) },
    },
    countdown: {
      toWeekEnd: (6 - today.getDay() + 7) % 7,
      toFriday: (5 - today.getDay() + 7) % 7,
      toMonthEnd: totalMonth - info.day,
      toYearEnd: totalYear - passedYear,
    },
  };
};

/** 2025-10-25 -> 10-25 */
const shortDate = (date: string) => (date.length >= 10 ? date.slice(5) : date);

const MoyuCard: React.FC<MoyuCardProps> = ({ variant, data, loading, error }) => {
  // 日历变体：点击开月历弹窗、悬浮看今日黄历（其余变体保持纯展示）
  const [calendarOpen, setCalendarOpen] = useState(false);
  const { show: showAlmanac, hide: hideAlmanac, popover: almanacPopover } = useAlmanacHover(300);
  // 日历 / 进度 / 倒计时按本地日期计算，不再依赖 60s 接口；
  // 假期提醒与摸鱼语录仍使用接口数据
  const localDate = useMemo(() => buildLocalDateInfo(new Date()), []);
  const localStats = useMemo(() => buildLocalStats(localDate), [localDate]);
  const almanacToday = { year: localDate.year, month: localDate.month, day: localDate.day };
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

  if (variant === 'holiday' || variant === 'quote') {
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

  if (variant === 'calendar') {
    const badge = localDate.isWeekend
      ? { text: '周末', bg: '#3b82f6' }
      : { text: '工作日', bg: '#f59e0b' };

    return (
      <>
        <div
          className="home-card home-card--panel moyu-card moyu-card--bar moyu-card--interactive"
          {...calendarClick}
        >
          <span className="moyu-calendar__dot-bar" aria-hidden="true" />
          <div className="moyu-card__body moyu-calendar">
            <span className="moyu-calendar__month">{localDate.month}月</span>
            <div className="moyu-calendar__day" {...calendarHover}>
              <span className="moyu-calendar__num">
                {localDate.day}
                <span className="moyu-calendar__char" aria-hidden="true">日</span>
              </span>
            </div>
            <div className="moyu-calendar__badge-row">
              <div className="moyu-calendar__badge">
                <span className="moyu-chip" style={{ backgroundColor: badge.bg }}>{badge.text}</span>
              </div>
              <span className="moyu-calendar__weekday">{localDate.weekday}</span>
            </div>
              <span className="moyu-calendar__lunar">
                {localDate.lunarDay && (
                  <span className="moyu-calendar__lunar-date">
                    {localDate.lunarMonth}{localDate.lunarDay}
                  </span>
                )}
                <div className="moyu-calendar__lunar-year-row">
                  {localDate.zodiac && (
                    <span className="moyu-calendar__lunar-year">
                      {localDate.zodiac}年
                    </span>
                  )}
                </div>
              </span>
          </div>
        </div>
        {almanacPopover}
        {calendarOpen && (
          <Suspense fallback={null}>
            <CalendarModal isOpen onClose={() => setCalendarOpen(false)} />
          </Suspense>
        )}
      </>
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
            const detail = localStats.progress[key];
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
          const days = localStats.countdown[key];
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
