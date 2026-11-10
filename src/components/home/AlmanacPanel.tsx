import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAlmanac } from '../../utils/almanac';
import { resolveAnchoredPosition } from '../../utils/anchoredPosition';

export interface AlmanacDate {
  year: number;
  month: number;
  day: number;
}

const PANEL_WIDTH = 480;
const MIN_PANEL_WIDTH = 240;
/** 浮层与触发元素、与视口边缘的间距 */
const POPOVER_GAP = 8;
const POPOVER_PADDING = 8;
/** 空间不足时的最小可视高度，再小就内部滚动 */
const MIN_VISIBLE_HEIGHT = 200;

const luckClass = (luck: string): string => {
  if (luck === '吉') return 'almanac__value almanac__value--good';
  if (luck === '凶') return 'almanac__value almanac__value--bad';
  return 'almanac__value';
};

interface AlmanacFieldProps {
  label: string;
  value: string;
  luck?: string;
}

const AlmanacField: React.FC<AlmanacFieldProps> = ({ label, value, luck }) => (
  <div className="almanac__field">
    <span className="almanac__label">{label}</span>
    <span className={luck ? luckClass(luck) : 'almanac__value'}>{value || '—'}</span>
  </div>
);

/** 黄历面板：纯展示，数据由 utils/almanac 本地计算 */
const AlmanacPanel: React.FC<AlmanacDate> = ({ year, month, day }) => {
  const data = getAlmanac(year, month, day);

  // 黄历快照推给主进程：悬浮球「黄历」卡片的内容源（与天气同一快照通道，预格式化一行文案）。
  // 仅当面板展示的是今天才推；推送失败静默。
  useEffect(() => {
    if (!window.electron?.floatDailySnapshot) return;
    const now = new Date();
    const isToday = now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
    if (!isToday) return;
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const yi = data.yi.slice(0, 3).join('、');
    const ji = data.ji.slice(0, 2).join('、');
    const line = `今日宜：${yi || '无'} · 忌：${ji || '无'}`;
    try {
      window.electron.floatDailySnapshot({ almanac: { line, date } });
    } catch { /* 快照仅是缓存，推送失败静默 */ }
    // data 由 year/month/day 纯函数算出，依赖日期三元组即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  return (
    <div className="almanac">
      <div className="almanac__head">
        <span className="almanac__solar">{data.solar} {data.weekday}</span>
        <span className="almanac__lunar">{data.lunar}</span>
        <span className="almanac__ganzhi">
          {data.yearGanZhi}({data.zodiac})年 {data.monthGanZhi}月 {data.dayGanZhi}日
        </span>
      </div>

      <div className="almanac__row almanac__row--yi">
        <span className="almanac__badge almanac__badge--yi">宜</span>
        <span className="almanac__items">{data.yi.join(' ') || '无'}</span>
      </div>
      <div className="almanac__row almanac__row--ji">
        <span className="almanac__badge almanac__badge--ji">忌</span>
        <span className="almanac__items">{data.ji.join(' ') || '无'}</span>
      </div>

      <div className="almanac__grid almanac__grid--3">
        <AlmanacField label="纳音" value={data.fiveElements} />
        <AlmanacField label="冲煞" value={data.chongSha} />
        <AlmanacField label="值神" value={`${data.dutyGod.name}${data.dutyGod.luck}`} luck={data.dutyGod.luck} />
      </div>

      <div className="almanac__hours">
        <span className="almanac__label">时辰吉凶</span>
        <div className="almanac__hour-list">
          {data.hours.map(hour => (
            <span key={hour.ganZhi} className="almanac__hour">
              <span className="almanac__hour-ganzhi">{hour.ganZhi.slice(0, 1)}</span>
              <span className="almanac__hour-ganzhi">{hour.ganZhi.slice(1)}</span>
              <span className={hour.luck === '吉' ? 'almanac__hour-luck almanac__hour-luck--good' : 'almanac__hour-luck almanac__hour-luck--bad'}>
                {hour.luck}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="almanac__grid almanac__grid--4">
        <AlmanacField label="建除十二神" value={data.duty} />
        <AlmanacField label="吉神宜趋" value={data.goodGods.join(' ')} />
        <AlmanacField label="今日胎神" value={data.fetus} />
        <AlmanacField label="凶神宜忌" value={data.badGods.join(' ')} />
      </div>

      <div className="almanac__grid almanac__grid--2">
        <AlmanacField label="彭祖百忌" value={data.pengZu.join(' / ')} />
        <AlmanacField label="二十八星宿" value={`${data.star28.name}${data.star28.luck}`} luck={data.star28.luck} />
      </div>
    </div>
  );
};

interface AlmanacPopoverProps {
  /** 触发元素的位置，浮层围绕它上下摆放 */
  rect: DOMRect;
  date: AlmanacDate;
  /** 点击持久模式：浮层需接收鼠标事件才能滚动内容 */
  pinned?: boolean;
}

/** 悬浮浮层：渲染到 body，挂载后回读真实尺寸再收回视口内（与右键菜单同一套定位思路） */
const AlmanacPopover: React.FC<AlmanacPopoverProps> = ({ rect, date, pinned = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const panelWidth = Math.min(PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, window.innerWidth - POPOVER_PADDING * 2));
  const [style, setStyle] = useState<React.CSSProperties>({
    left: rect.left,
    top: rect.bottom + POPOVER_GAP,
    width: panelWidth,
    // 定位完成前先隐藏，避免在初始坐标闪一帧
    visibility: 'hidden',
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
    const width = Math.min(PANEL_WIDTH, viewportWidth - POPOVER_PADDING * 2);

    const { x, y, maxHeight } = resolveAnchoredPosition({
      anchor: rect,
      width,
      height: element.offsetHeight,
      viewport: { width: viewportWidth, height: viewportHeight },
      gap: POPOVER_GAP,
      margin: POPOVER_PADDING,
      placements: ['bottom', 'top'],
      minVisibleHeight: MIN_VISIBLE_HEIGHT,
    });

    setStyle({ left: x, top: y, width, maxHeight, visibility: 'visible' });
  }, [rect, date.year, date.month, date.day]);

  return createPortal(
    <div
      ref={ref}
      className={pinned ? 'almanac-popover almanac-popover--pinned' : 'almanac-popover'}
      style={style}
    >
      <AlmanacPanel year={date.year} month={date.month} day={date.day} />
    </div>,
    document.body
  );
};

export { AlmanacPopover };
