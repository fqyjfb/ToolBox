import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Tag, ChevronDown, RefreshCw, ExternalLink, Eye } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { websiteAccountService } from '../../../../services/WebsiteAccountService';
import { accountService } from '../../../../services/AccountService';
import { WebsiteAccount, WebsiteAccountCategory, WebsiteAccountRequest } from '../../../../types/websiteAccount';
import { Email, Phone } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import PreviewModal from '../../../../components/ui/PreviewModal';
import SelectWithCustom from '../../../../components/forms/SelectWithCustom';
import PasswordInput from '../../../../components/forms/PasswordInput';
import { logError } from '../../../../services/loggerService';
import { openUrl } from '../../../../services/browserService';
import { localStorageService, STORAGE_KEYS } from '../../../../services/localStorageService';

const findCategoryById = (catList: WebsiteAccountCategory[], targetId: string): WebsiteAccountCategory | undefined => {
  for (const cat of catList) {
    if (cat.id === targetId) return cat;
    if (cat.children) {
      const found = findCategoryById(cat.children, targetId);
      if (found) return found;
    }
  }
  return undefined;
};

interface WebsitePanelProps {
  userId: string;
}

interface WebsitePanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const SortableCategoryItem: React.FC<{ 
  category: WebsiteAccountCategory; 
  isActive: boolean; 
  isExpanded: boolean;
  onClick: (e: React.MouseEvent) => void; 
  onContextMenu: (e: React.MouseEvent) => void;
  getCategoryColor: (name: string) => { bg: string; text: string; dot: string };
}> = ({ category, isActive, isExpanded, onClick, onContextMenu, getCategoryColor }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
    scale: isDragging ? 1.05 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative z-10 cursor-grab active:cursor-grabbing"
    >
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gray-800 text-white dark:bg-gray-600 shadow-sm'
            : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(category.name).dot}`}></div>
        <span>{category.name}</span>
        {category.children && category.children.length > 0 && (
          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        )}
      </button>
    </div>
  );
};

const WebsitePanel = forwardRef<WebsitePanelRef, WebsitePanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [categories, setCategories] = useState<WebsiteAccountCategory[]>([]);
  const [accounts, setAccounts] = useState<WebsiteAccount[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<WebsiteAccount | null>(null);
  const [editingCategory, setEditingCategory] = useState<WebsiteAccountCategory | null>(null);
  const [editingItem, setEditingItem] = useState<WebsiteAccount | null>(null);

  const [categoryForm, setCategoryForm] = useState<{ name: string; parent_id: string | null }>({ name: '', parent_id: null });
  const [accountForm, setAccountForm] = useState<WebsiteAccountRequest>({
    category_id: null, name: '', url: '', username: '', password: '',
    email: '', phone: '', security_question: '', date: '', status: 'active', notes: ''
  });

  const [selectedParentCategory, setSelectedParentCategory] = useState<string | null>(null);

  const [emails, setEmails] = useState<Email[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.category-dropdown-container')) {
        setExpandedCategories(new Set());
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleCategoriesDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCategories(prev => {
        const newCategories = arrayMove(prev, prev.findIndex(cat => cat.id === active.id), prev.findIndex(cat => cat.id === over.id));
        
        const mainCategoryIds = newCategories
          .filter(cat => cat.parent_id === null)
          .map(cat => cat.id);
        
        localStorageService.set(`${STORAGE_KEYS.WEBSITE_ACCOUNT_CATEGORY_ORDER}_${userId}`, mainCategoryIds);
        
        return newCategories;
      });
    }
  }, [userId]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'category' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const categoryColors = [
    { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
    { bg: 'bg-green-50', text: 'text-green-600', dot: 'bg-green-500' },
    { bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-500' },
    { bg: 'bg-pink-50', text: 'text-pink-600', dot: 'bg-pink-500' },
    { bg: 'bg-yellow-50', text: 'text-yellow-600', dot: 'bg-yellow-500' },
    { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500' },
    { bg: 'bg-cyan-50', text: 'text-cyan-600', dot: 'bg-cyan-500' },
    { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
    { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
    { bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-500' },
  ];

  const getCategoryColor = (categoryName: string) => {
    const hash = categoryName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return categoryColors[hash % categoryColors.length];
  };

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await websiteAccountService.getCategories(userId);
      
      const savedOrder = localStorageService.get<string[]>(`${STORAGE_KEYS.WEBSITE_ACCOUNT_CATEGORY_ORDER}_${userId}`, []);
      let sortedCategories = response;
      
      if (savedOrder.length > 0) {
        const sortedMainCategories: WebsiteAccountCategory[] = [];
        const remainingMainCategories: WebsiteAccountCategory[] = [...response];
        
        for (const id of savedOrder) {
          const index = remainingMainCategories.findIndex(c => c.id === id);
          if (index !== -1) {
            sortedMainCategories.push(remainingMainCategories.splice(index, 1)[0]);
          }
        }
        
        sortedCategories = [...sortedMainCategories, ...remainingMainCategories];
      }
      
      setCategories(sortedCategories);
    } catch (error) {
      logError('加载分类失败', 'WebsitePanel', error as Error);
      addToast({ message: '加载分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, addToast]);

  const loadEmails = useCallback(async () => {
    try {
      const result = await accountService.getEmails(userId, 1, 100);
      setEmails(result.list);
    } catch (error) {
      logError('加载邮箱数据失败', 'WebsitePanel', error as Error);
    }
  }, [userId]);

  const loadPhones = useCallback(async () => {
    try {
      const result = await accountService.getPhones(userId, 1, 100);
      setPhones(result.list);
    } catch (error) {
      logError('加载手机数据失败', 'WebsitePanel', error as Error);
    }
  }, [userId]);

  useEffect(() => {
    loadCategories();
    loadEmails();
    loadPhones();
  }, [loadCategories, loadEmails, loadPhones]);

  const loadAccounts = useCallback(async (pageNum: number = 1, categoryId?: string | null, categoriesList?: WebsiteAccountCategory[]) => {
    try {
      setLoading(true);
      let result;

      if (isSearchActive && searchQuery.trim()) {
        result = await websiteAccountService.searchAccounts(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        const currentCategories = categoriesList || categories;
        const currentCategoryId = categoryId !== undefined ? categoryId : selectedCategory;

        if (currentCategoryId) {
          const collectCategoryIds = (category: WebsiteAccountCategory): string[] => {
            const ids: string[] = [category.id];
            if (category.children && category.children.length > 0) {
              for (const child of category.children) {
                ids.push(...collectCategoryIds(child));
              }
            }
            return ids;
          };

          const category = findCategoryById(currentCategories, currentCategoryId);
          const categoryFilter = category ? collectCategoryIds(category) : undefined;
          result = await websiteAccountService.getAccounts(userId, categoryFilter, pageNum, pageSize);
        } else {
          result = await websiteAccountService.getAccounts(userId, undefined, pageNum, pageSize);
        }
      }

      setAccounts(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载账号列表失败', 'WebsitePanel', error as Error);
      addToast({ message: '加载账号失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, isSearchActive, searchQuery, categories, selectedCategory, pageSize, addToast]);

  useEffect(() => {
    if (categories.length > 0) {
      loadAccounts(1);
    }
  }, [categories, selectedCategory, loadAccounts]);

  useEffect(() => {
    if (currentPage > 1 && categories.length > 0) {
      loadAccounts(currentPage);
    }
  }, [currentPage, categories, loadAccounts]);

  useEffect(() => {
    if (categories.length > 0) {
      setCurrentPage(1);
      loadAccounts(1);
    }
  }, [searchQuery, isSearchActive, categories, loadAccounts]);

  const handleCategorySelect = useCallback((categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    loadAccounts(1, categoryId);
  }, [loadAccounts]);

  const openCategoryModal = useCallback((category: WebsiteAccountCategory | null = null, parentCategory: WebsiteAccountCategory | null = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, parent_id: category.parent_id });
    } else if (parentCategory) {
      setEditingCategory(null);
      setCategoryForm({ name: '', parent_id: parentCategory.id });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', parent_id: null });
    }
    setShowCategoryModal(true);
  }, []);

  const saveCategory = useCallback(async () => {
    if (!categoryForm.name.trim()) return;
    try {
      setLoading(true);
      if (editingCategory) {
        await websiteAccountService.updateCategory(userId, editingCategory.id, categoryForm);
        addToast({ message: '分类更新成功', type: 'success' });
      } else {
        await websiteAccountService.createCategory(userId, categoryForm);
        addToast({ message: '分类创建成功', type: 'success' });
      }
      await loadCategories();
      setShowCategoryModal(false);
    } catch (error) {
      logError('保存分类失败', 'WebsitePanel', error as Error);
      addToast({ message: '保存分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [categoryForm, editingCategory, userId, loadCategories, addToast]);

  const handleDeleteCategory = useCallback(async (categoryId: string) => {
    try {
      setLoading(true);
      await websiteAccountService.deleteCategory(userId, categoryId);
      await loadCategories();
      if (selectedCategory === categoryId) {
        setSelectedCategory(null);
      }
      addToast({ message: '分类删除成功', type: 'success' });
    } catch (error) {
      logError('删除分类失败', 'WebsitePanel', error as Error);
      addToast({ message: '删除分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, loadCategories, selectedCategory, addToast]);

  useImperativeHandle(ref, () => ({
    openModal: () => openItemModal(null),
    setVisibleColumns: () => {}
  }));

  const openItemModal = useCallback((item: WebsiteAccount | null = null) => {
    setEditingItem(item);
    const today = new Date().toISOString().split('T')[0];

    if (item) {
      setAccountForm({
        category_id: item.category_id, name: item.name, url: item.url, username: item.username,
        password: item.password, email: item.email, phone: item.phone,
        security_question: item.security_question, date: item.date, status: item.status, notes: item.notes
      });
      const itemCategory = findCategoryById(categories, item.category_id || '');
      if (itemCategory) {
        if (itemCategory.parent_id) {
          const parentCat = findCategoryById(categories, itemCategory.parent_id);
          setSelectedParentCategory(parentCat?.id || null);
        } else {
          setSelectedParentCategory(itemCategory.id);
        }
      } else {
        setSelectedParentCategory(null);
      }
    } else {
      const mainCategories = categories.filter(c => !c.parent_id);
      const defaultCategory = mainCategories.length > 0 ? mainCategories[0].id : null;
      setSelectedParentCategory(defaultCategory);
      setAccountForm({
        category_id: defaultCategory || null, name: '', url: '', username: '', password: '',
        email: '', phone: '', security_question: '', date: today, status: 'active', notes: ''
      });
    }
    setShowItemModal(true);
  }, [categories]);

  const saveItem = useCallback(async () => {
    if (!accountForm.name.trim() || !accountForm.password.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await websiteAccountService.updateAccount(userId, editingItem.id, accountForm);
      } else {
        await websiteAccountService.createAccount(userId, accountForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadAccounts(1);
      setShowItemModal(false);
      setEditingItem(null);
    } catch (error) {
      logError('保存失败', 'WebsitePanel', error as Error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [accountForm, editingItem, userId, loadAccounts, addToast]);

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await websiteAccountService.deleteAccount(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadAccounts(currentPage);
    } catch (error) {
      logError('删除失败', 'WebsitePanel', error as Error);
      addToast({ message: '删除失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, loadAccounts, currentPage, addToast]);

  const handleCopyPassword = useCallback(async (password: string) => {
    try {
      await navigator.clipboard.writeText(password);
      addToast({ message: '密码已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('复制密码失败', 'WebsitePanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleCopyText = useCallback(async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message, type: 'success' });
    } catch (error) {
      logError('复制失败', 'WebsitePanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleSharePassword = useCallback(async (account: WebsiteAccount) => {
    try {
      let shareContent = `${account.name}\n`;
      shareContent += account.url ? `网址: ${account.url}\n` : '';
      shareContent += account.username ? `用户名: ${account.username}\n` : '';
      shareContent += `密码: ${account.password}\n`;
      shareContent += account.email ? `邮箱: ${account.email}\n` : '';
      shareContent += account.phone ? `手机号: ${account.phone}\n` : '';
      shareContent += account.security_question ? `密保: ${account.security_question}\n` : '';
      shareContent += account.notes ? `备注: ${account.notes}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '账号信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享账号失败', 'WebsitePanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleRowClick = useCallback((account: WebsiteAccount) => {
    setPreviewItem(account);
    setShowPreviewModal(true);
  }, []);

  const generatePassword = useCallback(() => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setAccountForm(prev => ({ ...prev, password }));
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    loadAccounts(newPage);
  }, [loadAccounts]);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    loadAccounts(1);
  }, [loadAccounts]);

  const handleOpenConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  }, []);

  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'item' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, type, targetId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const account = accounts.find(p => p.id === contextMenu.targetId);
      if (!account) return [];

      return [
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(account); handleCloseContextMenu(); } },
        { id: 'copy-username', label: '复制账号', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(account.username || '', '用户名已复制'); handleCloseContextMenu(); } },
        { id: 'copy-pwd', label: '复制密码', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyPassword(account.password); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: async () => { await openItemModal(account); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个账号吗？', () => handleDeleteItem(account.id)) }
      ];
    }

    if (contextMenu.type === 'category' && contextMenu.targetId) {
      const category = findCategoryById(categories, contextMenu.targetId);
      if (!category) return [];

      return [
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openCategoryModal(category); handleCloseContextMenu(); } },
        { id: 'add-subcategory', label: '添加子分类', icon: <Plus className="w-4 h-4" />, onClick: () => { openCategoryModal(null, category); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => handleDeleteCategory(category.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-account', label: '添加账号', icon: <Plus className="w-4 h-4" />, onClick: async () => { await openItemModal(); handleCloseContextMenu(); } },
        { id: 'add-category', label: '添加分类', icon: <Tag className="w-4 h-4" />, onClick: () => { openCategoryModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, accounts, categories, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyPassword, handleCopyText, handleDeleteCategory, handleDeleteItem, openItemModal, openCategoryModal, handleRowClick]);

  const renderAccountItem = (account: WebsiteAccount) => (
    <div key={account.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" onClick={() => handleRowClick(account)} onContextMenu={(e) => handleContextMenu(e, 'item', account.id)}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {account.category_name && <span className={`mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getCategoryColor(account.category_name).bg} ${getCategoryColor(account.category_name).text}`}>{account.category_name}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {account.url ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); openUrl(account.url); }}
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline transition-colors truncate"
                  title="点击打开网站"
                >
                  <span className="truncate">{account.name}</span>
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </button>
              ) : account.name}
            </h3>
            <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${account.status === 'active' ? 'bg-green-50 text-green-600' : account.status === 'inactive' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
              {account.status === 'active' ? '活跃' : account.status === 'inactive' ? '非活跃' : '已过期'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            {account.username && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">账号:</span><span className="text-gray-900 dark:text-white truncate max-w-[100px]">{account.username}</span><button onClick={(e) => { e.stopPropagation(); handleCopyText(account.username, '用户名已复制'); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制用户名"><Copy className="w-3 h-3" /></button></div>}
            {account.email && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">邮箱:</span><span className="text-gray-900 dark:text-white truncate max-w-[120px]">{account.email}</span><button onClick={(e) => { e.stopPropagation(); handleCopyText(account.email, '邮箱已复制'); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制邮箱"><Copy className="w-3 h-3" /></button></div>}
            {account.phone && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">手机:</span><span className="text-gray-900 dark:text-white">{account.phone}</span><button onClick={(e) => { e.stopPropagation(); handleCopyText(account.phone, '手机号已复制'); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制手机号"><Copy className="w-3 h-3" /></button></div>}
            {account.notes && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">备注:</span><span className="text-gray-900 dark:text-white truncate max-w-[120px]">{account.notes}</span></div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); handleCopyPassword(account.password); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制密码">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleSharePassword(account); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="分享账号">
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col" onClick={handleCloseContextMenu}>
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex-1 category-dropdown-container relative">
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => handleCategorySelect(null)} className={`text-xs px-2.5 py-1 rounded-full transition-colors flex-shrink-0 ${selectedCategory === null ? 'bg-gray-800 text-white dark:bg-gray-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                    全部
                  </button>
                  {categories.length === 0 ? (
                    <div className="text-xs text-gray-400">暂无分类</div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleCategoriesDragEnd}
                    >
                      <SortableContext items={categories.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                        <div className="flex items-center gap-1 flex-wrap">
                          {categories.map(category => (
                            <div key={category.id} className="relative">
                              <SortableCategoryItem
                                category={category}
                                isActive={selectedCategory === category.id}
                                isExpanded={expandedCategories.has(category.id)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (category.children && category.children.length > 0) {
                                    const isExpanded = expandedCategories.has(category.id);
                                    const newExpanded = new Set<string>();
                                    if (!isExpanded) {
                                      newExpanded.add(category.id);
                                    }
                                    setExpandedCategories(newExpanded);
                                  }
                                  handleCategorySelect(category.id);
                                }}
                                onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
                                getCategoryColor={getCategoryColor}
                              />
                              {category.children && category.children.length > 0 && expandedCategories.has(category.id) && (
                                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10 min-w-[120px] py-1">
                                  {category.children.map(child => (
                                    <button
                                      key={child.id}
                                      onClick={() => {
                                        handleCategorySelect(child.id);
                                        setExpandedCategories(new Set());
                                      }}
                                      onContextMenu={(e) => handleContextMenu(e, 'category', child.id)}
                                      className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-xs transition-colors ${
                                        selectedCategory === child.id
                                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      <div className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(child.name).dot}`}></div>
                                      <span>{child.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openCategoryModal()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full transition-colors">
              <Tag size={14} />
              添加分类
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无网站账号</p>
          </div>
        ) : (
          accounts.map(renderAccountItem)
        )}
      </div>

      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 mt-4">
        <Pagination currentPage={currentPage} total={total} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />
      </div>

      <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title={editingCategory ? '编辑分类' : '添加分类'} confirmText="保存" onConfirm={saveCategory}>
        <div className="space-y-3">
          <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))} placeholder="分类名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <Modal isOpen={showItemModal} onClose={() => { setShowItemModal(false); setEditingItem(null); }} title={editingItem ? '编辑网站账号' : '添加网站账号'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <select 
              value={selectedParentCategory || ''} 
              onChange={(e) => {
                const parentId = e.target.value || null;
                setSelectedParentCategory(parentId);
                const parentCategory = categories.find(c => c.id === parentId);
                const children = parentCategory?.children || [];
                if (children.length > 0) {
                  setAccountForm(prev => ({ ...prev, category_id: children[0].id }));
                  } else {
                    setAccountForm(prev => ({ ...prev, category_id: parentId }));
                  }
              }} 
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">选择主分类</option>
              {categories.filter(c => !c.parent_id).map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select 
              value={accountForm.category_id || ''} 
              onChange={(e) => setAccountForm(prev => ({ ...prev, category_id: e.target.value || null }))} 
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="">选择子分类</option>
              {selectedParentCategory && (() => {
                const parentCategory = categories.find(c => c.id === selectedParentCategory);
                if (parentCategory && parentCategory.children && parentCategory.children.length > 0) {
                  return parentCategory.children.map(child => (
                    <option key={child.id} value={child.id}>{child.name}</option>
                  ));
                } else {
                  return null;
                }
              })()}
            </select>
          </div>
          <input type="text" value={accountForm.name} onChange={(e) => setAccountForm(prev => ({ ...prev, name: e.target.value }))} placeholder="网站名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" value={accountForm.url} onChange={(e) => setAccountForm(prev => ({ ...prev, url: e.target.value }))} placeholder="网站地址" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <PasswordInput
              value={accountForm.password}
              onChange={(value) => setAccountForm(prev => ({ ...prev, password: value }))}
              placeholder="密码"
              extraButton={
                <button
                  onClick={generatePassword}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  title="生成密码"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="text" value={accountForm.username} onChange={(e) => setAccountForm(prev => ({ ...prev, username: e.target.value }))} placeholder="用户名" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <SelectWithCustom
              value={accountForm.email}
              onChange={(value) => setAccountForm(prev => ({ ...prev, email: value }))}
              options={emails.map(e => ({ id: e.id, label: e.email }))}
              placeholder="邮箱"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectWithCustom
              value={accountForm.phone}
              onChange={(value) => setAccountForm(prev => ({ ...prev, phone: value }))}
              options={phones.map(p => ({ id: p.id, label: p.phone_number }))}
              placeholder="手机号"
            />
            <input type="date" value={accountForm.date} onChange={(e) => setAccountForm(prev => ({ ...prev, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <select value={accountForm.status} onChange={(e) => setAccountForm(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'expired' }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
            <option value="active">活跃</option>
            <option value="inactive">非活跃</option>
            <option value="expired">已过期</option>
          </select>
          <textarea value={accountForm.security_question} onChange={(e) => setAccountForm(prev => ({ ...prev, security_question: e.target.value }))} placeholder="安全问题及答案" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <textarea value={accountForm.notes} onChange={(e) => setAccountForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="备注" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.name || '网站账号详情'}
      />
    </div>
  );
});

export default WebsitePanel;