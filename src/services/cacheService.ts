// 缓存服务
export interface CacheItem<T> {
  data: T;
  expiry: number;
  category?: string;
}

class CacheService {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
  }

  // 设置缓存（ttl 毫秒；category 供 clearByCategory 分类清理）
  set<T>(key: string, data: T, ttl: number, category?: string): void {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { data, expiry, category });
  }

  // 获取缓存：不存在或已过期返回 null（过期时顺带删除）
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  // 删除缓存
  delete(key: string): void {
    this.cache.delete(key);
  }

  // 清空所有缓存
  clear(): void {
    this.cache.clear();
  }

  // 按分类清空缓存
  clearByCategory(category: string): void {
    for (const [key, item] of this.cache.entries()) {
      if (item.category === category) {
        this.cache.delete(key);
      }
    }
  }

  // 清理过期缓存（每 5 分钟定时调用）
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // 销毁缓存服务（停止定时清理并清空）
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

// 导出单例
export const cacheService = new CacheService();