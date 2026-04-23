import React, { useState, useEffect, useCallback } from 'react';
import { Clock, RefreshCw, Copy, Calendar } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';

const TimestampConverterPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [currentTimestamp, setCurrentTimestamp] = useState(Math.floor(Date.now() / 1000));
  const [timestampInput, setTimestampInput] = useState('');
  const [datetimeInput, setDatetimeInput] = useState('');
  const [dateResult, setDateResult] = useState<Array<{ label: string; value: string }>>([]);
  const [timestampResult, setTimestampResult] = useState<Array<{ label: string; value: string }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimestamp(Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (timestamp: number, ms: boolean = false): string => {
    const date = new Date(ms ? timestamp : timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const absDiff = Math.abs(diff);
    
    const seconds = Math.floor(absDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    let text;
    if (seconds < 60) text = `${seconds} 秒`;
    else if (minutes < 60) text = `${minutes} 分钟`;
    else if (hours < 24) text = `${hours} 小时`;
    else if (days < 30) text = `${days} 天`;
    else if (months < 12) text = `${months} 个月`;
    else text = `${years} 年`;

    return diff < 0 ? `${text}后` : `${text}前`;
  };

  const convertToDate = useCallback(() => {
    const input = timestampInput.trim();
    if (!input) {
      setDateResult([]);
      return;
    }

    const timestamp = parseInt(input);
    if (isNaN(timestamp)) {
      addToast({ message: '无效的时间戳', type: 'error' });
      return;
    }

    const isMs = timestamp > 1000000000000;
    const timestampSeconds = isMs ? Math.floor(timestamp / 1000) : timestamp;
    const timestampMs = isMs ? timestamp : timestamp * 1000;
    const date = new Date(timestampMs);

    setDateResult([
      { label: '日期时间 (秒)', value: formatDateTime(timestampSeconds, false) },
      { label: '日期时间 (毫秒)', value: formatDateTime(timestampMs, true) },
      { label: '时间戳 (秒)', value: timestampSeconds.toString() },
      { label: '时间戳 (毫秒)', value: timestampMs.toString() },
      { label: 'UTC 时间', value: date.toUTCString() },
      { label: 'ISO 8601', value: date.toISOString() },
      { label: '相对时间', value: getRelativeTime(timestampMs) }
    ]);
  }, [timestampInput, addToast]);

  const convertToTimestamp = useCallback(() => {
    const input = datetimeInput;
    if (!input) {
      setTimestampResult([]);
      return;
    }

    const date = new Date(input);
    const timestampSeconds = Math.floor(date.getTime() / 1000);
    const timestampMs = date.getTime();

    setTimestampResult([
      { label: '时间戳 (秒)', value: timestampSeconds.toString() },
      { label: '时间戳 (毫秒)', value: timestampMs.toString() },
      { label: '日期时间', value: formatDateTime(timestampMs, true) },
      { label: 'UTC 时间', value: date.toUTCString() },
      { label: 'ISO 8601', value: date.toISOString() }
    ]);
  }, [datetimeInput]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addToast({ message: '已复制', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [addToast]);

  const setTimestamp = useCallback((ts: number) => {
    setTimestampInput(ts.toString());
    convertToDate();
  }, [convertToDate]);

  const setCurrentDatetime = useCallback(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
    setDatetimeInput(localISOTime);
    convertToTimestamp();
  }, [convertToTimestamp]);

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center gap-3 mb-4">
        <Clock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Unix 时间戳转换</h2>
      </div>

      <div className="bg-gradient-to-r from-pink-500 to-red-500 rounded-lg p-4 mb-4 text-white">
        <div className="text-center">
          <div className="text-3xl font-bold font-mono mb-2">{currentTimestamp}</div>
          <div className="text-white/80">{formatDateTime(currentTimestamp, false)}</div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-auto">
        <div className="p-4">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">时间戳转日期时间</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                value={timestampInput}
                onChange={(e) => setTimestampInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && convertToDate()}
                placeholder="输入 Unix 时间戳 (秒或毫秒)"
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={convertToDate}
                className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                转换
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setTimestamp(Math.floor(Date.now() / 1000))}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                当前时间
              </button>
              <button
                onClick={() => setTimestamp(0)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                Unix 纪元
              </button>
              <button
                onClick={() => setTimestamp(Math.floor(Date.now() / 1000) + 86400)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                明天
              </button>
              <button
                onClick={() => setTimestamp(Math.floor(Date.now() / 1000) - 86400)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                昨天
              </button>
            </div>

            {dateResult.length > 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                {dateResult.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600 last:border-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-800 dark:text-gray-200">{item.value}</span>
                      <button
                        onClick={() => handleCopy(item.value)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        <Copy className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4">输入时间戳查看转换结果</div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">日期时间转时间戳</h3>
            <div className="flex gap-2 mb-4">
              <input
                type="datetime-local"
                value={datetimeInput}
                onChange={(e) => setDatetimeInput(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={convertToTimestamp}
                className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
              >
                <Clock className="w-4 h-4" />
                转换
              </button>
              <button
                onClick={setCurrentDatetime}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                当前
              </button>
            </div>

            {timestampResult.length > 0 ? (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                {timestampResult.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600 last:border-0">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-800 dark:text-gray-200">{item.value}</span>
                      <button
                        onClick={() => handleCopy(item.value)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        <Copy className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-400 py-4">选择日期时间查看转换结果</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimestampConverterPage;