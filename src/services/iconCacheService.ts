class IconCacheService {
  private static CACHE_NAME = 'icon-cache-v1';
  private static MAX_ITEMS = 500;
  private static TTL = 7 * 24 * 60 * 60 * 1000;

  private isCacheApiAvailable(): boolean {
    return 'caches' in window;
  }

  async get(url: string): Promise<Response | null> {
    if (!this.isCacheApiAvailable() || !url) {
      return null;
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);
      const response = await cache.match(url);

      if (response) {
        const timestamp = response.headers.get('X-Cache-Timestamp');
        if (timestamp) {
          const age = Date.now() - parseInt(timestamp, 10);
          if (age > IconCacheService.TTL) {
            await cache.delete(url);
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

  async set(url: string, response: Response): Promise<void> {
    if (!this.isCacheApiAvailable() || !url || !response.ok) {
      return;
    }

    try {
      const cache = await caches.open(IconCacheService.CACHE_NAME);

      const headers = new Headers(response.headers);
      headers.set('X-Cache-Timestamp', Date.now().toString());

      const clonedResponse = new Response(await response.clone().blob(), {
        headers
      });

      await cache.put(url, clonedResponse);

      await this.enforceCacheLimits(cache);
    } catch {
      // Cache API may not be available in some environments
    }
  }

  private async enforceCacheLimits(cache: Cache): Promise<void> {
    try {
      const keys = await cache.keys();

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
      const keys = await cache.keys();

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
      const keys = await cache.keys();

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
}

export const iconCacheService = new IconCacheService();