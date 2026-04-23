export const debounce = <T extends (...args: any[]) => any>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

export const formatHotValue = (value: number | string): string => {
  if (typeof value === 'number') {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}w`;
    }
    return value.toString();
  }
  return value;
};

export { APP_VERSION, getVersion, parseVersion, compareVersions } from './version';