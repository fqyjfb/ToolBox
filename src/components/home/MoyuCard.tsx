import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Coffee, Calendar, TrendingUp, Clock, Moon, Sun, Star } from 'lucide-react';
import { hotNewsApi } from '../../services/hotNews';
import type { MoyuData } from '../../types/hotNews';
import LoadingSpinner from '../ui/LoadingSpinner';

interface MoyuCardProps {
  className?: string;
}

const MoyuCard: React.FC<MoyuCardProps> = ({ className = '' }) => {
  const [moyuData, setMoyuData] = useState<MoyuData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMoyuData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await hotNewsApi.getMoyuData();
      if (data?.data) {
        setMoyuData(data.data);
      } else {
        setError('获取数据失败');
      }
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMoyuData();
  }, [fetchMoyuData]);

  const getHolidayBadge = () => {
    if (!moyuData) return null;
    if (moyuData.today.isHoliday) {
      return { text: moyuData.today.holidayName || '假日', bg: 'bg-green-500', textColor: 'text-white' };
    }
    if (moyuData.today.isWeekend) {
      return { text: '周末', bg: 'bg-blue-500', textColor: 'text-white' };
    }
    if (moyuData.today.isWorkday) {
      return { text: '工作日', bg: 'bg-orange-500', textColor: 'text-white' };
    }
    return null;
  };

  const holidayBadge = getHolidayBadge();

  if (loading) {
    return (
      <div className={`rounded-lg p-4 flex items-center justify-center h-full min-h-moyu-card ${className}`} style={{ backgroundColor: 'color-mix(in srgb, var(--color-card) 60%, transparent)', boxShadow: 'var(--shadow-sm)' }}>
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error || !moyuData) {
    return (
      <div className={`rounded-lg p-4 h-full min-h-moyu-card ${className}`} style={{ backgroundColor: 'color-mix(in srgb, var(--color-card) 60%, transparent)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-content-primary">摸鱼日报</h3>
          </div>
          <button
            onClick={fetchMoyuData}
            className="p-1 hover:bg-menu-hover rounded transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-content-secondary" />
          </button>
        </div>
        <div className="flex items-center justify-center h-48 text-content-secondary text-sm">
          {error || '暂无数据'}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg overflow-hidden h-full flex flex-col ${className}`} style={{ backgroundColor: 'color-mix(in srgb, var(--color-card) 60%, transparent)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="flex items-center gap-2">
          <Coffee className="w-4 h-4 text-white" />
          <h3 className="text-sm font-semibold text-white">摸鱼日报</h3>
        </div>
        <div className="flex items-center gap-2">
          {holidayBadge && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${holidayBadge.bg} ${holidayBadge.textColor}`}>
              {holidayBadge.text}
            </span>
          )}
          <button
            onClick={fetchMoyuData}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 overflow-y-auto">
        <div className="bg-surface-secondary rounded-xl p-4 mb-3 border border-content-light">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-content-primary tracking-tight">
                  {moyuData.date.gregorian.split('-')[2]}
                </span>
                <span className="text-sm text-content-secondary">
                  {moyuData.date.gregorian.split('-')[1]}月
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 text-xs font-medium bg-surface dark:bg-content-primary text-content-primary dark:text-content-primary rounded-full">
                  {moyuData.date.weekday}
                </span>
                <span className="text-xs text-content-secondary">
                  本周第{moyuData.date.dayOfWeek}天
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-semibold text-content-primary">
                  {moyuData.date.lunar.monthCN}{moyuData.date.lunar.dayCN}
                </span>
              </div>
              <p className="text-xs text-content-secondary mt-0.5">
                {moyuData.date.lunar.yearCN} · {moyuData.date.lunar.zodiac}年
              </p>
            </div>
          </div>
          {moyuData.today.lunarFestivals && moyuData.today.lunarFestivals.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-content-light">
              <Star className="w-3 h-3 text-warning" />
              <span className="text-xs text-warning font-medium">
                {moyuData.today.lunarFestivals.join(' · ')}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-surface-secondary-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Moon className="w-3 h-3 text-blue-500" />
              <span className="text-xs text-content-secondary">下周末</span>
            </div>
            <p className="text-lg font-bold text-content-primary">
              {moyuData.nextWeekend.date}
            </p>
            <p className="text-xs text-content-secondary">还有{moyuData.nextWeekend.daysUntil}天</p>
          </div>
          <div className="bg-surface-secondary-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-green-500" />
              <span className="text-xs text-content-secondary">下个假期</span>
            </div>
            <p className="text-lg font-bold text-content-primary">{moyuData.nextHoliday.name}</p>
            <p className="text-xs text-content-secondary">
              {moyuData.nextHoliday.date} · {moyuData.nextHoliday.duration}天
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-content-secondary" />
            <span className="text-xs text-content-secondary">今日进度</span>
          </div>
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-content-secondary">年度</span>
                <span className="text-content-primary">
                  {moyuData.progress.year.passed}/{moyuData.progress.year.total}天 ({moyuData.progress.year.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${moyuData.progress.year.percentage}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-content-secondary">月度</span>
                <span className="text-content-primary">
                  {moyuData.progress.month.passed}/{moyuData.progress.month.total}天 ({moyuData.progress.month.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${moyuData.progress.month.percentage}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-content-secondary">本周</span>
                <span className="text-content-primary">
                  {moyuData.progress.week.passed}/{moyuData.progress.week.total}天 ({moyuData.progress.week.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${moyuData.progress.week.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-content-secondary" />
            <span className="text-xs text-content-secondary">倒计时</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            <div className="bg-surface-secondary-50 rounded p-1">
              <p className="text-content-secondary">周末</p>
              <p className="font-semibold text-content-primary">{moyuData.countdown.toWeekEnd}天</p>
            </div>
            <div className="bg-surface-secondary-50 rounded p-1">
              <p className="text-content-secondary">周五</p>
              <p className="font-semibold text-content-primary">{moyuData.countdown.toFriday}天</p>
            </div>
            <div className="bg-surface-secondary-50 rounded p-1">
              <p className="text-content-secondary">月底</p>
              <p className="font-semibold text-content-primary">{moyuData.countdown.toMonthEnd}天</p>
            </div>
            <div className="bg-surface-secondary-50 rounded p-1">
              <p className="text-content-secondary">年终</p>
              <p className="font-semibold text-content-primary">{moyuData.countdown.toYearEnd}天</p>
            </div>
          </div>
        </div>

        {moyuData.moyuQuote && (
          <div className="pt-2">
            <div className="flex items-start gap-2">
              <Sun className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-content-secondary italic leading-relaxed">
                "{moyuData.moyuQuote}"
              </p>
            </div>
          </div>
        )}

        {moyuData.nextHoliday.workdays && moyuData.nextHoliday.workdays.length > 0 && (
          <div className="mt-2 pt-2">
            <p className="text-xs text-content-secondary mb-1">调休上班:</p>
            <div className="flex flex-wrap gap-1">
              {moyuData.nextHoliday.workdays.map((day, index) => (
                <span
                  key={index}
                  className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs"
                >
                  {day}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(MoyuCard);
