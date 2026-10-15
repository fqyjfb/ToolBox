import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/* eslint-disable react-refresh/only-export-components */
interface NavSearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
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
  const { pathname } = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    setSearchQuery('');
    setIsSearchActive(false);
  }, [pathname]);

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

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      isSearchActive,
      setIsSearchActive,
      performSearch,
      clearSearch,
      handleSearch,
    }),
    [searchQuery, isSearchActive, performSearch, clearSearch, handleSearch]
  );

  return <NavSearchContext.Provider value={value}>{children}</NavSearchContext.Provider>;
};

export { NavSearchContext };