import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Tag, ChevronDown, RefreshCw } from 'lucide-react';
import { passwordService } from '../../../../services/PasswordService';
import { accountService } from '../../../../services/AccountService';
import { Password, PasswordCategory, PasswordRequest } from '../../../../types/password';
import { Email, Phone } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import SelectWithCustom from '../../../../components/SelectWithCustom';
import PasswordInput from '../../../../components/PasswordInput';
import { decrypt } from '../../../../utils/crypto';
import { logError } from '../../../../services/loggerService';

interface PasswordPanelProps {
  userId: string;
}

interface PasswordPanelRef {
  openModal: () => void;
}

const PasswordPanel = forwardRef<PasswordPanelRef, PasswordPanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);

  const [categories, setCategories] = useState<PasswordCategory[]>([]);
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<PasswordCategory | null>(null);
  const [editingItem, setEditingItem] = useState<Password | null>(null);

  const [categoryForm, setCategoryForm] = useState<{ name: string; parent_id: string | null }>({ name: '', parent_id: null });
  const [passwordForm, setPasswordForm] = useState<PasswordRequest>({
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

  useEffect(() => {
    loadCategories();
    loadEmails();
    loadPhones();
  }, []);

  const loadEmails = async () => {
    try {
      const result = await accountService.getEmails(userId, 1, 100);
      setEmails(result.list);
    } catch (error) {
      console.error('加载邮箱数据失败:', error);
    }
  };

  const loadPhones = async () => {
    try {
      const result = await accountService.getPhones(userId, 1, 100);
      setPhones(result.list);
    } catch (error) {
      console.error('加载手机数据失败:', error);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadPasswords(1);
  }, [selectedCategory]);

  useEffect(() => {
    if (currentPage > 1) {
      loadPasswords(currentPage);
    }
  }, [currentPage]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await passwordService.getCategories(userId);
      setCategories(response);
      const firstMainCategory = response.find(c => !c.parent_id);
      if (firstMainCategory && !selectedCategory) {
        setSelectedCategory(firstMainCategory.id);
        await loadPasswords(1, firstMainCategory.id, response);
      } else if (selectedCategory) {
        await loadPasswords(1, selectedCategory, response);
      } else {
        await loadPasswords(1);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      addToast({ message: '加载分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadPasswords = async (pageNum: number = 1, categoryId?: string | null, categoriesList?: PasswordCategory[]) => {
    try {
      setLoading(true);
      const currentCategories = categoriesList || categories;
      const currentCategoryId = categoryId !== undefined ? categoryId : selectedCategory;
      let result;

      if (currentCategoryId) {
        const collectCategoryIds = (category: PasswordCategory): string[] => {
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
        result = await passwordService.getPasswords(userId, categoryFilter, pageNum, pageSize);
      } else {
        result = await passwordService.getPasswords(userId, undefined, pageNum, pageSize);
      }

      setPasswords(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      console.error('加载账号列表失败:', error);
      addToast({ message: '加载账号失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string | null) => {
    setSelectedCategory(categoryId);
    setCurrentPage(1);
    loadPasswords(1, categoryId);
  };

  const openCategoryModal = (category: PasswordCategory | null = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, parent_id: category.parent_id });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', parent_id: null });
    }
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim()) return;
    try {
      setLoading(true);
      if (editingCategory) {
        await passwordService.updateCategory(editingCategory.id, categoryForm);
        addToast({ message: '分类更新成功', type: 'success' });
      } else {
        await passwordService.createCategory(userId, categoryForm);
        addToast({ message: '分类创建成功', type: 'success' });
      }
      await loadCategories();
      setShowCategoryModal(false);
    } catch (error) {
      console.error('保存分类失败:', error);
      addToast({ message: '保存分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      setLoading(true);
      await passwordService.deleteCategory(categoryId);
      await loadCategories();
      if (selectedCategory === categoryId) {
        setSelectedCategory(null);
      }
      addToast({ message: '分类删除成功', type: 'success' });
    } catch (error) {
      logError('删除分类失败', 'PasswordPanel', error as Error);
      addToast({ message: '删除分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    openModal: () => openItemModal(null)
  }));

  const openItemModal = async (item: Password | null = null) => {
    setEditingItem(item);
    const today = new Date().toISOString().split('T')[0];

    if (item) {
      let decryptedPassword = item.password;
      try { decryptedPassword = await decrypt(item.password); } catch { decryptedPassword = item.password; }
      setPasswordForm({
        category_id: item.category_id, name: item.name, url: item.url, username: item.username,
        password: decryptedPassword, email: item.email, phone: item.phone,
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
      setPasswordForm({
        category_id: defaultCategory || null, name: '', url: '', username: '', password: '',
        email: '', phone: '', security_question: '', date: today, status: 'active', notes: ''
      });
    }
    setShowItemModal(true);
  };

  const saveItem = async () => {
    if (!passwordForm.name.trim() || !passwordForm.password.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await passwordService.updatePassword(editingItem.id, passwordForm);
      } else {
        await passwordService.createPassword(userId, passwordForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadPasswords(1);
      setShowItemModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('保存失败:', error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      setLoading(true);
      await passwordService.deletePassword(id);
      addToast({ message: '删除成功', type: 'success' });
      await loadPasswords(currentPage);
    } catch (error) {
      logError('删除失败', 'PasswordPanel', error as Error);
      addToast({ message: '删除失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async (encryptedPassword: string) => {
    try {
      const decrypted = await decrypt(encryptedPassword);
      await navigator.clipboard.writeText(decrypted);
      addToast({ message: '密码已复制到剪贴板', type: 'success' });
    } catch (error) {
      console.error('复制密码失败:', error);
      addToast({ message: '复制密码失败', type: 'error' });
    }
  };

  const handleCopyText = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message, type: 'success' });
    } catch (error) {
      console.error('复制失败:', error);
      addToast({ message: '复制失败', type: 'error' });
    }
  };

  const handleSharePassword = async (password: Password) => {
    try {
      const decrypted = await decrypt(password.password);
      let shareContent = `${password.name}\n`;
      shareContent += password.url ? `网址: ${password.url}\n` : '';
      shareContent += password.username ? `用户名: ${password.username}\n` : '';
      shareContent += `密码: ${decrypted}\n`;
      shareContent += password.email ? `邮箱: ${password.email}\n` : '';
      shareContent += password.phone ? `手机号: ${password.phone}\n` : '';
      shareContent += password.security_question ? `密保: ${password.security_question}\n` : '';
      shareContent += password.notes ? `备注: ${password.notes}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '账号信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享账号失败', 'PasswordPanel', error as Error);
      addToast({ message: '分享账号失败', type: 'error' });
    }
  };

  const generatePassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPasswordForm(prev => ({ ...prev, password }));
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadPasswords(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    loadPasswords(1);
  };

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

  const findCategoryById = (catList: PasswordCategory[], targetId: string): PasswordCategory | undefined => {
    for (const cat of catList) {
      if (cat.id === targetId) return cat;
      if (cat.children) {
        const found = findCategoryById(cat.children, targetId);
        if (found) return found;
      }
    }
    return undefined;
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const password = passwords.find(p => p.id === contextMenu.targetId);
      if (!password) return [];

      return [
        { id: 'copy-username', label: '复制账号', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(password.username || '', '用户名已复制'); handleCloseContextMenu(); } },
        { id: 'copy-pwd', label: '复制密码', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyPassword(password.password); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: async () => { await openItemModal(password); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个账号吗？', () => handleDeleteItem(password.id)) }
      ];
    }

    if (contextMenu.type === 'category' && contextMenu.targetId) {
      const category = findCategoryById(categories, contextMenu.targetId);
      if (!category) return [];

      return [
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openCategoryModal(category); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => handleDeleteCategory(category.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-password', label: '添加账号', icon: <Plus className="w-4 h-4" />, onClick: async () => { await openItemModal(); handleCloseContextMenu(); } },
        { id: 'add-category', label: '添加分类', icon: <Tag className="w-4 h-4" />, onClick: () => { openCategoryModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, passwords, categories, handleCloseContextMenu, handleOpenConfirmDialog]);

  const renderCategoryNavbar = (cats: PasswordCategory[]) => {
    return cats.map(category => (
      <div key={category.id} className="relative z-10">
        <button
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
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            selectedCategory === category.id
              ? 'bg-gray-800 text-white dark:bg-gray-600 shadow-sm'
              : 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${getCategoryColor(category.name).dot}`}></div>
          <span>{category.name}</span>
          {category.children && category.children.length > 0 && (
            <ChevronDown className={`w-3 h-3 transition-transform ${expandedCategories.has(category.id) ? 'rotate-180' : ''}`} />
          )}
        </button>
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
    ));
  };

  const renderPasswordItem = (password: Password) => (
    <div key={password.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3" onContextMenu={(e) => handleContextMenu(e, 'item', password.id)}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="w-9 h-9 rounded-md bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {password.category_name && <span className={`mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getCategoryColor(password.category_name).bg} ${getCategoryColor(password.category_name).text}`}>{password.category_name}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {password.url ? <a href={password.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">{password.name}</a> : password.name}
            </h3>
            <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded-full ${password.status === 'active' ? 'bg-green-50 text-green-600' : password.status === 'inactive' ? 'bg-yellow-50 text-yellow-600' : 'bg-red-50 text-red-600'}`}>
              {password.status === 'active' ? '活跃' : password.status === 'inactive' ? '非活跃' : '已过期'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            {password.username && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">账号:</span><span className="text-gray-900 dark:text-white truncate max-w-[100px]">{password.username}</span><button onClick={(e) => { e.stopPropagation(); handleCopyText(password.username, '用户名已复制'); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制用户名"><Copy className="w-3 h-3" /></button></div>}
            {password.email && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">邮箱:</span><span className="text-gray-900 dark:text-white truncate max-w-[120px]">{password.email}</span><button onClick={(e) => { e.stopPropagation(); handleCopyText(password.email, '邮箱已复制'); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制邮箱"><Copy className="w-3 h-3" /></button></div>}
            {password.phone && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">手机:</span><span className="text-gray-900 dark:text-white">{password.phone}</span><button onClick={(e) => { e.stopPropagation(); handleCopyText(password.phone, '手机号已复制'); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制手机号"><Copy className="w-3 h-3" /></button></div>}
            {password.notes && <div className="flex items-center gap-1.5"><span className="font-medium text-gray-600 dark:text-gray-400">备注:</span><span className="text-gray-900 dark:text-white truncate max-w-[120px]">{password.notes}</span></div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); handleCopyPassword(password.password); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="复制密码">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleSharePassword(password); }} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="分享账号">
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
                    <div className="flex items-center gap-1 flex-wrap">
                      {renderCategoryNavbar(categories)}
                    </div>
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
        ) : passwords.length === 0 ? (
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
          passwords.map(renderPasswordItem)
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
                  setPasswordForm(prev => ({ ...prev, category_id: children[0].id }));
                } else {
                  setPasswordForm(prev => ({ ...prev, category_id: parentId }));
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
              value={passwordForm.category_id || ''} 
              onChange={(e) => setPasswordForm(prev => ({ ...prev, category_id: e.target.value || null }))} 
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
          <input type="text" value={passwordForm.name} onChange={(e) => setPasswordForm(prev => ({ ...prev, name: e.target.value }))} placeholder="网站名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <div className="grid grid-cols-2 gap-4">
            <input type="text" value={passwordForm.url} onChange={(e) => setPasswordForm(prev => ({ ...prev, url: e.target.value }))} placeholder="网站地址" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <PasswordInput
              value={passwordForm.password}
              onChange={(value) => setPasswordForm(prev => ({ ...prev, password: value }))}
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
            <input type="text" value={passwordForm.username} onChange={(e) => setPasswordForm(prev => ({ ...prev, username: e.target.value }))} placeholder="用户名" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <SelectWithCustom
              value={passwordForm.email}
              onChange={(value) => setPasswordForm(prev => ({ ...prev, email: value }))}
              options={emails.map(e => ({ id: e.id, label: e.email }))}
              placeholder="邮箱"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <SelectWithCustom
              value={passwordForm.phone}
              onChange={(value) => setPasswordForm(prev => ({ ...prev, phone: value }))}
              options={phones.map(p => ({ id: p.id, label: p.phone_number }))}
              placeholder="手机号"
            />
            <input type="date" value={passwordForm.date} onChange={(e) => setPasswordForm(prev => ({ ...prev, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <select value={passwordForm.status} onChange={(e) => setPasswordForm(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'expired' }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
            <option value="active">活跃</option>
            <option value="inactive">非活跃</option>
            <option value="expired">已过期</option>
          </select>
          <textarea value={passwordForm.security_question} onChange={(e) => setPasswordForm(prev => ({ ...prev, security_question: e.target.value }))} placeholder="安全问题及答案" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <textarea value={passwordForm.notes} onChange={(e) => setPasswordForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="备注" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />
    </div>
  );
});

export default PasswordPanel;