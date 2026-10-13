import { QueryClient } from '@tanstack/react-query'

// 全局唯一的 QueryClient 实例。
// 独立成模块（而非定义在 QueryProvider.tsx 内）是为了让非组件代码也能操作缓存：
// 例如 AuthStore.logout 需要在登出时移除用户私有数据的查询缓存，
// 若从组件文件导出，store 层就会依赖 React 组件文件。
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
})
