import type { NetworkConfig } from '../types/network';
import { isElectron } from '../utils/environment';

// 60s 新闻 API 默认值（同时也是 web/手机端硬编码使用的地址）
const DEFAULT_PRIMARY_URL = 'https://60s.viki.moe/v2';
const DEFAULT_FALLBACK_URL = 'https://60s.mizhoubaobei.top/v2';

// Web 环境（含 web 端、手机端）通过同源代理规避 CORS；Electron 直接请求外部 API
// 使用运行时检测（window.electron / userAgent），不依赖构建变量
const isWebApp = !isElectron();
const WEB_PRIMARY_PROXY = '/api/news';
const WEB_FALLBACK_PROXY = '/api/news-fallback';

// 桌面端：模块级缓存，首次调用从主进程读 networkConfig.hotNews，setting-changed 时置 null
let cachedHotNews: NetworkConfig['hotNews'] | null = null;

const loadDesktopConfig = async (): Promise<{ primaryUrl: string; fallbackUrl: string }> => {
  if (cachedHotNews) {
    return {
      primaryUrl: cachedHotNews.primaryUrl || DEFAULT_PRIMARY_URL,
      fallbackUrl: cachedHotNews.fallbackUrl || DEFAULT_FALLBACK_URL,
    };
  }
  if (window.electron) {
    try {
      const settings = await window.electron.getSettings();
      const nc = settings.find(s => s.name === 'networkConfig')?.value as NetworkConfig | undefined;
      if (nc?.hotNews) {
        cachedHotNews = nc.hotNews;
        return {
          primaryUrl: nc.hotNews.primaryUrl || DEFAULT_PRIMARY_URL,
          fallbackUrl: nc.hotNews.fallbackUrl || DEFAULT_FALLBACK_URL,
        };
      }
    } catch { /* 降级到默认 */ }
  }
  return { primaryUrl: DEFAULT_PRIMARY_URL, fallbackUrl: DEFAULT_FALLBACK_URL };
};

if (window.electron) {
  window.electron.onSettingChanged((setting) => {
    if (setting.name === 'networkConfig') cachedHotNews = null;
  });
}

const fetchWithUrl = async <T>(baseUrl: string, endpoint: string, options?: { signal?: AbortSignal }): Promise<T | null> => {
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'GET',
      signal: options?.signal,
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
};

export const baseApi = {
  async fetch<T>(endpoint: string, options?: { signal?: AbortSignal; forceRefresh?: boolean }): Promise<T | null> {
    // Web/手机端：硬编码同源代理，主源失败自动切换备源（不走设置页同步）
    if (isWebApp) {
      const primary = await fetchWithUrl<T>(WEB_PRIMARY_PROXY, endpoint, options);
      if (primary) return primary;
      return await fetchWithUrl<T>(WEB_FALLBACK_PROXY, endpoint, options);
    }

    // 桌面端：使用用户设置（支持设置页更换），主源失败自动切换备源
    const cfg = await loadDesktopConfig();
    const primary = await fetchWithUrl<T>(cfg.primaryUrl, endpoint, options);
    if (primary) return primary;
    if (cfg.fallbackUrl && cfg.fallbackUrl !== cfg.primaryUrl) {
      return await fetchWithUrl<T>(cfg.fallbackUrl, endpoint, options);
    }
    return null;
  }
};
