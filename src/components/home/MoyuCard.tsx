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
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-center h-full min-h-[300px] ${className}`}>
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error || !moyuData) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 h-full min-h-[300px] ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coffee className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">摸鱼日报</h3>
          </div>
          <button
            onClick={fetchMoyuData}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
          {error || '暂无数据'}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden h-full flex flex-col ${className}`}>
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
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 rounded-xl p-4 mb-3 border border-amber-100 dark:border-amber-800/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-800 dark:text-white tracking-tight">
                  {moyuData.date.gregorian.split('-')[2]}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {moyuData.date.gregorian.split('-')[1]}月
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded-full">
                  {moyuData.date.weekday}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  本周第{moyuData.date.dayOfWeek}天
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {moyuData.date.lunar.monthCN}{moyuData.date.lunar.dayCN}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {moyuData.date.lunar.yearCN} · {moyuData.date.lunar.zodiac}年
              </p>
            </div>
          </div>
          {moyuData.today.lunarFestivals && moyuData.today.lunarFestivals.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t border-amber-200 dark:border-amber-800/30">
              <Star className="w-3 h-3 text-yellow-500" />
              <span className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                {moyuData.today.lunarFestivals.join(' · ')}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Moon className="w-3 h-3 text-blue-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">下周末</span>
            </div>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
              {moyuData.nextWeekend.date}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">还有{moyuData.nextWeekend.daysUntil}天</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calendar className="w-3 h-3 text-green-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">下个假期</span>
            </div>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{moyuData.nextHoliday.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {moyuData.nextHoliday.date} · {moyuData.nextHoliday.duration}天
            </p>
          </div>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">今日进度</span>
          </div>
          <div className="space-y-1.5">
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500 dark:text-gray-400">年度</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {moyuData.progress.year.passed}/{moyuData.progress.year.total}天 ({moyuData.progress.year.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${moyuData.progress.year.percentage}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500 dark:text-gray-400">月度</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {moyuData.progress.month.passed}/{moyuData.progress.month.total}天 ({moyuData.progress.month.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${moyuData.progress.month.percentage}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-500 dark:text-gray-400">本周</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {moyuData.progress.week.passed}/{moyuData.progress.week.total}天 ({moyuData.progress.week.percentage}%)
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${moyuData.progress.week.percentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-2 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500 dark:text-gray-400">倒计时</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-1">
              <p className="text-gray-500 dark:text-gray-400">周末</p>
              <p className="font-semibold text-gray-700 dark:text-gray-200">{moyuData.countdown.toWeekEnd}天</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-1">
              <p className="text-gray-500 dark:text-gray-400">周五</p>
              <p className="font-semibold text-gray-700 dark:text-gray-200">{moyuData.countdown.toFriday}天</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-1">
              <p className="text-gray-500 dark:text-gray-400">月底</p>
              <p className="font-semibold text-gray-700 dark:text-gray-200">{moyuData.countdown.toMonthEnd}天</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-1">
              <p className="text-gray-500 dark:text-gray-400">年终</p>
              <p className="font-semibold text-gray-700 dark:text-gray-200">{moyuData.countdown.toYearEnd}天</p>
            </div>
          </div>
        </div>

        {moyuData.moyuQuote && (
          <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
            <div className="flex items-start gap-2">
              <Sun className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed">
                "{moyuData.moyuQuote}"
              </p>
            </div>
          </div>
        )}

        {moyuData.nextHoliday.workdays && moyuData.nextHoliday.workdays.length > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">调休上班:</p>
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

export default MoyuCard;
