import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type SearchPageType = 'cloud-clipboard' | 'quick-reply' | 'todo' | 'account' | null;

interface NavSearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  currentPage: SearchPageType;
  setCurrentPage: (page: SearchPageType) => void;
  performSearch: () => void;
  clearSearch: () => void;
  handleSearch: (query: string) => void;
}

const NavSearchContext = createContext<NavSearchContextType | undefined>(undefined);

export const useNavSearch = () => {
  const context = useContext(NavSearchContext);
  if (!context) {
    throw new Error('useNavSearch must be used within a NavSearchProvider');
  }
  return context;
};

interface NavSearchProviderProps {
  children: ReactNode;
}

export const NavSearchProvider = ({ children }: NavSearchProviderProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [currentPage, setCurrentPage] = useState<SearchPageType>(null);

  const performSearch = useCallback(() => {
    if (searchQuery.trim()) {
      setIsSearchActive(true);
    }
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchActive(false);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setIsSearchActive(true);
    } else {
      setIsSearchActive(false);
    }
  }, []);

  return (
    <NavSearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        isSearchActive,
        setIsSearchActive,
        currentPage,
        setCurrentPage,
        performSearch,
        clearSearch,
        handleSearch,
      }}
    >
      {children}
    </NavSearchContext.Provider>
  );
};

export { NavSearchContext };