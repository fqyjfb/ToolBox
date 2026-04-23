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
    <div className="mb-6">
      <div className="max-w-2xl w-full mx-auto">
        <div className="flex flex-wrap gap-2 mb-2 justify-center">
          {searchTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => {
                setActiveSearchType(type.id);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${activeSearchType === type.id ? 'bg-gray-800 text-white dark:bg-white dark:text-gray-800 shadow-md' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
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
            className="w-full px-4 py-2 pl-10 border border-gray-300/50 dark:border-gray-600/50 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/80 bg-white/50 dark:bg-gray-800/50 dark:text-white backdrop-blur-sm transition-all duration-300 ease-in-out focus:shadow-lg focus:border-blue-400/50"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 transition-all duration-300 ease-in-out" size={16} />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-all duration-300 ease-in-out"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={performSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-300 ease-in-out"
          >
            <Search size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;