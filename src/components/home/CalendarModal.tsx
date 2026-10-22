import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Select, { type SelectOption } from '../ui/Select';
import Modal from '../ui/Modal';
import { getMonthCalendar, type CalendarDay } from '../../utils/almanac';
import { useAlmanacHover } from '../../hooks/useAlmanacHover';

/** 周一起始 */
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

/** 头部年月可直接下拉跳转（tyme4ts 支持 1~9999 年，取常用区间） */
const YEAR_OPTIONS: SelectOption[] = Array.from({ length: 201 }, (_, index) => {
  const year = 1900 + index;
  return { value: String(year), label: `${year}年` };
});
const MONTH_OPTIONS: SelectOption[] = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1}月`,
}));

/** 月相名 -> 月相图标样式后缀 */
const PHASE_CLASS: Record<string, string> = {
  新月: 'new',
  蛾眉月: 'waxing-crescent',
  上弦月: 'first-quarter',
  盈凸月: 'waxing-gibbous',
  满月: 'full',
  亏凸月: 'waning-gibbous',
  下弦月: 'last-quarter',
  残月: 'waning-crescent',
};

const BADGE_CLASS: Record<string, string> = {
  休: 'rest',
  班: 'work',
  今: 'today',
};

interface CalendarCellProps {
  day: CalendarDay;
  isSelected: boolean;
  onSelect: () => void;
  onHoverStart: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onHoverEnd: () => void;
}

/** 单日格：公历日 + 农历/节日/节气，右上角挂休/班/今角标 */
const CalendarCell: React.FC<CalendarCellProps> = ({
  day, isSelected, onSelect, onHoverStart, onHoverEnd,
}) => {
  const classes = ['calendar-modal__cell'];
  if (!day.isCurrentMonth) classes.push('calendar-modal__cell--outside');
  if (day.isToday) classes.push('calendar-modal__cell--today');
  if (isSelected) classes.push('calendar-modal__cell--selected');

  let subClass = 'calendar-modal__sub';
  if (day.festival) subClass += ' calendar-modal__sub--festival';
  else if (day.term) subClass += ' calendar-modal__sub--term';

  // 休/班与「今」同处右上角，互斥展示避免叠字
  const badge = day.holiday ?? (day.isToday ? '今' : null);
  const phaseClass = day.phase ? PHASE_CLASS[day.phase] : undefined;

  return (
    <button
      type="button"
      className={classes.join(' ')}
      onClick={onSelect}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <span className="calendar-modal__day-row">
        {phaseClass && <span className={`calendar-phase calendar-phase--${phaseClass}`} aria-hidden="true" />}
        <span className={day.isWeekend ? 'calendar-modal__day calendar-modal__day--weekend' : 'calendar-modal__day'}>
          {day.day}
        </span>
      </span>
      <span className={subClass}>
        {day.festival ?? day.term ?? day.lunarText}
        {day.monthGanZhi && <span className="calendar-modal__sub-extra">{day.monthGanZhi}</span>}
      </span>
      {badge && (
        <span className={`calendar-modal__badge calendar-modal__badge--${BADGE_CLASS[badge]}`}>
          {badge}
        </span>
      )}
    </button>
  );
};

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 首页日历卡片点击后的月历弹窗：整月农历/干支/节气/节日/法定假日，
 * 悬浮任意日期格弹出当日黄历。
 */
const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose }) => {
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selected, setSelected] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
  });
  const { show, hide, popover } = useAlmanacHover(150);
  const month = useMemo(() => getMonthCalendar(view.year, view.month), [view.year, view.month]);

  const shiftMonth = (delta: number) => {
    setView(prev => {
      const next = new Date(prev.year, prev.month - 1 + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() + 1 };
    });
  };

  return (
    // portal：首页卡片重排动画的 transform 写在卡片层，非 portal 的 fixed 定位会被其包含块捕获
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      portal
      autoFocus={false}
      clickOutsideToClose
      showCancel={false}
      showConfirm={false}
      bodyClassName=""
    >
      <div className="calendar-modal">
        <div className="calendar-modal__head">
          <div className="calendar-modal__pickers">
            <Select
              value={String(view.year)}
              onChange={value => setView(prev => ({ ...prev, year: Number(value) }))}
              options={YEAR_OPTIONS}
              size="sm"
              dense
              className="calendar-modal__picker"
            />
            <Select
              value={String(view.month)}
              onChange={value => setView(prev => ({ ...prev, month: Number(value) }))}
              options={MONTH_OPTIONS}
              size="sm"
              dense
              className="calendar-modal__picker"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="calendar-modal__close"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <button
          type="button"
          className="calendar-modal__nav calendar-modal__nav--prev"
          onClick={() => shiftMonth(-1)}
          title="上个月"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="calendar-modal__nav calendar-modal__nav--next"
          onClick={() => shiftMonth(1)}
          title="下个月"
        >
          <ChevronRight size={18} />
        </button>

        <div className="calendar-modal__weekdays">
          {WEEKDAYS.map((label, index) => (
            <span
              key={label}
              className={index >= 5 ? 'calendar-modal__weekday calendar-modal__weekday--weekend' : 'calendar-modal__weekday'}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="calendar-modal__grid" onMouseLeave={hide}>
          {month.weeks.map(week => (
            <div key={week[0].key} className="calendar-modal__week">
              {week.map(day => (
                <CalendarCell
                  key={day.key}
                  day={day}
                  isSelected={
                    selected.year === day.year &&
                    selected.month === day.month &&
                    selected.day === day.day
                  }
                  onSelect={() => setSelected({ year: day.year, month: day.month, day: day.day })}
                  onHoverStart={event => show(event, { year: day.year, month: day.month, day: day.day })}
                  onHoverEnd={hide}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {popover}
    </Modal>
  );
};

export default React.memo(CalendarModal);
