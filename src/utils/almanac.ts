import { SolarDay, SolarMonth } from 'tyme4ts';

/** 月历网格中的一格 */
export interface CalendarDay {
  /** 'y-m-d'，同时作为 React key 与黄历缓存键 */
  key: string;
  year: number;
  month: number;
  day: number;
  /** 补位格（上/下月） */
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  /** 农历日 + 日干支，如 '廿一戊申' */
  lunarText: string;
  /** 公历/农历传统节日，优先于农历日展示 */
  festival: string | null;
  /** 节气名（仅节气当天） */
  term: string | null;
  /** 节气换月当月的干支月，如 '戊戌月' */
  monthGanZhi: string | null;
  /** 法定节假日：休 / 调休上班 */
  holiday: '休' | '班' | null;
  /** 月相名（仅月相更替日），用于绘制月相小图标 */
  phase: string | null;
}

/** 整月网格：周一起始的 5~6 行 */
export interface CalendarMonth {
  year: number;
  month: number;
  weeks: CalendarDay[][];
}

/** 单日黄历（黄历参考图全部字段） */
export interface AlmanacData {
  date: string;
  solar: string;
  weekday: string;
  lunar: string;
  yearGanZhi: string;
  zodiac: string;
  monthGanZhi: string;
  dayGanZhi: string;
  /** 宜 */
  yi: string[];
  /** 忌 */
  ji: string[];
  /** 纳音五行 */
  fiveElements: string;
  chongSha: string;
  /** 值神（黄道黑道十二神） */
  dutyGod: { name: string; luck: string };
  /** 时辰吉凶，12 项 */
  hours: { ganZhi: string; luck: string }[];
  /** 建除十二神 */
  duty: string;
  goodGods: string[];
  badGods: string[];
  /** 今日胎神 */
  fetus: string;
  /** 彭祖百忌：天干句 / 地支句 */
  pengZu: string[];
  /** 二十八星宿 */
  star28: { name: string; luck: string };
}

const LUCK_GOOD = '吉';
// 黄历按天缓存：整月悬浮会反复命中同一天，上限控制内存
const ALMANAC_CACHE_LIMIT = 400;
const almanacCache = new Map<string, AlmanacData>();

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

const dateKey = (year: number, month: number, day: number): string =>
  `${year}-${pad2(month)}-${pad2(day)}`;

const todayKey = (): string => {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

/** 取单日黄历（本地计算，结果按天缓存） */
export const getAlmanac = (year: number, month: number, day: number): AlmanacData => {
  const key = dateKey(year, month, day);
  const cached = almanacCache.get(key);
  if (cached) return cached;

  const solarDay = SolarDay.fromYmd(year, month, day);
  const lunarDay = solarDay.getLunarDay();
  const sixtyCycleDay = solarDay.getSixtyCycleDay();
  const dayCycle = sixtyCycleDay.getSixtyCycle();
  const pillars = lunarDay.getThreePillars();
  const gods = lunarDay.getGods();
  const star = lunarDay.getTwentyEightStar();
  const pengZu = dayCycle.getPengZu();
  const earthBranch = dayCycle.getEarthBranch();
  const twelveStar = lunarDay.getTwelveStar();

  const data: AlmanacData = {
    date: key,
    solar: `${year}年${month}月${day}日`,
    weekday: `星期${solarDay.getWeek().getName()}`,
    lunar: lunarDay.toString(),
    yearGanZhi: pillars.getYear().getName(),
    zodiac: pillars.getYear().getEarthBranch().getZodiac().getName(),
    monthGanZhi: pillars.getMonth().getName(),
    dayGanZhi: pillars.getDay().getName(),
    yi: lunarDay.getRecommends().map(taboo => taboo.getName()),
    ji: lunarDay.getAvoids().map(taboo => taboo.getName()),
    fiveElements: dayCycle.getSound().getName(),
    chongSha: `冲${earthBranch.getOpposite().getZodiac().getName()} 煞${earthBranch.getOminous().getName()}`,
    dutyGod: {
      name: twelveStar.getName(),
      luck: twelveStar.getEcliptic().getLuck().getName(),
    },
    hours: sixtyCycleDay.getHours().map(hour => ({
      ganZhi: hour.getSixtyCycle().getName(),
      luck: hour.getTwelveStar().getEcliptic().getLuck().getName(),
    })),
    duty: lunarDay.getDuty().getName(),
    goodGods: gods.filter(god => god.getLuck().getName() === LUCK_GOOD).map(god => god.getName()),
    badGods: gods.filter(god => god.getLuck().getName() !== LUCK_GOOD).map(god => god.getName()),
    fetus: lunarDay.getFetusDay().getName(),
    pengZu: [
      pengZu.getPengZuHeavenStem().getName(),
      pengZu.getPengZuEarthBranch().getName(),
    ],
    star28: {
      name: `${star.getName()}${star.getSevenStar().getName()}${star.getAnimal().getName()}`,
      luck: star.getLuck().getName(),
    },
  };

  if (almanacCache.size >= ALMANAC_CACHE_LIMIT) almanacCache.clear();
  almanacCache.set(key, data);
  return data;
};

const buildCalendarDay = (solarDay: SolarDay, currentMonth: number, today: string): CalendarDay => {
  const year = solarDay.getYear();
  const month = solarDay.getMonth();
  const day = solarDay.getDay();
  const lunarDay = solarDay.getLunarDay();
  const isTermDay = solarDay.getTermDay().getDayIndex() === 0;
  const legalHoliday = solarDay.getLegalHoliday();
  const weekday = new Date(year, month - 1, day).getDay();

  return {
    key: dateKey(year, month, day),
    year,
    month,
    day,
    isCurrentMonth: month === currentMonth,
    isToday: dateKey(year, month, day) === today,
    isWeekend: weekday === 0 || weekday === 6,
    lunarText: `${lunarDay.getName()}${lunarDay.getSixtyCycle().getName()}`,
    festival: solarDay.getFestival()?.getName() ?? lunarDay.getFestival()?.getName() ?? null,
    term: isTermDay ? solarDay.getTerm().getName() : null,
    monthGanZhi: isTermDay ? `${lunarDay.getThreePillars().getMonth().getName()}月` : null,
    holiday: legalHoliday ? (legalHoliday.isWork() ? '班' : '休') : null,
    phase: solarDay.getPhaseDay().getDayIndex() === 0 ? solarDay.getPhase().getName() : null,
  };
};

/** 取整月网格（周一起始，含上下月补位格） */
export const getMonthCalendar = (year: number, month: number): CalendarMonth => {
  const today = todayKey();
  const weeks = SolarMonth.fromYm(year, month).getWeeks(1);

  return {
    year,
    month,
    weeks: weeks.map(week => week.getDays().map(day => buildCalendarDay(day, month, today))),
  };
};
