import { websiteService } from './WebsiteService'
import type { Bookmark, Category } from '../types/website'

// NavPage 订阅与 App 启动预取必须共用同一份定义：
// queryKey 不一致时预取会落空，退化成两次独立请求。
const STALE_TIME = 5 * 60 * 1000
const GC_TIME = 10 * 60 * 1000

export const websiteCategoriesQuery = {
  queryKey: ['website_categories'],
  queryFn: (): Promise<Category[]> => websiteService.getCategories(),
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
}

export const websiteBookmarksQuery = {
  queryKey: ['website_bookmarks'],
  queryFn: (): Promise<Bookmark[]> => websiteService.getPublicBookmarks(),
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
}
