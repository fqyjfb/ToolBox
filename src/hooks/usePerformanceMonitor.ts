import { useEffect, useRef, useState } from 'react';
import { logInfo } from '../services/loggerService';

interface PerformanceStats {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
}

export const usePerformanceMonitor = (componentName: string, enabled = true) => {
  const [stats, setStats] = useState<PerformanceStats>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
  });

  const lastTimestampRef = useRef<number>(0);
  const renderCountRef = useRef(0);
  const averageRenderTimeRef = useRef(0);
  const maxRenderTimeRef = useRef(0);

  useEffect(() => {
    lastTimestampRef.current = performance.now();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!enabled) return;

    const currentTime = performance.now();
    const renderTime = currentTime - lastTimestampRef.current;
    lastTimestampRef.current = currentTime;

    renderCountRef.current++;
    const count = renderCountRef.current;
    averageRenderTimeRef.current =
      (averageRenderTimeRef.current * (count - 1) + renderTime) / count;
    maxRenderTimeRef.current = Math.max(maxRenderTimeRef.current, renderTime);

    setStats({
      renderCount: count,
      lastRenderTime: renderTime,
      averageRenderTime: averageRenderTimeRef.current,
      maxRenderTime: maxRenderTimeRef.current,
    });

    if (renderTime > 100) {
      logInfo(
        `[Performance] ${componentName} render time exceeded 100ms: ${renderTime.toFixed(2)}ms`,
        'PerformanceMonitor'
      );
    }

    return () => {
      logInfo(
        `[Performance] ${componentName} unmounted - renders: ${count}, avg: ${averageRenderTimeRef.current.toFixed(2)}ms, max: ${maxRenderTimeRef.current.toFixed(2)}ms`,
        'PerformanceMonitor'
      );
    };
  });

  return stats;
};

export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};