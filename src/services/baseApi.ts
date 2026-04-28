const MAIN_URL = import.meta.env.VITE_HOTNEWS_API_URL || 'https://60s.viki.moe/v2';
const FALLBACK_URL = import.meta.env.VITE_HOTNEWS_API_URL_FALLBACK || 'https://60s.mizhoubaobei.top/v2';

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
      let data = await fetchWithUrl<T>(MAIN_URL, endpoint, options);
      
      if (!data && FALLBACK_URL && FALLBACK_URL !== MAIN_URL) {
        data = await fetchWithUrl<T>(FALLBACK_URL, endpoint, options);
      }
      
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return null;
      }
      
      if (FALLBACK_URL && FALLBACK_URL !== MAIN_URL) {
        try {
          return await fetchWithUrl<T>(FALLBACK_URL, endpoint, options);
        } catch {
          return null;
        }
      }
      
      return null;
    }
  }
};