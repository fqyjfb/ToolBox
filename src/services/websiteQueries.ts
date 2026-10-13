import { websiteService } from './WebsiteService'
import type { Bookmark, Category } from '../types/website'
import { queryKeys } from '../queries/keys'

// NavPage 订阅与 App 启动预取必须共用同一份定义：
// queryKey 不一致时预取会落空，退化成两次独立请求。
const STALE_TIME = 5 * 60 * 1000
const GC_TIME = 10 * 60 * 1000

export const websiteCategoriesQuery = {
  queryKey: queryKeys.website.categories(),
  queryFn: (): Promise<Category[]> => websiteService.getCategories(),
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
}

export const websiteBookmarksQuery = {
  queryKey: queryKeys.website.bookmarks(),
  queryFn: (): Promise<Bookmark[]> => websiteService.getPublicBookmarks(),
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
}

// 当前登录用户的收藏。首页收藏栏与网站导航页收藏视图共用同一份缓存，
// 任一侧收藏/取消收藏后两侧同时生效。
//
// queryKey 不含 userId：getFavorites() 内部按 supabase session 取用户，
// 而 useAuthStore.user 在管理员登录时为 null，两者不是同一套来源，
// 用 user.id 拼接 key 会造成串号。改为「统一 key + 登出时移除缓存」，
// 由 AuthStore.logout 调用 removeQueries 保证账号隔离。
export const websiteFavoritesQuery = {
  queryKey: queryKeys.website.favorites(),
  queryFn: (): Promise<Bookmark[]> => websiteService.getFavorites(),
  staleTime: STALE_TIME,
  gcTime: GC_TIME,
}
