import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Search, ExternalLink, X, List, Check } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuthStore } from '../../store/AuthStore';
import { useToastStore } from '../../store/toastStore';
import { Category, Bookmark } from '../../types/website';
import { openUrl } from '../../services/browserService';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import ContextMenu from '../../components/ContextMenu';
import Switch from '../../components/Switch';
import CategoryManager, { CategoryItem } from '../../components/CategoryManager';
import linkIcon from '../../assets/react.svg';

const isForeignDomain = (url: string): boolean => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const domesticDomains = [
      '.cn', '.com.cn', '.net.cn', '.org.cn', '.gov.cn', '.edu.cn',
      '.hk', '.macau', '.tw'
    ];
    return !domesticDomains.some(suffix => hostname.endsWith(suffix));
  } catch {
    return true;
  }
};

const proxyImageUrl = (url: string): string => {
  const raw = (url || '').trim();
  if (!raw) return linkIcon;
  if (/^(data|blob):/i.test(raw)) return raw;
  if (isForeignDomain(raw)) {
    try {
      return `https://images.weserv.nl/?url=${encodeURIComponent(raw)}`;
    } catch {
      return raw;
    }
  }
  return raw;
};

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, originalUrl: string) => {
  const target = e.target as HTMLImageElement;
  if (target.src === originalUrl) {
    try {
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(originalUrl)}`;
      target.src = proxyUrl;
    } catch {
      try {
        target.src = `https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(originalUrl)}`;
      } catch {
        target.src = linkIcon;
      }
    }
  } else if (target.src.includes('images.weserv.nl')) {
    try {
      target.src = `https://proxy.duckduckgo.com/iu/?u=${encodeURIComponent(originalUrl)}`;
    } catch {
      target.src = linkIcon;
    }
  } else {
    target.src = linkIcon;
  }
};

const buildCategoryTree = (categories: any[]): Category[] => {
  const categoryMap = new Map<string, Category>();
  
  categories.forEach(category => {
    categoryMap.set(category.id, {
      id: category.id,
      name: category.name,
      parent_id: category.parent_id,
      order: category.order,
      children: [],
      created_at: category.created_at,
      updated_at: category.updated_at
    });
  });
  
  const rootCategories: Category[] = [];
  categories.forEach(category => {
    const categoryNode = categoryMap.get(category.id);
    if (categoryNode) {
      if (!category.parent_id) {
        rootCategories.push(categoryNode);
      } else {
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(categoryNode);
        }
      }
    }
  });
  
  const sortCategories = (cats: Category[]) => {
    cats.sort((a, b) => (a.order || 0) - (b.order || 0));
    cats.forEach(cat => sortCategories(cat.children));
  };
  
  sortCategories(rootCategories);
  return rootCategories;
};

const AdminWebsitesPage: React.FC = () => {
  const { isAuthenticated, getCurrentAdmin } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const [filteredBookmarks, setFilteredBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // 网址相关状态
  const [isAddBookmarkModalOpen, setIsAddBookmarkModalOpen] = useState(false);
  const [isEditBookmarkModalOpen, setIsEditBookmarkModalOpen] = useState(false);
  const [currentBookmark, setCurrentBookmark] = useState<Bookmark | null>(null);
  const [bookmarkFormData, setBookmarkFormData] = useState({
    title: '',
    url: '',
    description: '',
    category_id: '',
    is_public: true,
    order: 0,
    ico_url: ''
  });
  const [selectedMainCategory, setSelectedMainCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [bookmarkError, setBookmarkError] = useState('');
  
  // 删除确认对话框状态
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'bookmark' | 'category'>('bookmark');
  const [deleteTargetName, setDeleteTargetName] = useState('');
  
  // 分页相关状态
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    type: 'bookmark' | 'category'; 
    targetId?: string;
    targetData?: Bookmark | Category;
  } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (!isAuthenticated) {
        await getCurrentAdmin();
      }
    };
    checkAuth();
  }, [isAuthenticated, getCurrentAdmin]);

  const loadCategories = useCallback(async () => {
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .order('order', { ascending: true });
      
      if (categoriesError) {
        throw new Error('加载分类失败: ' + categoriesError.message);
      }
      
      const categoriesTree = buildCategoryTree(categoriesData || []);
      setCategories(categoriesTree);
      
      if (categoriesTree.length > 0 && !selectedCategory) {
        const firstMainCategory = categoriesTree[0];
        if (firstMainCategory.children.length > 0) {
          setSelectedMainCategory(firstMainCategory.id);
          setSelectedSubCategory(firstMainCategory.children[0].id);
          setBookmarkFormData(prev => ({
            ...prev,
            category_id: firstMainCategory.children[0].id
          }));
        }
      }
    } catch (err: any) {
      addToast({ message: err.message || '加载分类失败', type: 'error' });
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const getAllCategoryIds = (categoryId: string): string[] => {
    const categoryIds: string[] = [categoryId];
    const mainCategory = categories.find(cat => cat.id === categoryId);
    if (mainCategory && mainCategory.children) {
      mainCategory.children.forEach(child => {
        categoryIds.push(child.id);
      });
    }
    return categoryIds;
  };

  const loadData = async (currentPage: number = 1, currentPageSize: number = 10, searchTerm: string = '', categoryId: string | null = null, showLoading: boolean = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      
      let query = supabase.from('bookmarks').select('*');
      
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`);
      }
      
      if (categoryId) {
        const categoryIds = getAllCategoryIds(categoryId);
        query = query.in('category_id', categoryIds);
      }
      
      let countQuery = supabase.from('bookmarks').select('*', { count: 'exact', head: true });
      if (searchTerm) {
        countQuery = countQuery.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`);
      }
      if (categoryId) {
        const categoryIds = getAllCategoryIds(categoryId);
        countQuery = countQuery.in('category_id', categoryIds);
      }
      const { count, error: countError } = await countQuery;
      
      if (countError) {
        throw new Error('获取书签总数失败: ' + countError.message);
      }
      
      setTotal(count || 0);
      
      const { data: bookmarksData, error: bookmarksError } = await query
        .order('created_at', { ascending: false })
        .range((currentPage - 1) * currentPageSize, currentPage * currentPageSize - 1);
      
      if (bookmarksError) {
        throw new Error('加载书签失败: ' + bookmarksError.message);
      }
      
      setFilteredBookmarks(bookmarksData || []);
      setPage(currentPage);
      setPageSize(currentPageSize);
    } catch (err: any) {
      setBookmarkError(err.message || '加载数据失败');
      addToast({ message: err.message || '加载数据失败', type: 'error' });
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData(1, pageSize, '', null);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    loadData(1, pageSize, searchQuery, selectedCategory);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadData(newPage, pageSize, searchQuery, selectedCategory);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
    loadData(1, newPageSize, searchQuery, selectedCategory);
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setPage(1);
    loadData(1, pageSize, searchQuery, categoryId, false);
  };

  const getMainCategories = () => {
    return categories.filter(category => !category.parent_id);
  };

  const getSubCategories = (mainCategoryId: string) => {
    const mainCategory = categories.find(category => category.id === mainCategoryId);
    return mainCategory?.children || [];
  };

  const handleMainCategoryChange = (mainCategoryId: string) => {
    setSelectedMainCategory(mainCategoryId);
    const subCategories = getSubCategories(mainCategoryId);
    const firstSubCategory = subCategories[0];
    const subCategoryId = firstSubCategory?.id || '';
    setSelectedSubCategory(subCategoryId);
    setBookmarkFormData(prev => ({
      ...prev,
      category_id: subCategoryId
    }));
  };

  const handleSubCategoryChange = (subCategoryId: string) => {
    setSelectedSubCategory(subCategoryId);
    setBookmarkFormData(prev => ({
      ...prev,
      category_id: subCategoryId
    }));
  };

  const handleAddBookmark = () => {
    setCurrentBookmark(null);
    const mainCategories = getMainCategories();
    const firstMainCategory = mainCategories[0];
    const mainCategoryId = firstMainCategory?.id || '';
    const subCategories = getSubCategories(mainCategoryId);
    const firstSubCategory = subCategories[0];
    const subCategoryId = firstSubCategory?.id || '';
    
    setSelectedMainCategory(mainCategoryId);
    setSelectedSubCategory(subCategoryId);
    setBookmarkFormData({
      title: '',
      url: '',
      description: '',
      category_id: subCategoryId,
      is_public: true,
      order: 0,
      ico_url: ''
    });
    setBookmarkError('');
    setIsAddBookmarkModalOpen(true);
  };

  const handleEditBookmark = (bookmark: Bookmark) => {
    setCurrentBookmark(bookmark);
    setBookmarkFormData({
      title: bookmark.title,
      url: bookmark.url,
      description: bookmark.description,
      category_id: bookmark.category_id,
      is_public: bookmark.is_public,
      order: bookmark.order,
      ico_url: bookmark.ico_url || ''
    });
    
    let mainCategoryId = '';
    let subCategoryId = '';
    
    const findCategory = (categories: Category[]): Category | undefined => {
      for (const category of categories) {
        if (category.id === bookmark.category_id) {
          return category;
        }
        if (category.children && category.children.length > 0) {
          const found = findCategory(category.children);
          if (found) {
            mainCategoryId = category.id;
            subCategoryId = found.id;
            return found;
          }
        }
      }
      return undefined;
    };
    
    findCategory(categories);
    setSelectedMainCategory(mainCategoryId);
    setSelectedSubCategory(subCategoryId);
    setBookmarkError('');
    setIsEditBookmarkModalOpen(true);
  };

  const handleDeleteBookmark = (bookmarkId: string, bookmarkName: string) => {
    setDeleteTargetId(bookmarkId);
    setDeleteType('bookmark');
    setDeleteTargetName(bookmarkName);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    
    try {
      if (deleteType === 'bookmark') {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('id', deleteTargetId);
        
        if (error) {
          throw new Error('删除书签失败: ' + error.message);
        }
        addToast({ message: '删除成功', type: 'success' });
      } else {
        const { error: updateError } = await supabase
          .from('bookmarks')
          .update({ category_id: null })
          .eq('category_id', deleteTargetId);
        
        if (updateError) {
          throw new Error('更新书签分类失败: ' + updateError.message);
        }
        
        const { error: deleteError } = await supabase
          .from('categories')
          .delete()
          .eq('id', deleteTargetId);
        
        if (deleteError) {
          throw new Error('删除分类失败: ' + deleteError.message);
        }
        
        if (selectedCategory === deleteTargetId) {
          setSelectedCategory(null);
        }
        addToast({ message: '删除成功', type: 'success' });
      }
      
      if (deleteType === 'category') {
        await loadCategories();
      } else {
        loadData(page, pageSize, searchQuery, selectedCategory);
      }
    } catch (err: any) {
      addToast({ message: err.message || '删除失败', type: 'error' });
    }
    
    setIsDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  };

  const handleBookmarkTogglePublic = async (bookmarkId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('bookmarks')
        .update({ is_public: !currentState })
        .eq('id', bookmarkId);
      
      if (error) {
        throw new Error('更新公开状态失败: ' + error.message);
      }
      
      setFilteredBookmarks(prev => prev.map(bookmark => 
        bookmark.id === bookmarkId ? { ...bookmark, is_public: !currentState } : bookmark
      ));
      
      addToast({ message: `书签已${currentState ? '设为私有' : '设为公开'}`, type: 'success' });
    } catch (err: any) {
      addToast({ message: err.message || '更新失败', type: 'error' });
    }
  };

  const handleBookmarkInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as any;
    const newValue = type === 'checkbox' ? checked : value;
    
    setBookmarkFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  const handleBookmarkSubmit = async () => {
    if (!bookmarkFormData.title.trim() || !bookmarkFormData.url.trim() || !bookmarkFormData.category_id) {
      setBookmarkError('标题、网址和分类不能为空');
      return;
    }

    try {
      new URL(bookmarkFormData.url);
    } catch {
      setBookmarkError('请输入有效的URL地址');
      return;
    }

    try {
      if (isEditBookmarkModalOpen && currentBookmark) {
        const { error } = await supabase
          .from('bookmarks')
          .update({
            title: bookmarkFormData.title,
            url: bookmarkFormData.url,
            description: bookmarkFormData.description,
            category_id: bookmarkFormData.category_id,
            is_public: bookmarkFormData.is_public,
            order: bookmarkFormData.order,
            ico_url: bookmarkFormData.ico_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentBookmark.id);
        
        if (error) {
          throw new Error('更新书签失败: ' + error.message);
        }
        addToast({ message: '更新成功', type: 'success' });
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .insert({
            title: bookmarkFormData.title,
            url: bookmarkFormData.url,
            description: bookmarkFormData.description,
            category_id: bookmarkFormData.category_id,
            is_public: bookmarkFormData.is_public,
            order: bookmarkFormData.order,
            ico_url: bookmarkFormData.ico_url,
            user_id: null,
            is_favorite: false
          });
        
        if (error) {
          throw new Error('添加书签失败: ' + error.message);
        }
        addToast({ message: '添加成功', type: 'success' });
      }
      
      loadData(page, pageSize, searchQuery, selectedCategory);
      setIsAddBookmarkModalOpen(false);
      setIsEditBookmarkModalOpen(false);
      setBookmarkError('');
    } catch (err: any) {
      setBookmarkError(err.message || '保存书签失败');
      addToast({ message: err.message || '保存失败', type: 'error' });
    }
  };

  const handleAddCategory = async (name: string, parentId: string | null) => {
    try {
      const { error } = await supabase
        .from('categories')
        .insert({
          name: name.trim(),
          parent_id: parentId,
          order: 0
        });
      
      if (error) {
        throw new Error('添加分类失败: ' + error.message);
      }
      
      await loadCategories();
      addToast({ message: '添加成功', type: 'success' });
    } catch (err: any) {
      addToast({ message: err.message || '添加失败', type: 'error' });
    }
  };

  const handleUpdateCategory = async (categoryId: string, name: string) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', categoryId);
      
      if (error) {
        throw new Error('更新分类失败: ' + error.message);
      }
      
      await loadCategories();
      addToast({ message: '更新成功', type: 'success' });
    } catch (err: any) {
      addToast({ message: err.message || '更新失败', type: 'error' });
    }
  };

  const openBookmarkUrl = (url: string) => {
    openUrl(url);
  };

  const handleBookmarkContextMenu = useCallback((e: React.MouseEvent, bookmark: Bookmark) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ 
      x: e.clientX, 
      y: e.clientY, 
      type: 'bookmark', 
      targetId: bookmark.id, 
      targetData: bookmark 
    });
  }, []);

  const getCategoryName = (categoryId: string) => {
    const findCategory = (categories: Category[]): Category | undefined => {
      for (const category of categories) {
        if (category.id === categoryId) return category;
        if (category.children && category.children.length > 0) {
          const found = findCategory(category.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    
    const category = findCategory(categories);
    return category ? category.name : '未知分类';
  };

  const renderCategories = (cats: Category[], level: number = 0) => {
    return cats.map((category) => (
      <React.Fragment key={category.id}>
        <option value={category.id}>
          {'└─'.repeat(level)}{category.name}
        </option>
        {category.children && category.children.length > 0 && renderCategories(category.children, level + 1)}
      </React.Fragment>
    ));
  };

  const [activeTab, setActiveTab] = useState<'bookmarks' | 'categories'>('bookmarks');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('bookmarks')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'bookmarks'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                网址列表
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                  activeTab === 'categories'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                分类管理
              </button>
            </div>
            {activeTab === 'bookmarks' && (
              <div className="flex flex-col sm:flex-row sm:gap-2">
                <div className="relative max-w-[200px] w-full">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onKeyDown={handleKeyDown}
                    placeholder="搜索网址..."
                    className="w-full px-3 py-1.5 pr-24 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        loadData(1, pageSize, '', selectedCategory);
                      }}
                      className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      title="清空搜索"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={handleSearchSubmit}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    title="搜索"
                  >
                    <Search size={16} />
                  </button>
                </div>
                <button
                  onClick={handleAddBookmark}
                  className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
                  title="添加网址"
                >
                  <Plus size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {activeTab === 'bookmarks' ? (
            <div className="p-4">
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={`px-3 py-1 text-sm rounded-full transition-colors ${
                    !selectedCategory
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  全部
                </button>
                {categories.map(mainCategory => (
                  <button
                    key={mainCategory.id}
                    onClick={() => handleCategorySelect(mainCategory.id)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      selectedCategory === mainCategory.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {mainCategory.name}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        标题
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        分类
                      </th>
                      <th scope="col" className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        公开
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredBookmarks.map((bookmark) => (
                      <tr 
                        key={bookmark.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onContextMenu={(e) => handleBookmarkContextMenu(e, bookmark)}
                      >
                        <td className="px-4 py-3 sm:px-6">
                          <div className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1" onClick={() => openBookmarkUrl(bookmark.url)}>
                            {bookmark.title}
                            <ExternalLink size={14} />
                          </div>
                          <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                            {bookmark.description}
                          </div>
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {getCategoryName(bookmark.category_id)}
                          </div>
                        </td>
                        <td className="px-4 py-3 sm:px-6 whitespace-nowrap">
                          <Switch
                            checked={bookmark.is_public}
                            onChange={() => handleBookmarkTogglePublic(bookmark.id, bookmark.is_public)}
                          />
                        </td>
                      </tr>
                    ))}
                    {!isLoading && filteredBookmarks.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center">
                          <List className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                          <span className="text-gray-600 dark:text-gray-400">暂无数据</span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
                <Pagination
                  currentPage={page}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <CategoryManager
                categories={categories as CategoryItem[]}
                selectedCategory={null}
                onSelectCategory={() => {}}
                onAddCategory={handleAddCategory}
                onDeleteCategory={async (categoryId: string) => {
                  await supabase.from('categories').delete().eq('id', categoryId);
                  await loadCategories();
                  addToast({ message: '删除成功', type: 'success' });
                }}
                onUpdateCategory={handleUpdateCategory}
              />
            </div>
          )}
        </div>

        {/* 添加网址模态框 */}
        <Modal
          isOpen={isAddBookmarkModalOpen}
          onClose={() => setIsAddBookmarkModalOpen(false)}
          title="添加网址"
          confirmText="添加"
          onConfirm={handleBookmarkSubmit}
          size="lg"
        >
          {bookmarkError && (
            <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md mb-4">
              {bookmarkError}
            </div>
          )}
          <form className="space-y-4">
            <div className="flex items-center justify-between">
              <Switch
                checked={bookmarkFormData.is_public}
                onChange={(checked) => setBookmarkFormData(prev => ({ ...prev, is_public: checked }))}
                label="公开"
              />
              <div className="flex items-center gap-2">
                <label htmlFor="order" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  排序
                </label>
                <input
                  type="number"
                  id="order"
                  name="order"
                  value={bookmarkFormData.order}
                  onChange={handleBookmarkInputChange}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                网址
              </label>
              <input
                type="url"
                id="url"
                name="url"
                value={bookmarkFormData.url}
                onChange={handleBookmarkInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                分类
              </label>
              <div className="flex gap-3">
                <select
                  value={selectedMainCategory}
                  onChange={(e) => handleMainCategoryChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {getMainCategories().map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSubCategory}
                  onChange={(e) => handleSubCategoryChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                  disabled={!selectedMainCategory}
                >
                  {getSubCategories(selectedMainCategory).map((subCategory) => (
                    <option key={subCategory.id} value={subCategory.id}>
                      {subCategory.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                标题
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={bookmarkFormData.title}
                onChange={handleBookmarkInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                描述
              </label>
              <textarea
                id="description"
                name="description"
                value={bookmarkFormData.description}
                onChange={handleBookmarkInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="ico_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                图标 URL
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="url"
                  id="ico_url"
                  name="ico_url"
                  value={bookmarkFormData.ico_url}
                  onChange={handleBookmarkInputChange}
                  placeholder="可选，网站图标 URL"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <img
                  src={bookmarkFormData.ico_url ? proxyImageUrl(bookmarkFormData.ico_url) : linkIcon}
                  alt="图标预览"
                  className="w-10 h-10 rounded-md object-cover border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex-shrink-0"
                  onError={(e) => handleImageError(e, bookmarkFormData.ico_url || '')}
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* 编辑网址模态框 */}
        <Modal
          isOpen={isEditBookmarkModalOpen}
          onClose={() => setIsEditBookmarkModalOpen(false)}
          title="编辑网址"
          confirmText="保存"
          onConfirm={handleBookmarkSubmit}
          size="lg"
        >
          {bookmarkError && (
            <div className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-md mb-4">
              {bookmarkError}
            </div>
          )}
          <form className="space-y-4">
            <div className="flex items-center justify-between">
              <Switch
                checked={bookmarkFormData.is_public}
                onChange={(checked) => setBookmarkFormData(prev => ({ ...prev, is_public: checked }))}
                label="公开"
              />
              <div className="flex items-center gap-2">
                <label htmlFor="edit-order" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  排序
                </label>
                <input
                  type="number"
                  id="edit-order"
                  name="order"
                  value={bookmarkFormData.order}
                  onChange={handleBookmarkInputChange}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="edit-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                网址
              </label>
              <input
                type="url"
                id="edit-url"
                name="url"
                value={bookmarkFormData.url}
                onChange={handleBookmarkInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                分类
              </label>
              <div className="flex gap-3">
                <select
                  value={selectedMainCategory}
                  onChange={(e) => handleMainCategoryChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                >
                  {getMainCategories().map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSubCategory}
                  onChange={(e) => handleSubCategoryChange(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  required
                  disabled={!selectedMainCategory}
                >
                  {getSubCategories(selectedMainCategory).map((subCategory) => (
                    <option key={subCategory.id} value={subCategory.id}>
                      {subCategory.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                标题
              </label>
              <input
                type="text"
                id="edit-title"
                name="title"
                value={bookmarkFormData.title}
                onChange={handleBookmarkInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                描述
              </label>
              <textarea
                id="edit-description"
                name="description"
                value={bookmarkFormData.description}
                onChange={handleBookmarkInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="edit-ico_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                图标 URL
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="url"
                  id="edit-ico_url"
                  name="ico_url"
                  value={bookmarkFormData.ico_url}
                  onChange={handleBookmarkInputChange}
                  placeholder="可选，网站图标 URL"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <img
                  src={bookmarkFormData.ico_url ? proxyImageUrl(bookmarkFormData.ico_url) : linkIcon}
                  alt="图标预览"
                  className="w-10 h-10 rounded-md object-cover border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 flex-shrink-0"
                  onError={(e) => handleImageError(e, bookmarkFormData.ico_url || '')}
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* 删除确认对话框 */}
        <Modal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          title="确认删除"
          confirmText="删除"
          cancelText="取消"
          onConfirm={handleConfirmDelete}
          size="sm"
        >
          {deleteType === 'bookmark' ? (
            <p className="text-gray-700 dark:text-gray-300">
              确定要删除网址 <span className="text-red-600 dark:text-red-400 font-medium">{deleteTargetName}</span> 吗？
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                确定要删除分类 <span className="text-red-600 dark:text-red-400 font-medium">{deleteTargetName}</span> 吗？
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                删除后该分类下的网址将被移动到默认分类。
              </p>
            </div>
          )}
        </Modal>

        {/* 右键菜单 */}
        <ContextMenu
          isOpen={!!contextMenu}
          x={contextMenu?.x || 0}
          y={contextMenu?.y || 0}
          items={contextMenu?.type === 'bookmark' ? [
            {
              id: 'edit',
              label: '编辑',
              icon: <Edit size={16} />,
              onClick: () => {
                contextMenu?.targetData && handleEditBookmark(contextMenu.targetData as Bookmark);
                setContextMenu(null);
              }
            },
            {
              id: 'togglePublic',
              label: (contextMenu.targetData as Bookmark)?.is_public ? '设为私有' : '设为公开',
              icon: (contextMenu.targetData as Bookmark)?.is_public ? <Check size={16} /> : <X size={16} />,
              onClick: () => {
                const bookmark = contextMenu?.targetData as Bookmark;
                if (bookmark) {
                  handleBookmarkTogglePublic(bookmark.id, bookmark.is_public);
                }
                setContextMenu(null);
              }
            },
            {
              id: 'delete',
              label: '删除',
              icon: <Trash2 size={16} />,
              onClick: () => {
                contextMenu?.targetId && contextMenu?.targetData && handleDeleteBookmark(contextMenu.targetId, (contextMenu.targetData as Bookmark).title);
                setContextMenu(null);
              }
            }
          ] : []}
          onClose={() => setContextMenu(null)}
        />
      </div>
    </div>
  );
};

export default AdminWebsitesPage;