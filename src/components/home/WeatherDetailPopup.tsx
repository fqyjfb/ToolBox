import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Droplets, Gauge, Sun, Cloud, Wind } from 'lucide-react';
import type { WeatherInfo, DailyForecast } from '../../types/weather';
import { getDayName } from '../../utils/format';
import { getWeatherIcon } from '../../utils/weatherIcon';

const POPUP_WIDTH = 208;
// 与锚点的间距 / 与视口边缘的安全边距
const GAP = 8;
const MARGIN = 8;

interface WeatherDetailPopupProps {
  weatherData: WeatherInfo | null;
  forecast: DailyForecast[];
  /** 触发元素的矩形，用于计算弹层位置 */
  anchorRect: DOMRect;
}

/** 弹层矩形与锚点矩形是否相交 */
const overlapsAnchor = (x: number, y: number, width: number, height: number, anchor: DOMRect) =>
  !(x + width <= anchor.left || anchor.right <= x || y + height <= anchor.top || anchor.bottom <= y);

/**
 * 依次尝试「右侧 → 左侧 → 下方 → 上方」，取第一个既在视口内、又不压住锚点的位置。
 * 小窗（宽度仅 320 左右）下左右都放不下，会自动落到下方，避免弹层盖住天气卡片本身
 * —— 盖住会触发 mouseleave → 弹层消失 → mouseenter，表现为不停闪烁。
 */
const resolvePosition = (anchor: DOMRect, width: number, height: number) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (value: number) => Math.min(Math.max(MARGIN, value), Math.max(MARGIN, vw - width - MARGIN));
  const clampY = (value: number) => Math.min(Math.max(MARGIN, value), Math.max(MARGIN, vh - height - MARGIN));

  const candidates: Array<[number, number]> = [
    [anchor.right + GAP, anchor.top],
    [anchor.left - width - GAP, anchor.top],
    [anchor.left, anchor.bottom + GAP],
    [anchor.left, anchor.top - height - GAP],
  ];

  for (const [rawX, rawY] of candidates) {
    const x = clampX(rawX);
    const y = clampY(rawY);
    if (!overlapsAnchor(x, y, width, height, anchor)) return { x, y };
  }

  return { x: clampX(anchor.right + GAP), y: clampY(anchor.top) };
};

/** 天气详情悬浮卡片：渲染到 body，贴着锚点展示，全程不接收鼠标事件 */
const WeatherDetailPopup: React.FC<WeatherDetailPopupProps> = ({ weatherData, forecast, anchorRect }) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  // 先挂载量出真实尺寸，再定位置；定好位之前保持隐藏，避免在 (0,0) 闪一帧
  useLayoutEffect(() => {
    const el = popupRef.current;
    if (!el) return;

    const { width, height } = el.getBoundingClientRect();
    const next = resolvePosition(anchorRect, width, height);
    setPosition(prev => (prev && prev.x === next.x && prev.y === next.y ? prev : next));
  }, [anchorRect, weatherData, forecast]);

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[1000] pointer-events-none"
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        width: POPUP_WIDTH,
        maxWidth: `calc(100vw - ${MARGIN * 2}px)`,
        maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      <div className="w-full rounded-lg overflow-hidden shadow-xl">
        <div className="bg-sky-500 text-white">
          <div className="p-2.5">
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-white/10 p-1.5 backdrop-blur-sm mb-2">
              <div className="flex flex-col items-center gap-0.5">
                <Droplets size={12} className="text-white/80" />
                <span className="text-3xs opacity-80">湿度</span>
                <span className="text-xs font-semibold">
                  {weatherData?.weather?.humidity ?? '--'}%
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Wind size={12} className="text-white/80" />
                <span className="text-3xs opacity-80">风向</span>
                <span className="text-xs font-semibold">
                  {weatherData?.weather?.wind_direction ?? '--'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Gauge size={12} className="text-white/80" />
                <span className="text-3xs opacity-80">气压</span>
                <span className="text-xs font-semibold">
                  {weatherData?.weather?.pressure ?? '--'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Cloud size={12} className="text-white/80" />
                <span className="text-3xs opacity-80">降水</span>
                <span className="text-xs font-semibold">
                  {weatherData?.weather?.precipitation ?? '--'}mm
                </span>
              </div>
            </div>

            {weatherData?.air_quality && (
              <div className="flex items-center justify-between rounded-lg bg-white/10 px-1.5 py-1 mb-1.5">
                <div className="flex items-center gap-1">
                  <Sun size={12} className="text-white/80" />
                  <span className="text-3xs">空气质量</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-2xs font-semibold">
                    {weatherData.air_quality.quality}
                  </span>
                  <span className="text-3xs opacity-80">
                    AQI {weatherData.air_quality.aqi}
                  </span>
                </div>
              </div>
            )}

            {weatherData?.sunrise && (
              <div className="flex items-center justify-between rounded-lg bg-white/10 px-1.5 py-1 mb-1.5">
                <div className="flex items-center gap-1">
                  <Sun size={12} className="text-yellow-300" />
                  <span className="text-3xs">日出</span>
                  <span className="text-2xs font-semibold">
                    {weatherData.sunrise.sunrise_desc}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-3xs">日落</span>
                  <span className="text-2xs font-semibold">
                    {weatherData.sunrise.sunset_desc}
                  </span>
                </div>
              </div>
            )}

            {forecast.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-3xs font-medium text-white/80">未来2天</h4>
                <div className="space-y-1">
                  {forecast.slice(0, 2).map((day, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-white/10 px-1.5 py-1"
                    >
                      <span className="text-2xs font-medium">{getDayName(day.date)}</span>
                      <div className="flex items-center gap-2">
                        {getWeatherIcon(day.day_condition || '', 'sm', 'text-white')}
                        <div className="flex gap-1.5">
                          <span className="text-2xs font-semibold">{day.min_temperature}°</span>
                          <span className="text-2xs text-white/80">{day.max_temperature}°</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WeatherDetailPopup;
