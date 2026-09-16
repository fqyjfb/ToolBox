export const debounce = <T extends (...args: unknown[]) => void>(func: T, wait: number): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
};

export const throttle = <T extends (...args: unknown[]) => void>(func: T, delay: number): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, delay);
    }
  };
};

export const formatHotValue = (value: number | string): string => {
  if (typeof value === 'number') {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}w`;
    }
    return value.toString();
  }
  return value;
};

export { APP_VERSION, getVersion, parseVersion, compareVersions } from './version';
export { formatBytes } from './format';

const tagTranslations: Record<string, string> = {
  screenshot: '截图',
  capture: '捕获',
  annotation: '标注',
  text: '文本',
  editor: '编辑器',
  markdown: 'Markdown',
  code: '代码',
  converter: '转换',
  tool: '工具',
  utility: '实用',
  productivity: '生产力',
  image: '图片',
  video: '视频',
  audio: '音频',
  file: '文件',
  manager: '管理',
  browser: '浏览器',
  web: '网页',
  search: '搜索',
  translate: '翻译',
  language: '语言',
  calculator: '计算器',
  math: '数学',
  chart: '图表',
  data: '数据',
  analysis: '分析',
  calendar: '日历',
  time: '时间',
  todo: '待办',
  note: '笔记',
  writing: '写作',
  design: '设计',
  color: '颜色',
  palette: '调色板',
  qrcode: '二维码',
  scanner: '扫描',
  ocr: 'OCR',
  pdf: 'PDF',
  document: '文档',
  office: '办公',
  email: '邮件',
  chat: '聊天',
  ai: '人工智能',
  assistant: '助手',
  generator: '生成器',
  formatter: '格式化',
  validator: '验证',
  security: '安全',
  encrypt: '加密',
  decrypt: '解密',
  hash: '哈希',
  hex: '十六进制',
  base64: 'Base64',
  json: 'JSON',
  xml: 'XML',
  yaml: 'YAML',
  csv: 'CSV',
  table: '表格',
  regex: '正则',
  terminal: '终端',
  shell: 'Shell',
  network: '网络',
  ping: 'Ping',
  port: '端口',
  ip: 'IP',
  url: 'URL',
  link: '链接',
  download: '下载',
  upload: '上传',
  sync: '同步',
  backup: '备份',
  restore: '恢复',
  theme: '主题',
  dark: '深色',
  light: '浅色',
  font: '字体',
  icon: '图标',
  dashboard: '仪表盘',
  monitor: '监控',
  status: '状态',
  weather: '天气',
  forecast: '预报',
  news: '新闻',
  feed: '订阅',
  rss: 'RSS',
  finance: '金融',
  currency: '货币',
  exchange: '汇率',
  stock: '股票',
  crypto: '加密货币',
  wallet: '钱包',
  password: '密码',
  auth: '认证',
  login: '登录',
  session: '会话',
  token: '令牌',
  api: 'API',
  rest: 'REST',
  graphql: 'GraphQL',
  websocket: 'WebSocket',
  s3: 'S3',
  storage: '存储',
  cloud: '云',
  local: '本地',
  device: '设备',
  hardware: '硬件',
  system: '系统',
  os: '操作系统',
  windows: 'Windows',
  mac: 'Mac',
  linux: 'Linux',
  mobile: '移动端',
  desktop: '桌面',
  webapp: 'Web应用',
  plugin: '插件',
  extension: '扩展',
  integration: '集成',
  automation: '自动化',
  workflow: '工作流',
  shortcut: '快捷',
  hotkey: '热键',
  menu: '菜单',
  context: '上下文',
  clipboard: '剪贴板',
  history: '历史',
  bookmark: '书签',
  favorite: '收藏',
  recent: '最近',
  trending: '趋势',
  popular: '热门',
  new: '新',
  beta: '测试',
  experimental: '实验',
  dev: '开发',
  debug: '调试',
  log: '日志',
  trace: '追踪',
  error: '错误',
  warning: '警告',
  info: '信息',
  success: '成功',
  fail: '失败',
};

export const translateTag = (tag: string): string => {
  return tagTranslations[tag.toLowerCase()] || tag;
};