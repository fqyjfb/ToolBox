import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Eye } from 'lucide-react';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import { accountService } from '../../../../services/AccountService';
import { SocialAccount, SocialAccountRequest, Email, Phone, Company } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import SelectWithCustom from '../../../../components/forms/SelectWithCustom';
import PasswordInput from '../../../../components/forms/PasswordInput';
import PreviewModal from '../../../../components/ui/PreviewModal';
import { logError } from '../../../../services/loggerService';

interface SocialPanelProps {
  userId: string;
}

interface SocialPanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const platformOptions = [
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Twitter', value: 'twitter' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Instagram', value: 'instagram' },
  { label: '微信', value: 'wechat' },
  { label: '微博', value: 'weibo' },
  { label: '抖音', value: 'douyin' },
  { label: '其他', value: 'other' }
];

const platformIconMap: Record<string, string> = {
  'tiktok': './imgs/tiktok.png',
  'youtube': './imgs/youtube.png',
  'facebook': './imgs/facebook.png',
  'twitter': './imgs/twitter.png',
  'linkedin': './imgs/linkedin.png',
  'whatsapp': './imgs/whatsapp.png',
  'instagram': './imgs/instagram.png',
  'wechat': './imgs/微信.png',
  'weibo': './imgs/微博.png',
  'douyin': './imgs/抖音.png',
  'other': './imgs/other.png'
};

const SocialPanel = forwardRef<SocialPanelRef, SocialPanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['platform', 'user_name', 'account', 'bind_company', 'account_status']);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<SocialAccount | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<SocialAccount | null>(null);

  const [socialForm, setSocialForm] = useState<SocialAccountRequest>({
    email: '', platform: '', account: '', password: '', phone: '',
    user_name: '', bind_company: '', register_time: '', account_status: '正常', remark: ''
  });

  const [emails, setEmails] = useState<Email[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useImperativeHandle(ref, () => ({
    openModal: (socialAccount?: SocialAccount) => {
      if (socialAccount) {
        setEditingItem(socialAccount);
        setSocialForm({
          email: socialAccount.email,
          platform: socialAccount.platform,
          account: socialAccount.account,
          password: socialAccount.password,
          phone: socialAccount.phone,
          user_name: socialAccount.user_name,
          bind_company: socialAccount.bind_company,
          register_time: socialAccount.register_time,
          account_status: socialAccount.account_status,
          remark: socialAccount.remark
        });
      } else {
        setEditingItem(null);
        setSocialForm({
          email: '', platform: '', account: '', password: '', phone: '',
          user_name: '', bind_company: '', register_time: '', account_status: '正常', remark: ''
        });
      }
      setShowModal(true);
    },
    setVisibleColumns: (columns: string[]) => {
      setVisibleColumns(columns);
    }
  }));

  const loadEmails = useCallback(async () => {
    try {
      const result = await accountService.getEmails(userId, 1, 100);
      setEmails(result.list);
    } catch (error) {
      logError('加载邮箱数据失败', 'SocialPanel', error as Error);
    }
  }, [userId]);

  const loadPhones = useCallback(async () => {
    try {
      const result = await accountService.getPhones(userId, 1, 100);
      setPhones(result.list);
    } catch (error) {
      console.error('加载手机数据失败:', error);
    }
  }, [userId]);

  const loadCompanies = useCallback(async () => {
    try {
      const result = await accountService.getCompanies(userId, 1, 100);
      setCompanies(result.list);
    } catch (error) {
      console.error('加载企业数据失败:', error);
    }
  }, [userId]);

  const loadData = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      let result;
      if (isSearchActive && searchQuery.trim()) {
        result = await accountService.searchSocialAccounts(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        result = await accountService.getSocialAccounts(userId, pageNum, pageSize);
      }
      setSocialAccounts(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载社媒账号数据失败', 'SocialPanel', error as Error);
      addToast({ message: '加载社媒账号数据失败', type: 'error' });
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

  const openModal = (item: SocialAccount | null = null) => {
    setEditingItem(item);
    if (item) {
      setSocialForm({
        email: item.email, platform: item.platform, account: item.account, password: item.password,
        phone: item.phone, user_name: item.user_name, bind_company: item.bind_company,
        register_time: item.register_time, account_status: item.account_status, remark: item.remark
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setSocialForm({
        email: '', platform: '', account: '', password: '', phone: '',
        user_name: '', bind_company: '', register_time: today, account_status: '正常', remark: ''
      });
    }
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!socialForm.account.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await accountService.updateSocialAccount(userId, editingItem.id, socialForm);
      } else {
        await accountService.createSocialAccount(userId, socialForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadData(1);
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      console.error('保存失败:', error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await accountService.deleteSocialAccount(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadData(currentPage);
    } catch (error) {
      console.error('删除失败:', error);
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
      console.error('复制失败:', error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleShareSocial = useCallback(async (social: SocialAccount) => {
    try {
      let shareContent = `${social.user_name || social.account}\n`;
      shareContent += `平台: ${social.platform}\n`;
      shareContent += `账号: ${social.account}\n`;
      shareContent += social.password ? `密码: ${social.password}\n` : '';
      shareContent += social.email ? `邮箱: ${social.email}\n` : '';
      shareContent += social.phone ? `手机: ${social.phone}\n` : '';
      shareContent += social.bind_company ? `绑定企业: ${social.bind_company}\n` : '';
      shareContent += social.register_time ? `注册时间: ${social.register_time}\n` : '';
      shareContent += social.account_status ? `状态: ${social.account_status}\n` : '';
      shareContent += social.remark ? `备注: ${social.remark}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '社媒账号信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享失败', 'SocialPanel', error as Error);
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

  const handleRowClick = (social: SocialAccount) => {
    setPreviewItem(social);
    setShowPreviewModal(true);
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const social = socialAccounts.find(s => s.id === contextMenu.targetId);
      if (!social) return [];

      return [
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(social); handleCloseContextMenu(); } },
        { id: 'copy-account', label: '复制账号', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(social.account || '', '账号已复制'); handleCloseContextMenu(); } },
        { id: 'copy-pwd', label: '复制密码', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(social.password || '', '密码已复制'); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'share', label: '分享', icon: <Share2 className="w-4 h-4" />, onClick: () => { handleShareSocial(social); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openModal(social); handleCloseContextMenu(); } },
        { id: 'divider3', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个社媒账号吗？', () => handleDeleteItem(social.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-social', label: '添加社媒账号', icon: <Plus className="w-4 h-4" />, onClick: () => { openModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, socialAccounts, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyText, handleDeleteItem, handleShareSocial]);

  return (
    <div className="h-full flex flex-col" onClick={handleCloseContextMenu}>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : socialAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无社媒账号</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.includes('platform') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">平台</th>}
                  {visibleColumns.includes('user_name') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">用户名</th>}
                  {visibleColumns.includes('account') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">账号</th>}
                  {visibleColumns.includes('bind_company') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">绑定企业</th>}
                  {visibleColumns.includes('account_status') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">状态</th>}
                  {visibleColumns.includes('email') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">邮箱</th>}
                  {visibleColumns.includes('password') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">密码</th>}
                  {visibleColumns.includes('phone') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">手机号</th>}
                  {visibleColumns.includes('remark') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">备注</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {socialAccounts.map((social) => {
                  const iconPath = platformIconMap[social.platform];
                  const platformLabel = platformOptions.find(p => p.value === social.platform)?.label || social.platform;
                  return (
                    <tr
                      key={social.id}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(social)}
                      onContextMenu={(e) => handleContextMenu(e, 'item', social.id)}
                    >
                      {visibleColumns.includes('platform') && (
                        <td className="px-4 py-3 w-24">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-purple-50 text-purple-600 whitespace-nowrap">
                            {iconPath && <img src={iconPath} alt={platformLabel} className="w-3 h-3 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                            {platformLabel}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('user_name') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-sm text-gray-900 dark:text-white">{social.user_name || social.account}</div>
                        </td>
                      )}
                      {visibleColumns.includes('account') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 dark:text-white">{social.account}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyText(social.account || '', '账号已复制'); }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="复制账号"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('bind_company') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 dark:text-white truncate max-w-[150px]">{social.bind_company || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('account_status') && (
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            social.account_status === '正常' ? 'bg-green-50 text-green-600' :
                            social.account_status === '异常' ? 'bg-yellow-50 text-yellow-600' :
                            'bg-red-50 text-red-600'
                          }`}>
                            {social.account_status}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('email') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{social.email || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('password') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[100px]">{social.password || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('phone') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 dark:text-white">{social.phone || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('remark') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words max-w-[200px]">{social.remark || '-'}</span>
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

      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 mt-4">
        <Pagination currentPage={currentPage} total={total} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? '编辑社媒账号' : '添加社媒账号'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <select value={socialForm.platform} onChange={(e) => setSocialForm(prev => ({ ...prev, platform: e.target.value as SocialAccount['platform'] }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
              <option value="">平台*</option>
              {platformOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input type="text" value={socialForm.account} onChange={(e) => setSocialForm(prev => ({ ...prev, account: e.target.value }))} placeholder="账号*" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={socialForm.user_name} onChange={(e) => setSocialForm(prev => ({ ...prev, user_name: e.target.value }))} placeholder="用户名" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <PasswordInput
              value={socialForm.password}
              onChange={(value) => setSocialForm(prev => ({ ...prev, password: value }))}
              placeholder="密码"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectWithCustom
              value={socialForm.email}
              onChange={(value) => setSocialForm(prev => ({ ...prev, email: value }))}
              options={emails.map(e => ({ id: e.id, label: e.email }))}
              placeholder="邮箱"
            />
            <SelectWithCustom
              value={socialForm.phone}
              onChange={(value) => setSocialForm(prev => ({ ...prev, phone: value }))}
              options={phones.map(p => ({ id: p.id, label: p.phone_number }))}
              placeholder="手机号"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectWithCustom
              value={socialForm.bind_company}
              onChange={(value) => setSocialForm(prev => ({ ...prev, bind_company: value }))}
              options={companies.map(c => ({ id: c.id, label: c.name }))}
              placeholder="绑定公司"
            />
            <input type="date" value={socialForm.register_time} onChange={(e) => setSocialForm(prev => ({ ...prev, register_time: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <select value={socialForm.account_status} onChange={(e) => setSocialForm(prev => ({ ...prev, account_status: e.target.value as SocialAccount['account_status'] }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
            <option value="正常">正常</option>
            <option value="异常">异常</option>
            <option value="封禁">封禁</option>
            <option value="待验证">待验证</option>
          </select>
          <textarea value={socialForm.remark} onChange={(e) => setSocialForm(prev => ({ ...prev, remark: e.target.value }))} placeholder="备注" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.user_name || previewItem?.account || '社媒账号详情'}
      />
    </div>
  );
});

export default SocialPanel;