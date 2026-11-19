import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/* eslint-disable react-refresh/only-export-components */
interface NavSearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearchActive: boolean;
  setIsSearchActive: (active: boolean) => void;
  performSearch: (query?: string) => void;
  clearSearch: () => void;
  handleSearch: (query: string) => void;
}

// 输入防抖：搜索框逐字输入不再每次触发页面查询/IPC。
// 输入框自身保留即时值，只有提交给消费者的 searchQuery/isSearchActive 被延迟。
const SEARCH_DEBOUNCE_MS = 300;

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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  useEffect(() => {
    cancelPending();
    setSearchQuery('');
    setIsSearchActive(false);
  }, [pathname, cancelPending]);

  useEffect(() => cancelPending, [cancelPending]);

  const performSearch = useCallback((query?: string) => {
    // 回车/点击搜索图标：取消未提交的防抖，用输入框当前值立即提交，避免刚输入就按 Enter 丢搜索
    cancelPending();
    const value = query ?? searchQuery;
    setSearchQuery(value);
    setIsSearchActive(Boolean(value.trim()));
  }, [searchQuery, cancelPending]);

  const clearSearch = useCallback(() => {
    cancelPending();
    setSearchQuery('');
    setIsSearchActive(false);
  }, [cancelPending]);

  const handleSearch = useCallback((query: string) => {
    cancelPending();
    // 清空即时生效，避免"清除了但输入框还显示旧词"的错觉
    if (!query.trim()) {
      setSearchQuery('');
      setIsSearchActive(false);
      return;
    }
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      setSearchQuery(query);
      setIsSearchActive(true);
    }, SEARCH_DEBOUNCE_MS);
  }, [cancelPending]);

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
