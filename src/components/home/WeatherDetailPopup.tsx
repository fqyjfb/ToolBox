import React from 'react';
import { createPortal } from 'react-dom';
import { Droplets, Gauge, Sun, Cloud, Wind } from 'lucide-react';
import type { WeatherInfo, DailyForecast } from '../../types/weather';
import { getDayName } from '../../utils/format';
import { getWeatherIcon } from '../../utils/weatherIcon';

const POPUP_WIDTH = 208;
const POPUP_MAX_HEIGHT = 260;

interface WeatherDetailPopupProps {
  weatherData: WeatherInfo | null;
  forecast: DailyForecast[];
  /** 触发元素的矩形，用于计算弹层位置 */
  anchorRect: DOMRect;
}

/** 天气详情悬浮卡片：渲染到 body，优先贴在锚点右侧，空间不足时改到左侧并做视口收敛 */
const WeatherDetailPopup: React.FC<WeatherDetailPopupProps> = ({ weatherData, forecast, anchorRect }) => {
  const spaceRight = window.innerWidth - anchorRect.right;
  const preferLeft = spaceRight < POPUP_WIDTH + 12;
  const rawX = preferLeft ? anchorRect.left - POPUP_WIDTH - 8 : anchorRect.right + 8;
  const x = Math.min(Math.max(8, rawX), Math.max(8, window.innerWidth - POPUP_WIDTH - 8));
  const y = Math.max(8, Math.min(anchorRect.top, window.innerHeight - POPUP_MAX_HEIGHT - 8));

  return createPortal(
    <div
      className="fixed z-[1000] pointer-events-none"
      style={{ left: x, top: y, maxWidth: `${POPUP_WIDTH}px` }}
    >
      <div className="w-52 rounded-lg overflow-hidden shadow-xl transition-all duration-300 pointer-events-auto">
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
