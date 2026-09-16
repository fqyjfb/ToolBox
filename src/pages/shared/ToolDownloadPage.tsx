import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, PackageOpen, Search, X } from 'lucide-react';
import toolService, { Tool } from '../../services/ToolService';
import { openUrl } from '../../services/browserService';
import CachedIcon from '../../components/ui/CachedIcon';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import './ToolDownloadPage.css';

const getBadgeClass = (driveType: Tool['网盘类型']): string => {
  switch (driveType) {
    case '夸克':
      return 'tool-download-badge tool-download-badge--quark';
    case '百度':
      return 'tool-download-badge tool-download-badge--baidu';
    default:
      return 'tool-download-badge tool-download-badge--other';
  }
};

const ToolDownloadPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['toolCategories'],
    queryFn: () => toolService.getCategories(),
  });

  const mainCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);

  const { data: toolsData, isLoading } = useQuery({
    queryKey: ['userToolDownloads', filterCategory],
    queryFn: () => toolService.getTools(filterCategory || undefined, undefined, 1, 1000),
  });

  const tools = useMemo(
    () =>
      (toolsData?.data || [])
        .filter((tool) => tool.is_active)
        .filter((tool) =>
          !searchTerm.trim() ? true : tool.title.toLowerCase().includes(searchTerm.trim().toLowerCase())
        ),
    [toolsData?.data, searchTerm]
  );

  const handleCategoryChange = (categoryId: string) => {
    setFilterCategory(categoryId);
  };

  const handleDownload = (tool: Tool) => {
    openUrl(tool.download_url);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">工具下载</h1>
        <div className="relative w-[200px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索工具..."
            className="w-full px-2 py-1 pr-7 border border-gray-200 dark:border-gray-500 rounded-md focus:outline-none focus:border-gray-300 dark:focus:border-gray-400 dark:bg-gray-600 dark:text-white text-xs"
          />
          <span className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="清空搜索"
              >
                <X size={12} />
              </button>
            ) : (
              <Search size={12} className="text-gray-400" />
            )}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => handleCategoryChange('')}
          className={`tool-download-category-btn ${!filterCategory ? 'tool-download-category-btn--active' : ''}`}
        >
          全部
        </button>
        {mainCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryChange(category.id)}
            className={`tool-download-category-btn ${filterCategory === category.id ? 'tool-download-category-btn--active' : ''}`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        ) : tools.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <PackageOpen className="w-10 h-10 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">暂无可下载的工具</p>
          </div>
        ) : (
          <div className="tool-download-grid">
            {tools.map((tool) => (
              <div key={tool.id} className="tool-download-card">
                <CachedIcon
                  src={tool.icon_url}
                  alt={tool.title}
                  name={tool.title}
                  className="tool-download-icon"
                  defaultIcon={<PackageOpen className="w-5 h-5 text-gray-400" />}
                />
                <div className="tool-download-info">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="tool-download-title">{tool.title}</span>
                    <span className={getBadgeClass(tool.网盘类型)}>{tool.网盘类型}</span>
                  </div>
                  <p className="tool-download-desc">{tool.description || '暂无描述'}</p>
                  {tool.category_name && (
                    <p className="tool-download-category">{tool.category_name}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDownload(tool)}
                  className="tool-download-btn flex-shrink-0 flex items-center gap-1"
                  title={`下载 ${tool.title}`}
                >
                  <Download className="w-3 h-3" />
                  下载
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolDownloadPage;
