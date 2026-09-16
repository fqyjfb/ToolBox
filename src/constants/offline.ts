export const TABLE_LABELS: Record<string, string> = {
  todos: '待办事项',
  todo_categories: '待办分类',
  shops: '店铺',
  social_accounts: '社交账号',
  emails: '邮箱',
  phones: '电话',
  companies: '公司',
  credentials: '凭证',
  general_accounts: '通用账号',
  website_accounts: '网站账号',
  website_account_categories: '网站分类',
  quick_replies: '快捷回复',
  quick_reply_categories: '快捷回复分类',
  clipboard_items: '剪贴板',
  clipboard_categories: '剪贴板分类',
  memos: '备忘录',
  memo_categories: '备忘录分类',
};

export const getTableNameLabel = (tableName: string): string => TABLE_LABELS[tableName] || tableName;

export const getTimeAgo = (dateString: string): string => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return `${diffDays}天前`;
};
