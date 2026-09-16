export type IconCacheType = 'general' | 'plugin' | 'app';

class IconCacheService {
  private static CACHE_NAME = 'icon-cache-v1';
  private static MAX_ITEMS = 500;
  private static TTL = 7 * 24 * 60 * 60 * 1000;

  private isCacheApiAvailable(): boolean {
    return 'caches' in window;
  }

  private toCacheKey(url: string, type: IconCacheType = 'general'): string {
    return `https://icon-cache.local/${type}/${encodeURIComponent(url)}`;
  }

  private fromCacheKey(key: string): { url: string; type: IconCacheType } {
    const match = key.match(/^https:\/\/icon-cache\.local\/(plugin|app|general)\/(.+)/);
    if (match) {
      return { url: decodeURIComponent(match[2]), type: match[1] as IconCacheType };
    }
    return { url: key, type: 'general' };
  }

  async get(url: string, type: IconCacheType = 'general'): Promise<Response | null> {
    if (!this.isCacheApiAvailable() || !url) {
      return null;
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);
      const cacheKey = this.toCacheKey(url, type);
      const response = await cache.match(cacheKey);

      if (response) {
        const timestamp = response.headers.get('X-Cache-Timestamp');
        if (timestamp) {
          const age = Date.now() - parseInt(timestamp, 10);
          if (age > IconCacheService.TTL) {
            await cache.delete(cacheKey);
            return null;
          }
        }
        return response.clone();
      }
    } catch {
      // Cache API may not be available in some environments
    }

    return null;
  }

  async set(url: string, response: Response, type: IconCacheType = 'general'): Promise<void> {
    if (!this.isCacheApiAvailable() || !url || !response.ok) {
      return;
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);

      const headers = new Headers(response.headers);
      headers.set('X-Cache-Timestamp', Date.now().toString());
      headers.set('X-Cache-Type', type);

      const clonedResponse = new Response(await response.clone().blob(), {
        headers
      });

      const cacheKey = this.toCacheKey(url, type);
      await cache.put(cacheKey, clonedResponse);

      await this.enforceCacheLimits(cache);
    } catch {
    }
  }

  async setFromDataUrl(key: string, dataUrl: string, type: IconCacheType = 'app'): Promise<void> {
    if (!this.isCacheApiAvailable() || !key || !dataUrl) {
      return;
    }

    try {
      const response = await fetch(dataUrl);
      if (!response.ok) return;

      const cache = await caches.open(IconCacheService.CACHE_NAME);
      const headers = new Headers(response.headers);
      headers.set('X-Cache-Timestamp', Date.now().toString());
      headers.set('X-Cache-Type', type);

      const blob = await response.clone().blob();
      const cachedResponse = new Response(blob, { headers });

      const cacheKey = this.toCacheKey(key, type);
      await cache.put(cacheKey, cachedResponse);

      await this.enforceCacheLimits(cache);
    } catch {
    }
  }

  async getOrFetch(url: string, type: IconCacheType = 'general', fetchFn: () => Promise<Response>): Promise<Response> {
    const cached = await this.get(url, type);
    if (cached) {
      return cached;
    }

    const response = await fetchFn();
    if (response.ok) {
      await this.set(url, response.clone(), type);
    }
    return response;
  }

  private async getAllCacheKeys(cache: Cache): Promise<string[]> {
    const requests = await cache.keys();
    return requests.map(req => req.url);
  }

  private async enforceCacheLimits(cache: Cache): Promise<void> {
    try {
      const keys = await this.getAllCacheKeys(cache);

      const sortedKeys = await Promise.all(
        keys.map(async (key) => {
          const response = await cache.match(key);
          const timestamp = response?.headers.get('X-Cache-Timestamp');
          return { key, timestamp: timestamp ? parseInt(timestamp, 10) : 0 };
        })
      );

      sortedKeys.sort((a, b) => a.timestamp - b.timestamp);

      while (sortedKeys.length > IconCacheService.MAX_ITEMS) {
        const oldest = sortedKeys.shift();
        if (oldest) {
          await cache.delete(oldest.key);
        }
      }
    } catch {
      // Cache API may not be available in some environments
    }
  }

  async clearExpired(): Promise<void> {
    if (!this.isCacheApiAvailable()) {
      return;
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);
      const keys = await this.getAllCacheKeys(cache);

      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const timestamp = response.headers.get('X-Cache-Timestamp');
          if (timestamp) {
            const age = Date.now() - parseInt(timestamp, 10);
            if (age > IconCacheService.TTL) {
              await cache.delete(key);
            }
          }
        }
      }
    } catch {
      // Cache API may not be available in some environments
    }
  }

  async clearByType(type: IconCacheType): Promise<void> {
    if (!this.isCacheApiAvailable()) {
      return;
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);
      const keys = await this.getAllCacheKeys(cache);

      for (const key of keys) {
        const parsed = this.fromCacheKey(key);
        if (parsed.type === type) {
          await cache.delete(key);
        }
      }
    } catch {
      // Cache API may not be available in some environments
    }
  }

  async clearAll(): Promise<void> {
    if (!this.isCacheApiAvailable()) {
      return;
    }

    try {
      await caches.delete(IconCacheService.CACHE_NAME);
    } catch {
      // Cache API may not be available in some environments
    }
  }

  async getStats(): Promise<{ count: number; size: number }> {
    if (!this.isCacheApiAvailable()) {
      return { count: 0, size: 0 };
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);
      const keys = await this.getAllCacheKeys(cache);

      let totalSize = 0;
      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }

      return { count: keys.length, size: totalSize };
    } catch {
      return { count: 0, size: 0 };
    }
  }

  async getStatsByType(): Promise<Record<IconCacheType, { count: number; size: number }>> {
    if (!this.isCacheApiAvailable()) {
      return { general: { count: 0, size: 0 }, plugin: { count: 0, size: 0 }, app: { count: 0, size: 0 } };
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);
      const keys = await this.getAllCacheKeys(cache);

      const stats: Record<IconCacheType, { count: number; size: number }> = {
        general: { count: 0, size: 0 },
        plugin: { count: 0, size: 0 },
        app: { count: 0, size: 0 },
      };

      for (const key of keys) {
        const response = await cache.match(key);
        if (response) {
          const { type } = this.fromCacheKey(key);
          const blob = await response.blob();
          stats[type].count++;
          stats[type].size += blob.size;
        }
      }

      return stats;
    } catch {
      return { general: { count: 0, size: 0 }, plugin: { count: 0, size: 0 }, app: { count: 0, size: 0 } };
    }
  }
}

export const iconCacheService = new IconCacheService();
