// React Query 的 queryKey 唯一定义处。
// 所有 queryKey 必须由此构造，禁止在页面里手写字符串数组：
// key 不一致会让 App 启动时的 prefetchQuery 落空、invalidateQueries 失效。
//
// 约定：
// - `xxx.all` 是该域的根前缀，仅用于整域失效；日常失效请用具体子 key。
// - `invalidateQueries` 是前缀匹配，子 key 必须足够具体，避免误伤同域其它查询。
//   例：tool.list() = ['tool','list'] 只匹配工具列表，不会误伤 tool.userDownloads()。

export const queryKeys = {
  website: {
    all: ['website'] as const,
    /** 全部分类（网站导航页与后台管理共用同一份缓存） */
    categories: () => [...queryKeys.website.all, 'categories'] as const,
    /** 公开书签（网站导航页） */
    bookmarks: () => [...queryKeys.website.all, 'bookmarks'] as const,
    /** 当前登录用户的收藏（首页收藏栏与网站导航页收藏视图共用） */
    favorites: () => [...queryKeys.website.all, 'favorites'] as const,
    /** 后台管理书签（分页 + 搜索 + 分类筛选，与公开书签是不同数据源） */
    adminBookmarks: () => [...queryKeys.website.all, 'adminBookmarks'] as const,
  },

  tool: {
    all: ['tool'] as const,
    /** 工具分类（后台管理与工具下载页共用同一份缓存） */
    categories: () => [...queryKeys.tool.all, 'categories'] as const,
    /** 后台管理工具列表（分页 + 搜索 + 分类筛选） */
    list: () => [...queryKeys.tool.all, 'list'] as const,
    /** 工具下载页列表（一次性拉取全量，与后台分页列表参数不同，单独成 key） */
    userDownloads: () => [...queryKeys.tool.all, 'userDownloads'] as const,
  },

  admin: {
    all: ['admin'] as const,
    /** 后台用户列表（分页 + 搜索 + 排序 + 筛选） */
    users: () => [...queryKeys.admin.all, 'users'] as const,
  },

  todo: {
    all: ['todo'] as const,
    /** 未完成待办数量（侧边栏徽标，30s 轮询） */
    pendingCount: (userId: string) => [...queryKeys.todo.all, 'pendingCount', userId] as const,
  },
};
