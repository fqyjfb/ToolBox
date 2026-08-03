import type { NetworkConfig } from '../types/network';

const DEFAULT_MAIN_URL = import.meta.env.VITE_HOTNEWS_API_URL || 'https://60s.viki.moe/v2';
const DEFAULT_FALLBACK_URL = import.meta.env.VITE_HOTNEWS_API_URL_FALLBACK || 'https://60s.mizhoubaobei.top/v2';

const isWebDev = !import.meta.env.VITE_ELECTRON && import.meta.env.DEV;

// 模块级缓存：首次调用时从主进程读 networkConfig.hotNews，setting-changed 时置 null
let cachedHotNews: NetworkConfig['hotNews'] | null = null;

const loadHotNewsConfig = async (): Promise<NetworkConfig['hotNews']> => {
  if (cachedHotNews) return cachedHotNews;
  if (window.electron) {
    try {
      const settings = await window.electron.getSettings();
      const nc = settings.find(s => s.name === 'networkConfig')?.value as NetworkConfig | undefined;
      if (nc?.hotNews) {
        cachedHotNews = nc.hotNews;
        return cachedHotNews;
      }
    } catch { /* 降级到默认 */ }
  }
  cachedHotNews = {
    primaryUrl: DEFAULT_MAIN_URL,
    fallbackUrl: DEFAULT_FALLBACK_URL,
    requestTimeout: 15000,
  };
  return cachedHotNews;
};

if (window.electron) {
  window.electron.onSettingChanged((setting) => {
    if (setting.name === 'networkConfig') cachedHotNews = null;
  });
}

const fetchWithUrl = async <T>(baseUrl: string, endpoint: string, options?: { signal?: AbortSignal }): Promise<T | null> => {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    signal: options?.signal,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  return await response.json() as T;
};

export const baseApi = {
  async fetch<T>(endpoint: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<T | null> {
    try {
      const cfg = await loadHotNewsConfig();
      const baseUrl = isWebDev ? '/api/news' : cfg.primaryUrl;
      let data = await fetchWithUrl<T>(baseUrl, endpoint, options);

      if (!data && cfg.fallbackUrl && cfg.fallbackUrl !== baseUrl) {
        data = await fetchWithUrl<T>(cfg.fallbackUrl, endpoint, options);
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }

      const cfg = cachedHotNews || { fallbackUrl: DEFAULT_FALLBACK_URL, primaryUrl: DEFAULT_MAIN_URL };
      const baseUrl = isWebDev ? '/api/news' : cfg.primaryUrl;
      if (cfg.fallbackUrl && cfg.fallbackUrl !== baseUrl) {
        try {
          return await fetchWithUrl<T>(cfg.fallbackUrl, endpoint, options);
        } catch {
          return null;
        }
      }

      return null;
    }
  }
};
