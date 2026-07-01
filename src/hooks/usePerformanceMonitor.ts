import { useEffect, useRef } from 'react';
import { logInfo } from '../services/loggerService';

interface PerformanceStats {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  maxRenderTime: number;
}

export const usePerformanceMonitor = (componentName: string, enabled = true) => {
  const statsRef = useRef<PerformanceStats>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    maxRenderTime: 0,
  });

  const lastTimestampRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!enabled) return;

    const currentTime = performance.now();
    const renderTime = currentTime - lastTimestampRef.current;
    lastTimestampRef.current = currentTime;

    const stats = statsRef.current;
    stats.renderCount++;
    stats.lastRenderTime = renderTime;
    stats.averageRenderTime =
      (stats.averageRenderTime * (stats.renderCount - 1) + renderTime) / stats.renderCount;
    stats.maxRenderTime = Math.max(stats.maxRenderTime, renderTime);

    if (renderTime > 100) {
      logInfo(
        `[Performance] ${componentName} render time exceeded 100ms: ${renderTime.toFixed(2)}ms`,
        'PerformanceMonitor'
      );
    }

    return () => {
      logInfo(
        `[Performance] ${componentName} unmounted - renders: ${stats.renderCount}, avg: ${stats.averageRenderTime.toFixed(2)}ms, max: ${stats.maxRenderTime.toFixed(2)}ms`,
        'PerformanceMonitor'
      );
    };
  });

  return statsRef.current;
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

import { useState } from 'react';