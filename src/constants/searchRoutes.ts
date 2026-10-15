/** 头部搜索路由清单：Content 与 CompactTitleBar 共用（原内聚于 Content.tsx 的 showSearch） */
export const SEARCH_ROUTES = ['/launch', '/nav', '/tools/country-code', '/tools/exchange', '/tools/cloud-clipboard', '/tools/quick-reply', '/tools/todo', '/tools/memo', '/tools/account', '/tools/profile', '/tools/plugin-store', '/tools/offline-tools', '/admin/websites', '/admin/users', '/admin/tools'];

export const isSearchRoute = (pathname: string): boolean => SEARCH_ROUTES.includes(pathname);
