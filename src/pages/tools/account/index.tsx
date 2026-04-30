import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, Copy, Eye, EyeOff, ChevronDown, ChevronRight, Key, Share2, Tag, ExternalLink } from 'lucide-react';
import { passwordService } from '../../../services/PasswordService';
import { Password, PasswordCategory, PasswordRequest, PasswordCategoryRequest } from '../../../types/password';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import Pagination from '../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../components/ui/ContextMenu';
import { decrypt } from '../../../utils/crypto';

const AccountManagerPage: React.FC = () => {
  const navigate = useNavigate();
  const admin = useAuthStore((state) => state.admin);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [categories, setCategories] = useState<PasswordCategory[]>([]);
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<PasswordCategory | null>(null);
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [categoryForm, setCategoryForm] = useState<PasswordCategoryRequest>({ name: '', parent_id: null });
  const [passwordForm, setPasswordForm] = useState<PasswordRequest>({
    category_id: null,
    name: '',
    url: '',
    username: '',
    password: '',
    email: '',
    phone: '',
    security_question: '',
    date: '',
    status: 'active',
    notes: ''
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [parentCategoryId, setParentCategoryId] = useState<string>('');
  const [childCategoryId, setChildCategoryId] = useState<string>('');

  const getChildCategories = (parentId: string): PasswordCategory[] => {
    const findCategory = (catList: PasswordCategory[]): PasswordCategory | undefined => {
      for (const cat of catList) {
        if (cat.id === parentId) return cat;
        if (cat.children) {
          const found = findCategory(cat.children);
          if (found) return found;
        }
      }
      return undefined;
    };
    const category = findCategory(categories);
    return category?.children || [];
  };

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    type: 'item' | 'category' | 'empty';
    targetId?: string;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
    type: 'empty'
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const getCategoryColor = (categoryName: string): string => {
    const colorMap: Record<string, string> = {
      '工作': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      '个人': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      '财务': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      '社交': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
      '娱乐': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      '购物': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      '邮箱': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
      '开发': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      '教育': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
      '医疗': 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    };
    const hash = categoryName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = Object.values(colorMap);
    return colorMap[categoryName] || colors[hash % colors.length];
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (admin) {
      loadCategories();
    }
  }, [admin]);

  const loadCategories = async () => {
    if (!admin) return;
    try {
      setLoading(true);
      const response = await passwordService.getCategories(admin.id);
      setCategories(response);
      if (response.length > 0 && !selectedCategory) {
        setSelectedCategory(response[0].id);
      }
    } catch (error) {
      console.error('加载账号分类失败:', error);
      addToast({ message: '加载分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (admin) {
      setCurrentPage(1);
      loadPasswords(1);
    }
  }, [admin, selectedCategory, selectedStatus]);

  useEffect(() => {
    if (admin) {
      loadPasswords(currentPage);
    }
  }, [pageSize]);

  useEffect(() => {
    if (admin) {
      setCurrentPage(1);
      loadPasswords(1);
    }
  }, [searchQuery, isSearchActive]);

  const loadPasswords = async (pageNum: number = 1) => {
    if (!admin) return;
    try {
      setLoading(true);
      let result;

      if (isSearchActive && searchQuery.trim()) {
        result = await passwordService.searchPasswords(admin.id, searchQuery.trim(), pageNum, pageSize);
      } else {
        let categoryFilter: string | string[] | undefined = undefined;
        if (selectedCategory) {
          const collectCategoryIds = (category: PasswordCategory): string[] => {
            const ids: string[] = [category.id];
            if (category.children && category.children.length > 0) {
              for (const child of category.children) {
                ids.push(...collectCategoryIds(child));
              }
            }
            return ids;
          };

          const findCategory = (catList: PasswordCategory[], id: string): PasswordCategory | undefined => {
            for (const cat of catList) {
              if (cat.id === id) return cat;
              if (cat.children) {
                const found = findCategory(cat.children, id);
                if (found) return found;
              }
            }
            return undefined;
          };

          const category = findCategory(categories, selectedCategory);
          if (category) {
            categoryFilter = collectCategoryIds(category);
          }
        }

        result = await passwordService.getPasswords(admin.id, categoryFilter, selectedStatus, pageNum, pageSize);
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
  };

  const handleStatusSelect = (status: string) => {
    setSelectedStatus(status === selectedStatus ? '' : status);
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const [parentCatId, setParentCatId] = useState<string | null>(null);

  const openCategoryModal = (category: PasswordCategory | null = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ name: category.name, parent_id: category.parent_id });
      setParentCatId(category.parent_id);
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: '', parent_id: null });
      setParentCatId(null);
    }
    setShowCategoryModal(true);
  };

  const saveCategory = async () => {
    if (!admin || !categoryForm.name.trim()) return;
    try {
      setLoading(true);
      if (editingCategory) {
        await passwordService.updateCategory(editingCategory.id, categoryForm);
        addToast({ message: '分类更新成功', type: 'success' });
      } else {
        await passwordService.createCategory(admin.id, categoryForm);
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
      console.error('删除分类失败:', error);
      addToast({ message: '删除分类失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openPasswordModal = async (password: Password | null = null) => {
    if (password) {
      setEditingPassword(password);
      let decryptedPassword = password.password;
      try {
        decryptedPassword = await decrypt(password.password);
      } catch {
        decryptedPassword = password.password;
      }
      
      let parentId = '';
      let childId = '';
      if (password.category_id) {
        const findCategoryInfo = (catList: PasswordCategory[], targetId: string): { parentId: string; isChild: boolean } => {
          for (const cat of catList) {
            if (cat.id === targetId) {
              return { parentId: cat.parent_id || '', isChild: !!cat.parent_id };
            }
            if (cat.children) {
              const found = findCategoryInfo(cat.children, targetId);
              if (found.parentId || found.isChild) {
                return found;
              }
            }
          }
          return { parentId: '', isChild: false };
        };
        const info = findCategoryInfo(categories, password.category_id);
        if (info.isChild) {
          parentId = info.parentId;
          childId = password.category_id;
        } else {
          parentId = password.category_id;
          childId = '';
        }
      }
      
      setParentCategoryId(parentId);
      setChildCategoryId(childId);
      
      setPasswordForm({
        category_id: password.category_id,
        name: password.name,
        url: password.url,
        username: password.username,
        password: decryptedPassword,
        email: password.email,
        phone: password.phone,
        security_question: password.security_question,
        date: password.date,
        status: password.status,
        notes: password.notes
      });
    } else {
      setEditingPassword(null);
      const today = new Date().toISOString().split('T')[0];
      setParentCategoryId('');
      setChildCategoryId('');
      setPasswordForm({
        category_id: selectedCategory || null,
        name: '',
        url: '',
        username: '',
        password: '',
        email: '',
        phone: '',
        security_question: '',
        date: today,
        status: 'active',
        notes: ''
      });
    }
    setShowPasswordModal(true);
    setShowPasswordField(false);
  };

  const renderCategoryOptions = (categories: PasswordCategory[], level: number = 0): React.ReactNode[] => {
    const options: React.ReactNode[] = [];
    for (const category of categories) {
      options.push(
        <option key={category.id} value={category.id}>
          {' '.repeat(level * 2)}{category.name}
        </option>
      );
      if (category.children && category.children.length > 0) {
        options.push(...renderCategoryOptions(category.children, level + 1));
      }
    }
    return options;
  };

  const savePassword = async () => {
    if (!admin || !passwordForm.name.trim() || !passwordForm.password.trim()) return;
    try {
      setLoading(true);
      if (editingPassword) {
        await passwordService.updatePassword(editingPassword.id, passwordForm);
        addToast({ message: '账号更新成功', type: 'success' });
      } else {
        await passwordService.createPassword(admin.id, passwordForm);
        addToast({ message: '账号创建成功', type: 'success' });
      }
      await loadPasswords(1);
      setShowPasswordModal(false);
    } catch (error) {
      console.error('保存账号失败:', error);
      addToast({ message: '保存账号失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePassword = async (passwordId: string) => {
    try {
      setLoading(true);
      await passwordService.deletePassword(passwordId);
      await loadPasswords(currentPage);
      addToast({ message: '账号删除成功', type: 'success' });
    } catch (error) {
      console.error('删除账号失败:', error);
      addToast({ message: '删除账号失败', type: 'error' });
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
      console.error('分享账号失败:', error);
      addToast({ message: '分享账号失败', type: 'error' });
    }
  };

  const handlePageChange = (newPage: number) => {
    loadPasswords(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    loadPasswords(1);
  };

  const generatePassword = () => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPasswordForm(prev => ({ ...prev, password }));
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'item' | 'category' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      type,
      targetId
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleOpenConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm
    });
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
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
        {
          id: 'copy-pwd',
          label: '复制密码',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => {
            handleCopyPassword(password.password);
            handleCloseContextMenu();
          }
        },
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => {
            openPasswordModal(password);
            handleCloseContextMenu();
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个账号吗？', () => handleDeletePassword(password.id))
        }
      ];
    }

    if (contextMenu.type === 'category' && contextMenu.targetId) {
      const category = findCategoryById(categories, contextMenu.targetId);
      if (!category) return [];
      
      return [
        {
          id: 'edit',
          label: '编辑',
          icon: <Edit className="w-4 h-4" />,
          onClick: () => {
            openCategoryModal(category);
            handleCloseContextMenu();
          }
        },
        { id: 'divider1', label: '', divider: true },
        {
          id: 'delete',
          label: '删除',
          icon: <Trash2 className="w-4 h-4" />,
          onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个分类吗？', () => handleDeleteCategory(category.id))
        }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        {
          id: 'add-password',
          label: '添加账号',
          icon: <Plus className="w-4 h-4" />,
          onClick: () => {
            openPasswordModal();
            handleCloseContextMenu();
          }
        },
        {
          id: 'add-category',
          label: '添加分类',
          icon: <Tag className="w-4 h-4" />,
          onClick: () => {
            openCategoryModal();
            handleCloseContextMenu();
          }
        }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, passwords, categories, handleCloseContextMenu, handleOpenConfirmDialog]);

  const renderCategoryTree = (categories: PasswordCategory[], level: number = 0) => {
    return categories.map(category => (
      <div key={category.id} className="mb-1">
        <div 
          className="flex items-center"
          onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
        >
          <button
            onClick={() => handleCategorySelect(category.id)}
            className={`flex-1 text-left px-2 py-1.5 rounded-md transition-colors text-sm ${level > 0 ? `pl-${level * 4 + 4}` : 'pl-2'} ${selectedCategory === category.id ? 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            <div className="flex items-center justify-between">
              <span>{category.name}</span>
              {category.children && category.children.length > 0 && (
                <div
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded transition-colors flex-shrink-0 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); toggleCategory(category.id); }}
                >
                  {expandedCategories.has(category.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              )}
            </div>
          </button>
        </div>
        {category.children && category.children.length > 0 && expandedCategories.has(category.id) && (
          <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700 pl-2">
            {renderCategoryTree(category.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'empty')}
      onClick={() => {
        if (expandedCategories.size > 0) {
          setExpandedCategories(new Set());
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col h-full">
        <div className="mb-4 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleCategorySelect(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                  selectedCategory === null 
                    ? 'bg-gray-800 text-white' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                全部
              </button>
              {categories.filter(c => !c.parent_id).map((category) => {
                const hasChildren = category.children && category.children.length > 0;
                const isExpanded = expandedCategories.has(category.id);
                return (
                  <div key={category.id} className="relative inline-block">
                    <button
                      onClick={() => {
                        handleCategorySelect(category.id);
                        if (hasChildren) {
                          setExpandedCategories(prev => {
                            const next = new Set(prev);
                            if (isExpanded) {
                              next.delete(category.id);
                            } else {
                              next.add(category.id);
                              next.forEach(id => {
                                if (id !== category.id) {
                                  next.delete(id);
                                }
                              });
                            }
                            return next;
                          });
                        }
                      }}
                      onContextMenu={(e) => handleContextMenu(e, 'category', category.id)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1 ${
                        selectedCategory === category.id 
                          ? 'bg-gray-800 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Tag size={12} />
                      {category.name}
                      {hasChildren && (
                        isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                      )}
                    </button>
                    {hasChildren && isExpanded && category.children && (
                      <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[140px] z-50">
                        {category.children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => {
                              handleCategorySelect(child.id);
                              setExpandedCategories(prev => {
                                const next = new Set(prev);
                                next.delete(category.id);
                                return next;
                              });
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleContextMenu(e, 'category', child.id);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-sm font-medium transition-colors ${
                              selectedCategory === child.id 
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200' 
                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {child.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => openCategoryModal()}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="添加分类"
              >
                <Plus size={16} />
              </button>
            </div>
            <div className="flex gap-2">
              <select value={selectedStatus} onChange={(e) => handleStatusSelect(e.target.value)} className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                <option value="">所有状态</option>
                <option value="active">活跃</option>
                <option value="inactive">非活跃</option>
                <option value="expired">已过期</option>
              </select>
              <button onClick={() => openPasswordModal()} className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          ) : passwords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Key className="w-10 h-10 text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">暂无账号记录</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {passwords.map((password) => (
                <div 
                  key={password.id} 
                  className="password-card bg-gray-50 dark:bg-gray-800 rounded-xl p-3 transition-all duration-300 hover:shadow-md relative overflow-hidden"
                  onContextMenu={(e) => handleContextMenu(e, 'item', password.id)}
                >
                  <div className="relative z-10">
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      {password.category_name && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${getCategoryColor(password.category_name)}`}>
                          {password.category_name}
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded-full ${password.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : password.status === 'inactive' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                        {password.status === 'active' ? '活跃' : password.status === 'inactive' ? '非活跃' : '已过期'}
                      </span>
                      {password.url && (
                        <a 
                          href={password.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-0.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded transition-colors ml-auto" 
                          title="打开网址"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1.5 truncate">
                      {password.url ? (
                        <a 
                          href={password.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-200 hover:underline transition-colors truncate"
                        >
                          {password.name}
                        </a>
                      ) : (
                        password.name
                      )}
                    </h3>
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 min-h-[48px]">
                      {password.username && (
                        <div className="flex items-center justify-between">
                          <span className="font-medium">用户名:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900 dark:text-white truncate max-w-[80px]">{password.username}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleCopyText(password.username, '用户名已复制'); }} className="text-gray-600 dark:text-gray-400 hover:text-gray-700 p-0.5 rounded transition-colors">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      {password.email && (
                        <div className="flex items-center justify-between">
                          <span className="font-medium">邮箱:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900 dark:text-white truncate max-w-[80px]">{password.email}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleCopyText(password.email, '邮箱已复制'); }} className="text-gray-600 dark:text-gray-400 hover:text-gray-700 p-0.5 rounded transition-colors">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      )}
                      {password.phone && (
                        <div className="flex items-center justify-between">
                          <span className="font-medium">手机号:</span>
                          <div className="flex items-center gap-1">
                            <span className="text-gray-900 dark:text-white truncate max-w-[80px]">{password.phone}</span>
                            <button onClick={(e) => { e.stopPropagation(); handleCopyText(password.phone, '手机号已复制'); }} className="text-gray-600 dark:text-gray-400 hover:text-gray-700 p-0.5 rounded transition-colors">
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium">备注:</span>
                      <span className="text-gray-900 dark:text-white ml-1 block mt-1 truncate">
                        {password.notes || '-'}
                      </span>
                    </div>
                    <div className="password-card-actions mt-2 flex">
                      <button onClick={(e) => { e.stopPropagation(); handleCopyText(password.username || '', '用户名已复制'); }} className="password-card-btn flex-1 flex items-center justify-center gap-1 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 4h5v16h-5M11 16H9a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-xs">账号</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleCopyPassword(password.password); }} className="password-card-btn flex-1 flex items-center justify-center gap-1 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-xs">密码</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleSharePassword(password); }} className="password-card-btn flex-1 flex items-center justify-center gap-1 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                        <Share2 className="w-3 h-3" />
                        <span className="text-xs">分享</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
          <Pagination currentPage={currentPage} total={total} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} pageSizeOptions={[12, 24, 60, 108, 492]} />
        </div>

        <Modal isOpen={showCategoryModal} onClose={() => setShowCategoryModal(false)} title={editingCategory ? '编辑分类' : '添加分类'} confirmText="保存" onConfirm={saveCategory} confirmDisabled={!categoryForm.name.trim()}>
          <div className="space-y-4">
            <input type="text" value={categoryForm.name} onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))} placeholder="分类名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
            <select value={parentCatId || ''} onChange={(e) => {
              const value = e.target.value;
              const parentId = value === '' ? null : value;
              setParentCatId(parentId);
              setCategoryForm(prev => ({ ...prev, parent_id: parentId }));
            }} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white">
              <option value="">（主分类）</option>
              {categories.filter(c => !c.parent_id).map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </Modal>

        <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setEditingPassword(null); }} title={editingPassword ? '编辑账号' : '添加账号'} confirmText="保存" onConfirm={savePassword} confirmDisabled={!passwordForm.name.trim() || !passwordForm.password.trim()}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <select value={parentCategoryId || ''} onChange={(e) => {
                setParentCategoryId(e.target.value || '');
                setChildCategoryId('');
              }} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white">
                <option value="">主分类</option>
                {categories.filter(c => !c.parent_id).map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select value={childCategoryId || ''} onChange={(e) => {
                const childId = e.target.value || '';
                setChildCategoryId(childId);
                if (childId) {
                  setPasswordForm(prev => ({ ...prev, category_id: childId }));
                } else if (parentCategoryId) {
                  setPasswordForm(prev => ({ ...prev, category_id: parentCategoryId }));
                } else {
                  setPasswordForm(prev => ({ ...prev, category_id: null }));
                }
              }} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white">
                <option value="">子分类</option>
                {parentCategoryId && getChildCategories(parentCategoryId).map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={passwordForm.name} onChange={(e) => setPasswordForm(prev => ({ ...prev, name: e.target.value }))} placeholder="名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
              <input type="text" value={passwordForm.url} onChange={(e) => setPasswordForm(prev => ({ ...prev, url: e.target.value }))} placeholder="网址" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={passwordForm.username} onChange={(e) => setPasswordForm(prev => ({ ...prev, username: e.target.value }))} placeholder="用户名" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
              <div className="relative">
                <input type={showPasswordField ? 'text' : 'password'} value={passwordForm.password} onChange={(e) => setPasswordForm(prev => ({ ...prev, password: e.target.value }))} placeholder="密码" className="w-full px-3 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
                <button onClick={() => setShowPasswordField(!showPasswordField)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  {showPasswordField ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={generatePassword} className="absolute right-10 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" title="生成随机密码">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                    <path d="M21 12a9 9 0 1 0-9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                    <path d="M21 18v-5h-5"></path>
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={passwordForm.email} onChange={(e) => setPasswordForm(prev => ({ ...prev, email: e.target.value }))} placeholder="邮箱" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
              <input type="text" value={passwordForm.phone} onChange={(e) => setPasswordForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="手机号" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={passwordForm.date} onChange={(e) => setPasswordForm(prev => ({ ...prev, date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
              <select value={passwordForm.status} onChange={(e) => setPasswordForm(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' | 'expired' }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white">
                <option value="active">活跃</option>
                <option value="inactive">非活跃</option>
                <option value="expired">已过期</option>
              </select>
            </div>
            <textarea value={passwordForm.security_question} onChange={(e) => setPasswordForm(prev => ({ ...prev, security_question: e.target.value }))} placeholder="密保" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
            <textarea value={passwordForm.notes} onChange={(e) => setPasswordForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="备注" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 dark:bg-gray-700 dark:text-white" />
          </div>
        </Modal>

        <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} />
        
        <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />
        
        <AccountManagerPageStyles />
      </div>
    </div>
  );
};

const AccountManagerPageStyles = () => (
  <style>{`
    .password-card {
      position: relative;
      overflow: hidden;
    }
    
    .password-card::before {
      content: "";
      height: 100px;
      width: 100px;
      position: absolute;
      top: -40%;
      left: -20%;
      border-radius: 50%;
      background: rgba(156, 163, 175, 0.2);
      transition: all 0.8s ease;
      filter: blur(0.5rem);
    }
    
    .dark .password-card::before {
      background: rgba(255, 255, 255, 0.08);
    }
    
    .password-card:hover::before {
      width: 140px;
      height: 140px;
      top: -30%;
      left: 50%;
      filter: blur(0rem);
      background: rgba(156, 163, 175, 0.3);
    }
    
    .dark .password-card:hover::before {
      background: rgba(255, 255, 255, 0.15);
    }
    
    .password-card:hover {
      transform: translateY(-4px);
    }
    
    .password-card-actions {
      border-radius: 0 0 12px 12px;
      overflow: hidden;
      margin: 0 -12px -12px;
      padding: 0 12px 12px;
    }
    
    .password-card-btn {
      background-color: rgba(229, 231, 235, 0.8);
    }
    
    .dark .password-card-btn {
      background-color: rgba(75, 85, 99, 0.5);
    }
    
    .password-card-btn:hover {
      background-color: rgba(209, 213, 219, 1);
    }
    
    .dark .password-card-btn:hover {
      background-color: rgba(107, 114, 128, 0.8);
    }
  `}</style>
);

export default AccountManagerPage;