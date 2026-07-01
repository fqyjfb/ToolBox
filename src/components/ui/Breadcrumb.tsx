import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  path: string;
  label: string;
  isActive?: boolean;
}

interface BreadcrumbProps {
  className?: string;
  customItems?: BreadcrumbItem[];
}

const routeLabelMap: Record<string, string> = {
  '/': '首页',
  '/launch': '快启动',
  '/news': '热点新闻',
  '/nav': '网址导航',
  '/tools': '工具中心',
  '/tools/exchange': '汇率换算',
  '/tools/cloud-clipboard': '云剪贴板',
  '/tools/quick-reply': '快捷回复',
  '/tools/todo': '待办事项',
  '/tools/memo': '备忘录',
  '/tools/country-code': '国家区号查询',
  '/tools/account': '账号管理',
  '/tools/weather': '天气预报',
  '/tools/translate': '在线翻译',
  '/tools/markdown-to-wechat': 'Markdown转微信',
  '/tools/ip-info': 'IP地址查询',
  '/tools/emoji-remover': 'Emoji清理器',
  '/tools/json-formatter': 'JSON格式化',
  '/tools/timestamp-converter': '时间戳转换',
  '/tools/case-converter': '大小写转换',
  '/tools/hash-generator': '哈希生成器',
  '/tools/text-deduplicator': '文本去重',
  '/tools/csv-to-json': 'CSV转JSON',
  '/tools/json-to-csv': 'JSON转CSV',
  '/tools/url-parser': 'URL解析',
  '/tools/sitemap-generator': '站点地图生成器',
  '/tools/qr-generator': '二维码生成器',
  '/tools/regex-tester': '正则表达式测试器',
  '/tools/url-encode': 'URL编码',
  '/tools/meta-tags-generator': '元标签生成器',
  '/tools/markdown-to-text': 'Markdown转文本',
  '/tools/html-to-text': 'HTML转文本',
  '/tools/sql-minifier': 'SQL压缩',
  '/tools/hex-encode': '十六进制编码',
  '/tools/hex-decode': '十六进制解码',
  '/tools/ocr': 'OCR文字识别',
  '/tools/file-manager': '文件管理',
  '/tools/profile': '个人信息',
  '/tools/notes': '记事本',
  '/tools/font-generator': '字体生成器',
  '/tools/ai-chat': 'AI助手',
  '/tools/ai-chat/history': '历史记录',
  '/tools/color-palette': '调色板',
  '/tools/ai-chat/roles': '角色预设',
  '/logs': '日志',
  '/admin': '管理控制台',
  '/admin/websites': '网址管理',
  '/admin/users': '用户管理',
  '/admin/tools': '工具管理',
  '/admin/database': '数据管理',
  '/settings': '设置',
  '/about': '关于',
  '/login': '登录'
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  className = '' 
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const generateBreadcrumbItems = (pathname: string): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];
    const pathSegments = pathname.split('/').filter(Boolean);
    
    let currentPath = '';
    
    items.push({ path: '/', label: routeLabelMap['/'] });
    
    for (let i = 0; i < pathSegments.length; i++) {
      currentPath += '/' + pathSegments[i];
      
      if (routeLabelMap[currentPath]) {
        items.push({
          path: currentPath,
          label: routeLabelMap[currentPath],
          isActive: i === pathSegments.length - 1
        });
      }
    }
    
    return items;
  };

  const items = generateBreadcrumbItems(location.pathname);

  const handleNavigate = (path: string, isActive: boolean | undefined) => {
    if (!isActive) {
      navigate(path);
    }
  };

  return (
    <nav 
      className={`flex items-center gap-1 ml-2 ${className}`}
      aria-label="面包屑导航"
    >
      {items.map((item, index) => (
        <React.Fragment key={item.path}>
          {index > 0 && (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
          <span
            className={`
              text-xs
              ${item.isActive
                ? 'text-gray-700 dark:text-gray-200 font-medium'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer'
              }
              transition-colors duration-200
            `}
            onClick={() => handleNavigate(item.path, item.isActive)}
          >
            {item.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;
