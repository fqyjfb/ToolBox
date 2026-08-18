import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Eye, LogIn } from 'lucide-react';
import { accountService } from '../../../../services/AccountService';
import { Shop, ShopRequest, Email, Phone, Company } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import { useThemeStore } from '../../../../store/themeStore';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import SelectWithCustom from '../../../../components/forms/SelectWithCustom';
import Select from '../../../../components/ui/Select';
import PasswordInput from '../../../../components/forms/PasswordInput';
import PreviewModal from '../../../../components/ui/PreviewModal';
import { logError } from '../../../../services/loggerService';
import { modalControlClass, modalTextareaClass } from '../shared';

interface ShopPanelProps {
  userId: string;
}

interface ShopPanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const platformIconMap: Record<string, string> = {
  '淘宝': './imgs/淘宝.png',
  '天猫': './imgs/天猫.png',
  '拼多多': './imgs/拼多多.png',
  '抖音': './imgs/抖音.png',
  '京东': './imgs/京东.png',
  '其他': './imgs/其他.png'
};

const ShopPanel = forwardRef<ShopPanelRef, ShopPanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const isDark = useThemeStore((state) => state.isDark);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [shops, setShops] = useState<Shop[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['platform', 'shop_name', 'account', 'contact_person', 'phone']);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Shop | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<Shop | null>(null);

  const [emails, setEmails] = useState<Email[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [shopForm, setShopForm] = useState<ShopRequest>({
    shop_name: '', platform: '淘宝', account: '', password: '', payment_password: '',
    phone: '', email: '', shop_type: '', corporation: '', alipay_account: '',
    alipay_password: '', contact_person: '', address: '', base_deposit: '',
    risk_deposit: '', remark: ''
  });

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const openModalFn = (item: Shop | null = null) => {
    setEditingItem(item);
    if (item) {
      setShopForm({
        shop_name: item.shop_name, platform: item.platform, account: item.account,
        password: item.password, payment_password: item.payment_password,
        phone: item.phone, email: item.email, shop_type: item.shop_type,
        corporation: item.corporation, alipay_account: item.alipay_account,
        alipay_password: item.alipay_password, contact_person: item.contact_person,
        address: item.address, base_deposit: item.base_deposit,
        risk_deposit: item.risk_deposit, remark: item.remark
      });
    } else {
      setShopForm({
        shop_name: '', platform: '淘宝', account: '', password: '', payment_password: '',
        phone: '', email: '', shop_type: '', corporation: '', alipay_account: '',
        alipay_password: '', contact_person: '', address: '', base_deposit: '',
        risk_deposit: '', remark: ''
      });
    }
    setShowModal(true);
  };

  useImperativeHandle(ref, () => ({
    openModal: () => openModalFn(null),
    setVisibleColumns: (columns: string[]) => {
      setVisibleColumns(columns);
    }
  }));

  const loadEmails = useCallback(async () => {
    try {
      const result = await accountService.getEmails(userId, 1, 100);
      setEmails(result.list);
    } catch (error) {
      logError('加载邮箱数据失败', 'ShopPanel', error as Error);
    }
  }, [userId]);

  const loadPhones = useCallback(async () => {
    try {
      const result = await accountService.getPhones(userId, 1, 100);
      setPhones(result.list);
    } catch (error) {
      logError('加载手机数据失败', 'ShopPanel', error as Error);
    }
  }, [userId]);

  const loadCompanies = useCallback(async () => {
    try {
      const result = await accountService.getCompanies(userId, 1, 100);
      setCompanies(result.list);
    } catch (error) {
      logError('加载企业数据失败', 'ShopPanel', error as Error);
    }
  }, [userId]);

  const loadData = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      let result;
      if (isSearchActive && searchQuery.trim()) {
        result = await accountService.searchShops(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        result = await accountService.getShops(userId, pageNum, pageSize);
      }
      setShops(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载店铺数据失败', 'ShopPanel', error as Error);
      addToast({ message: '加载店铺数据失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, isSearchActive, pageSize, addToast]);

  useEffect(() => {
    loadData(1);
    loadEmails();
    loadPhones();
    loadCompanies();
  }, [loadData, loadEmails, loadPhones, loadCompanies]);

  useEffect(() => {
    if (currentPage > 1) {
      loadData(currentPage);
    }
  }, [currentPage, loadData]);

  useEffect(() => {
    setCurrentPage(1);
    loadData(1);
  }, [searchQuery, isSearchActive, loadData]);

  const saveItem = async () => {
    if (!shopForm.shop_name.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await accountService.updateShop(userId, editingItem.id, shopForm);
      } else {
        await accountService.createShop(userId, shopForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadData(1);
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      logError('保存失败', 'ShopPanel', error as Error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await accountService.deleteShop(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadData(currentPage);
    } catch (error) {
      logError('删除失败', 'ShopPanel', error as Error);
      addToast({ message: '删除失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, loadData, currentPage, userId]);

  const handleCopyText = useCallback(async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message, type: 'success' });
    } catch (error) {
      logError('复制失败', 'ShopPanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleShareShop = useCallback(async (shop: Shop) => {
    try {
      let shareContent = `${shop.shop_name}\n`;
      shareContent += `平台: ${shop.platform}\n`;
      shareContent += `账号: ${shop.account}\n`;
      shareContent += shop.password ? `密码: ${shop.password}\n` : '';
      shareContent += shop.payment_password ? `支付密码: ${shop.payment_password}\n` : '';
      shareContent += shop.phone ? `手机: ${shop.phone}\n` : '';
      shareContent += shop.email ? `邮箱: ${shop.email}\n` : '';
      shareContent += shop.shop_type ? `类型: ${shop.shop_type}\n` : '';
      shareContent += shop.corporation ? `公司: ${shop.corporation}\n` : '';
      shareContent += shop.alipay_account ? `支付宝: ${shop.alipay_account}\n` : '';
      shareContent += shop.contact_person ? `联系人: ${shop.contact_person}\n` : '';
      shareContent += shop.address ? `地址: ${shop.address}\n` : '';
      shareContent += shop.remark ? `备注: ${shop.remark}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '店铺信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享失败', 'ShopPanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    loadData(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
    loadData(1);
  };

  const handleOpenConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  }, []);

  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'item' | 'empty', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, type, targetId });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleQuickLogin = useCallback((shop: Shop) => {
    const fields: QuickLoginField[] = [
      { label: '账号', value: shop.account },
      { label: '密码', value: shop.password },
      { label: '支付密码', value: shop.payment_password },
      { label: '邮箱', value: shop.email },
      { label: '电话', value: shop.phone }
    ].filter(f => f.value);
    window.electron?.openQuickLogin({ title: shop.shop_name, url: '', isDark, fields });
  }, [isDark]);

  const handleRowClick = (shop: Shop) => {
    setPreviewItem(shop);
    setShowPreviewModal(true);
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const shop = shops.find(s => s.id === contextMenu.targetId);
      if (!shop) return [];

      return [
        { id: 'quick-login', label: '便捷登录', icon: <LogIn className="w-4 h-4" />, onClick: () => { handleQuickLogin(shop); handleCloseContextMenu(); } },
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(shop); handleCloseContextMenu(); } },
        { id: 'copy-account', label: '复制账号', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(shop.account || '', '账号已复制'); handleCloseContextMenu(); } },
        { id: 'copy-pwd', label: '复制密码', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(shop.password || '', '密码已复制'); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'share', label: '分享', icon: <Share2 className="w-4 h-4" />, onClick: () => { handleShareShop(shop); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openModalFn(shop); handleCloseContextMenu(); } },
        { id: 'divider3', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个店铺吗？', () => handleDeleteItem(shop.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-shop', label: '添加店铺', icon: <Plus className="w-4 h-4" />, onClick: () => { openModalFn(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, shops, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyText, handleQuickLogin, handleDeleteItem, handleShareShop]);

  return (
    <div className="h-full flex flex-col overflow-hidden" onClick={handleCloseContextMenu}>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : shops.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无店铺信息</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.includes('platform') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">平台</th>}
                  {visibleColumns.includes('shop_name') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">店铺名称</th>}
                  {visibleColumns.includes('account') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">账号</th>}
                  {visibleColumns.includes('contact_person') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">联系人</th>}
                  {visibleColumns.includes('phone') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">手机</th>}
                  {visibleColumns.includes('email') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">邮箱</th>}
                  {visibleColumns.includes('password') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">密码</th>}
                  {visibleColumns.includes('payment_password') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">支付密码</th>}
                  {visibleColumns.includes('shop_type') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">店铺类型</th>}
                  {visibleColumns.includes('corporation') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">公司名称</th>}
                  {visibleColumns.includes('alipay_account') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">支付宝账号</th>}
                  {visibleColumns.includes('alipay_password') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">支付宝密码</th>}
                  {visibleColumns.includes('address') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">地址</th>}
                  {visibleColumns.includes('base_deposit') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">基础保证金</th>}
                  {visibleColumns.includes('risk_deposit') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">风险保证金</th>}
                  {visibleColumns.includes('remark') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">备注</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {shops.map((shop) => {
                  const platformIcon = platformIconMap[shop.platform];
                  return (
                    <tr
                      key={shop.id}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(shop)}
                      onContextMenu={(e) => handleContextMenu(e, 'item', shop.id)}
                    >
                      {visibleColumns.includes('platform') && (
                        <td className="px-4 py-3 w-24">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 whitespace-nowrap">
                            {platformIcon && <img loading="lazy" src={platformIcon} alt={shop.platform} className="w-3 h-3 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                            {shop.platform}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('shop_name') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">{shop.shop_name}</div>
                        </td>
                      )}
                      {visibleColumns.includes('account') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 dark:text-white">{shop.account}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyText(shop.account || '', '账号已复制'); }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="复制账号"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('contact_person') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 dark:text-white">{shop.contact_person || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('phone') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 dark:text-white">{shop.phone || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('email') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{shop.email || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('password') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{shop.password || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('payment_password') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{shop.payment_password || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('shop_type') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 dark:text-white">{shop.shop_type || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('corporation') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 dark:text-white truncate max-w-[150px]">{shop.corporation || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('alipay_account') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{shop.alipay_account || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('alipay_password') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{shop.alipay_password || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('address') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{shop.address || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('base_deposit') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{shop.base_deposit || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('risk_deposit') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400">{shop.risk_deposit || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('remark') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words max-w-[200px]">{shop.remark || '-'}</span>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination className="mt-2" currentPage={currentPage} total={total} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? '编辑店铺' : '添加店铺'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={shopForm.shop_name} onChange={(e) => setShopForm(prev => ({ ...prev, shop_name: e.target.value }))} placeholder="店铺名称*" className={modalControlClass} />
            <Select
              value={shopForm.platform}
              onChange={(v) => setShopForm(prev => ({ ...prev, platform: v as Shop['platform'] }))}
              options={[
                { value: '', label: '平台*' },
                { value: '淘宝', label: '淘宝' },
                { value: '天猫', label: '天猫' },
                { value: '拼多多', label: '拼多多' },
                { value: '抖音', label: '抖音' },
                { value: '京东', label: '京东' },
                { value: '其他', label: '其他' }
              ]}
              className={modalControlClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={shopForm.account} onChange={(e) => setShopForm(prev => ({ ...prev, account: e.target.value }))} placeholder="账号*" className={modalControlClass} />
            <PasswordInput
              value={shopForm.password}
              onChange={(value) => setShopForm(prev => ({ ...prev, password: value }))}
              placeholder="密码"
              className={modalControlClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SelectWithCustom
              value={shopForm.phone}
              onChange={(value) => setShopForm(prev => ({ ...prev, phone: value }))}
              options={phones.map(p => ({ id: p.id, label: p.phone_number }))}
              placeholder="手机号"
              className={modalControlClass}
            />
            <SelectWithCustom
              value={shopForm.email}
              onChange={(value) => setShopForm(prev => ({ ...prev, email: value }))}
              options={emails.map(e => ({ id: e.id, label: e.email }))}
              placeholder="邮箱"
              className={modalControlClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              value={shopForm.shop_type}
              onChange={(v) => setShopForm(prev => ({ ...prev, shop_type: v as Shop['shop_type'] }))}
              options={[
                { value: '', label: '类型' },
                { value: '企业', label: '企业' },
                { value: '个人', label: '个人' }
              ]}
              className={modalControlClass}
            />
            <SelectWithCustom
              value={shopForm.corporation}
              onChange={(value) => setShopForm(prev => ({ ...prev, corporation: value }))}
              options={companies.map(c => ({ id: c.id, label: c.name }))}
              placeholder="公司名称"
              className={modalControlClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={shopForm.alipay_account} onChange={(e) => setShopForm(prev => ({ ...prev, alipay_account: e.target.value }))} placeholder="支付宝账号" className={modalControlClass} />
            <PasswordInput
              value={shopForm.alipay_password}
              onChange={(value) => setShopForm(prev => ({ ...prev, alipay_password: value }))}
              placeholder="支付宝密码"
              className={modalControlClass}
            />
          </div>
          <input type="text" value={shopForm.contact_person} onChange={(e) => setShopForm(prev => ({ ...prev, contact_person: e.target.value }))} placeholder="联系人" className={modalControlClass} />
          <textarea value={shopForm.address} onChange={(e) => setShopForm(prev => ({ ...prev, address: e.target.value }))} placeholder="地址" rows={2} className={modalTextareaClass} />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={shopForm.base_deposit} onChange={(e) => setShopForm(prev => ({ ...prev, base_deposit: e.target.value }))} placeholder="基础保证金" className={modalControlClass} />
            <input type="text" value={shopForm.risk_deposit} onChange={(e) => setShopForm(prev => ({ ...prev, risk_deposit: e.target.value }))} placeholder="风险保证金" className={modalControlClass} />
          </div>
          <textarea value={shopForm.remark} onChange={(e) => setShopForm(prev => ({ ...prev, remark: e.target.value }))} placeholder="备注" rows={2} className={modalTextareaClass} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.shop_name || '店铺详情'}
      />
    </div>
  );
});

export default ShopPanel;