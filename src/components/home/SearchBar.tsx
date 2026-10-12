import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { openUrl } from '../../services/browserService';

interface SearchBarProps {
  searchTypes: { id: string; name: string; url: string; placeholder: string }[];
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTypes }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchType, setActiveSearchType] = useState<string>('baidu');
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const typeSwitcherRef = useRef<HTMLDivElement>(null);

  // 点击下拉区域外部时收起下拉菜单（不依赖遮罩层：fixed 遮罩会被带 transform 的祖先容器降级而覆盖不全）
  useEffect(() => {
    if (!isTypeOpen) return;
    const handleOutsideMouseDown = (e: MouseEvent) => {
      if (typeSwitcherRef.current && !typeSwitcherRef.current.contains(e.target as Node)) {
        setIsTypeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideMouseDown);
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown);
  }, [isTypeOpen]);

  const currentType = searchTypes.find(type => type.id === activeSearchType) || searchTypes[0];

  const performSearch = () => {
    const query = searchQuery.trim();
    if (!query || !currentType?.url) return;
    openUrl(currentType.url.replace('%s%', encodeURIComponent(query)));
  };

  return (
    <div className="max-w-[520px] w-full mx-auto">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && performSearch()}
          placeholder={currentType?.placeholder || '搜索...'}
          className="w-full px-4 py-1.5 pl-24 pr-10 rounded-full focus:outline-none bg-surface-50 text-content-primary backdrop-blur-sm transition-all duration-300 ease-in-out text-sm"
        />

        {/* 搜索引擎切换：下拉组合框内嵌到输入框左侧（原搜索图标位置） */}
        <div ref={typeSwitcherRef} className="absolute left-1 top-1/2 transform -translate-y-1/2 z-20">
          <button
            onClick={() => setIsTypeOpen(prev => !prev)}
            className="flex items-center justify-between gap-0.5 w-[84px] px-2 py-1 rounded-full text-xs font-medium text-content-secondary hover:bg-menu-hover transition-all duration-300 ease-in-out"
            title="切换搜索引擎"
          >
            <span className="truncate">{currentType?.name}</span>
            <ChevronDown size={12} className={`flex-shrink-0 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
          </button>

          {isTypeOpen && (
            <div className="absolute top-full left-0 mt-1 w-[84px] z-[70] bg-surface border border-content rounded-lg shadow-lg py-1">
                {searchTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      setActiveSearchType(type.id);
                      setIsTypeOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1 text-xs truncate transition-colors ${
                      type.id === activeSearchType
                        ? 'bg-surface-secondary text-content-primary font-medium'
                        : 'text-content-secondary hover:bg-menu-hover'
                    }`}
                  >
                    {type.name}
                  </button>
                ))}
            </div>
          )}
        </div>

        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-content-secondary hover:text-content-primary transition-all duration-300 ease-in-out"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
