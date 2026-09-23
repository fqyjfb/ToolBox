import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { openUrl } from '../../services/browserService';

interface SearchBarProps {
  searchTypes: { id: string; name: string; url: string; placeholder: string }[];
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTypes }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchType, setActiveSearchType] = useState<string>('baidu');

  const performSearch = () => {
    const query = searchQuery.trim();
    if (!query) return;
    
    const currentSearchType = searchTypes.find(type => type.id === activeSearchType);
    if (!currentSearchType) return;
    
    if (currentSearchType.url) {
      const searchUrl = currentSearchType.url.replace('%s%', encodeURIComponent(query));
      openUrl(searchUrl);
    }
  };

  return (
    <div>
      <div className="max-w-2xl w-full mx-auto">
        <div className="flex flex-wrap gap-2 mb-2 justify-center">
          {searchTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                setActiveSearchType(type.id);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${activeSearchType === type.id ? 'bg-surface-secondary text-content-primary shadow-md' : 'bg-surface-secondary text-content-primary hover:bg-menu-hover'}`}
            >
              {type.name}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && performSearch()}
            placeholder={searchTypes.find(type => type.id === activeSearchType)?.placeholder || '搜索...'}
            className="w-full px-4 py-1.5 pl-10 rounded-full focus:outline-none bg-surface-50 text-content-primary backdrop-blur-sm transition-all duration-300 ease-in-out text-sm"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-content-secondary transition-all duration-300 ease-in-out" size={18} />
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
    </div>
  );
};

export default SearchBar;