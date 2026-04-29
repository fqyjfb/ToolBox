export interface ToolInfo {
  id: string;
  name: string;
  path: string;
  color: string;
  iconName: string;
}

export const ALL_TOOLS: ToolInfo[] = [
  { id: 'todo', name: '待办事项', path: '/tools/todo', color: '#bc8acf', iconName: 'CheckSquare' },
  { id: 'quick-reply', name: '快捷回复', path: '/tools/quick-reply', color: '#e91e63', iconName: 'MessageSquare' },
  { id: 'cloud-clipboard', name: '云剪贴板', path: '/tools/cloud-clipboard', color: '#67aaf7', iconName: 'Clipboard' },
  { id: 'account', name: '账号管理', path: '/tools/account', color: '#00bcd4', iconName: 'Key' },
  { id: 'weather', name: '天气预报', path: '/tools/weather', color: '#3b82f6', iconName: 'Cloud' },
  { id: 'navigation', name: '导航', path: '/nav', color: '#4caf50', iconName: 'Navigation' },
  { id: 'news', name: '新闻', path: '/news', color: '#ff9800', iconName: 'Newspaper' },
  { id: 'exchange', name: '汇率换算', path: '/tools/exchange', color: '#f5a623', iconName: 'RefreshCw' },
  { id: 'translate', name: '在线翻译', path: '/tools/translate', color: '#3b82f6', iconName: 'Languages' },
  { id: 'country-code', name: '区号查询', path: '/tools/country-code', color: '#9c27b0', iconName: 'Phone' },
  { id: 'markdown-to-wechat', name: 'Markdown', path: '/tools/markdown-to-wechat', color: '#3b82f6', iconName: 'FileCode' },
  { id: 'ip-info', name: 'IP地址查询', path: '/tools/ip-info', color: '#06b6d4', iconName: 'Globe' },
  { id: 'emoji-remover', name: 'Emoji清理器', path: '/tools/emoji-remover', color: '#14b8a6', iconName: 'Smile' },
  { id: 'json-formatter', name: 'JSON格式化', path: '/tools/json-formatter', color: '#8b5cf6', iconName: 'Braces' },
  { id: 'timestamp-converter', name: '时间戳转换', path: '/tools/timestamp-converter', color: '#f5576c', iconName: 'Clock' },
  { id: 'case-converter', name: '大小写转换', path: '/tools/case-converter', color: '#4facfe', iconName: 'ArrowUpDown' },
  { id: 'hash-generator', name: '哈希生成器', path: '/tools/hash-generator', color: '#f97316', iconName: 'Hash' },
  { id: 'text-deduplicator', name: '文本去重', path: '/tools/text-deduplicator', color: '#ec4899', iconName: 'Copy' },
  { id: 'csv-to-json', name: 'CSV转JSON', path: '/tools/csv-to-json', color: '#10b981', iconName: 'Table' },
  { id: 'json-to-csv', name: 'JSON转CSV', path: '/tools/json-to-csv', color: '#34d399', iconName: 'Table' },
  { id: 'url-parser', name: 'URL解析器', path: '/tools/url-parser', color: '#0ea5e9', iconName: 'Link' },
  { id: 'sitemap-generator', name: 'Sitemap生成器', path: '/tools/sitemap-generator', color: '#84cc16', iconName: 'Map' },
  { id: 'qr-generator', name: '二维码生成器', path: '/tools/qr-generator', color: '#a855f7', iconName: 'QrCode' },
  { id: 'regex-tester', name: '正则测试器', path: '/tools/regex-tester', color: '#ef4444', iconName: 'Code' },
  { id: 'url-encode', name: 'URL编码解码', path: '/tools/url-encode', color: '#22d3ee', iconName: 'AtSign' },
  { id: 'meta-tags-generator', name: 'Meta标签生成', path: '/tools/meta-tags-generator', color: '#f43f5e', iconName: 'Tag' },
  { id: 'markdown-to-text', name: 'MD转纯文本', path: '/tools/markdown-to-text', color: '#2563eb', iconName: 'AlignLeft' },
  { id: 'html-to-text', name: 'HTML转纯文本', path: '/tools/html-to-text', color: '#1d4ed8', iconName: 'AlignLeft' },
  { id: 'sql-minifier', name: 'SQL压缩器', path: '/tools/sql-minifier', color: '#059669', iconName: 'Code2' },
  { id: 'hex-encode', name: 'HEX编码', path: '/tools/hex-encode', color: '#dc2626', iconName: 'Binary' },
  { id: 'hex-decode', name: 'HEX解码', path: '/tools/hex-decode', color: '#b91c1c', iconName: 'Binary' },
];
