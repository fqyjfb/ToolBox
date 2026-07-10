import { useCallback, useRef, useEffect } from 'react';

export function useCallbackRef<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  dependencies: React.DependencyList
): T {
  const callbackRef = useRef<T>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback, ...dependencies]);

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
}