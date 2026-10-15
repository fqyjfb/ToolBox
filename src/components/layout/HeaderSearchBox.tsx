import React from 'react';
import { useLocation } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { useNavSearch } from '../../contexts/NavSearchContext';
import { useIsCompactMode } from '../../store/windowModeStore';
import { isSearchRoute } from '../../constants/searchRoutes';

// 头部搜索框：原样抽取自 Content.tsx，非搜索路由渲染 null
const HeaderSearchBox: React.FC = () => {
  const location = useLocation();
  const { searchQuery, setSearchQuery, performSearch, clearSearch, handleSearch } = useNavSearch();
  // 小窗下标题栏宽度有限：搜索框占满可用宽度，不再用固定 224px/聚焦 256px 撑出横向溢出
  const isCompact = useIsCompactMode();

  if (!isSearchRoute(location.pathname)) return null;

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  return (
    <div className="relative">
      <input
        placeholder="搜索..."
        className={`border border-transparent focus:border-content px-4 py-1 rounded-xl outline-none bg-surface-60 text-content-primary placeholder-text-content-tertiary text-sm ${
          isCompact ? 'w-full' : 'w-56 transition-[width] duration-300 focus:w-64'
        }`}
        name="search"
        type="search"
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && performSearch()}
        style={{ height: '28px' } as React.CSSProperties}
      />
      {searchQuery && (
        <button onClick={clearSearch} className="absolute right-9 top-1/2 transform -translate-y-1/2 text-content-secondary hover:text-content-primary transition-all duration-300 ease-in-out">
          <X size={14} />
        </button>
      )}
      <button onClick={performSearch} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-secondary hover:text-content-primary transition-all duration-300 ease-in-out">
        <Search size={16} />
      </button>
    </div>
  );
};

export default HeaderSearchBox;
