import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Eye } from 'lucide-react';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import { accountService } from '../../../../services/AccountService';
import { GeneralAccount, GeneralAccountRequest, Email, Phone } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import SelectWithCustom from '../../../../components/forms/SelectWithCustom';
import PasswordInput from '../../../../components/forms/PasswordInput';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import PreviewModal from '../../../../components/ui/PreviewModal';
import { logError } from '../../../../services/loggerService';
import { openUrl } from '../../../../services/browserService';

interface GeneralPanelProps {
  userId: string;
}

interface GeneralPanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const GeneralPanel = forwardRef<GeneralPanelRef, GeneralPanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [generalAccounts, setGeneralAccounts] = useState<GeneralAccount[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['platform_name', 'account', 'password', 'notes', 'status']);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<GeneralAccount | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<GeneralAccount | null>(null);

  const [generalForm, setGeneralForm] = useState<GeneralAccountRequest>({
    platform_name: '', website: '', account: '', password: '', email: '', phone: '',
    registration_date: '', status: 'active', security_question: '', security_answer: '', notes: ''
  });

  const [emails, setEmails] = useState<Email[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useImperativeHandle(ref, () => ({
    openModal: (account?: GeneralAccount) => {
      if (account) {
        setEditingItem(account);
        setGeneralForm({
          platform_name: account.platform_name,
          website: account.website,
          account: account.account,
          password: account.password,
          email: account.email,
          phone: account.phone,
          registration_date: account.registration_date,
          status: account.status,
          security_question: account.security_question,
          security_answer: account.security_answer,
          notes: account.notes
        });
      } else {
        setEditingItem(null);
        setGeneralForm({
          platform_name: '', website: '', account: '', password: '', email: '', phone: '',
          registration_date: '', status: 'active', security_question: '', security_answer: '', notes: ''
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
      logError('加载邮箱数据失败', 'GeneralPanel', error as Error);
    }
  }, [userId]);

  const loadPhones = useCallback(async () => {
    try {
      const result = await accountService.getPhones(userId, 1, 100);
      setPhones(result.list);
    } catch (error) {
      logError('加载手机数据失败', 'GeneralPanel', error as Error);
    }
  }, [userId]);

  const loadData = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      let result;
      if (isSearchActive && searchQuery.trim()) {
        result = await accountService.searchGeneralAccounts(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        result = await accountService.getGeneralAccounts(userId, pageNum, pageSize);
      }
      setGeneralAccounts(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载通用账号数据失败', 'GeneralPanel', error as Error);
      addToast({ message: '加载通用账号数据失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, isSearchActive, pageSize, addToast]);

  useEffect(() => {
    loadData(1);
    loadEmails();
    loadPhones();
  }, [loadData, loadEmails, loadPhones]);

  useEffect(() => {
    if (currentPage > 1) {
      loadData(currentPage);
    }
  }, [currentPage, loadData]);

  useEffect(() => {
    setCurrentPage(1);
    loadData(1);
  }, [searchQuery, isSearchActive, loadData]);

  const openModal = (item: GeneralAccount | null = null) => {
    setEditingItem(item);
    if (item) {
      setGeneralForm({
        platform_name: item.platform_name, website: item.website, account: item.account,
        password: item.password, email: item.email, phone: item.phone,
        registration_date: item.registration_date, status: item.status,
        security_question: item.security_question, security_answer: item.security_answer,
        notes: item.notes
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setGeneralForm({
        platform_name: '', website: '', account: '', password: '', email: '', phone: '',
        registration_date: today, status: 'active', security_question: '', security_answer: '', notes: ''
      });
    }
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!generalForm.platform_name.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await accountService.updateGeneralAccount(userId, editingItem.id, generalForm);
      } else {
        await accountService.createGeneralAccount(userId, generalForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadData(1);
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      logError('保存失败', 'GeneralPanel', error as Error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await accountService.deleteGeneralAccount(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadData(currentPage);
    } catch (error) {
      logError('删除失败', 'GeneralPanel', error as Error);
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
      logError('复制失败', 'GeneralPanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleShareGeneral = useCallback(async (general: GeneralAccount) => {
    try {
      let shareContent = `${general.platform_name}\n`;
      shareContent += general.account ? `账号: ${general.account}\n` : '';
      shareContent += general.password ? `密码: ${general.password}\n` : '';
      shareContent += general.email ? `邮箱: ${general.email}\n` : '';
      shareContent += general.phone ? `手机号: ${general.phone}\n` : '';
      shareContent += general.website ? `网站: ${general.website}\n` : '';
      shareContent += general.registration_date ? `注册日期: ${general.registration_date}\n` : '';
      shareContent += general.status ? `状态: ${general.status === 'active' ? '活跃' : general.status === 'abnormal' ? '异常' : general.status === 'banned' ? '封禁' : '过期'}\n` : '';
      shareContent += general.notes ? `备注: ${general.notes}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '账号信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享失败', 'GeneralPanel', error as Error);
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

  const handleRowClick = (general: GeneralAccount) => {
    setPreviewItem(general);
    setShowPreviewModal(true);
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const general = generalAccounts.find(g => g.id === contextMenu.targetId);
      if (!general) return [];

      return [
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(general); handleCloseContextMenu(); } },
        { id: 'copy-account', label: '复制账号', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(general.account || '', '账号已复制'); handleCloseContextMenu(); } },
        { id: 'copy-pwd', label: '复制密码', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(general.password || '', '密码已复制'); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'share', label: '分享', icon: <Share2 className="w-4 h-4" />, onClick: () => { handleShareGeneral(general); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openModal(general); handleCloseContextMenu(); } },
        { id: 'divider3', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个账号吗？', () => handleDeleteItem(general.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-general', label: '添加通用账号', icon: <Plus className="w-4 h-4" />, onClick: () => { openModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, generalAccounts, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyText, handleDeleteItem, handleShareGeneral]);

  return (
    <div className="h-full flex flex-col overflow-hidden" onClick={handleCloseContextMenu}>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : generalAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无通用账号</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.includes('platform_name') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-help" title="存在网址时可点击">平台名称</th>}
                  {visibleColumns.includes('account') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">账号</th>}
                  {visibleColumns.includes('password') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">密码</th>}
                  {visibleColumns.includes('notes') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">备注</th>}
                  {visibleColumns.includes('status') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">状态</th>}
                  {visibleColumns.includes('url') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">网址</th>}
                  {visibleColumns.includes('email') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">邮箱</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {generalAccounts.map((general) => (
                  <tr
                    key={general.id}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(general)}
                    onContextMenu={(e) => handleContextMenu(e, 'item', general.id)}
                  >
                    {visibleColumns.includes('platform_name') && (
                      <td className="px-4 py-3">
                        {general.website ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); openUrl(general.website); }}
                            className="font-medium text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                            title={`点击打开: ${general.website}`}
                          >
                            {general.platform_name}
                          </button>
                        ) : (
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{general.platform_name}</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.includes('account') && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-900 dark:text-white">{general.account}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyText(general.account || '', '账号已复制'); }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="复制账号"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('password') && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">******</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyText(general.password || '', '密码已复制'); }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="复制密码"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('notes') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words max-w-[300px]" title={general.notes}>{general.notes || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          general.status === 'active' ? 'bg-green-50 text-green-600' :
                          general.status === 'abnormal' ? 'bg-yellow-50 text-yellow-600' :
                          general.status === 'banned' ? 'bg-red-50 text-red-600' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          {general.status === 'active' ? '活跃' : general.status === 'abnormal' ? '异常' : general.status === 'banned' ? '封禁' : '过期'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('url') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{general.website || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('email') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{general.email || '-'}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination className="mt-2" currentPage={currentPage} total={total} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? '编辑通用账号' : '添加通用账号'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={generalForm.platform_name} onChange={(e) => setGeneralForm(prev => ({ ...prev, platform_name: e.target.value }))} placeholder="平台名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <input type="text" value={generalForm.website} onChange={(e) => setGeneralForm(prev => ({ ...prev, website: e.target.value }))} placeholder="网站地址" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={generalForm.account} onChange={(e) => setGeneralForm(prev => ({ ...prev, account: e.target.value }))} placeholder="账号" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <PasswordInput
              value={generalForm.password}
              onChange={(value) => setGeneralForm(prev => ({ ...prev, password: value }))}
              placeholder="密码"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectWithCustom
              value={generalForm.email}
              onChange={(value) => setGeneralForm(prev => ({ ...prev, email: value }))}
              options={emails.map(e => ({ id: e.id, label: e.email }))}
              placeholder="邮箱"
            />
            <SelectWithCustom
              value={generalForm.phone}
              onChange={(value) => setGeneralForm(prev => ({ ...prev, phone: value }))}
              options={phones.map(p => ({ id: p.id, label: p.phone_number }))}
              placeholder="手机号"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={generalForm.registration_date} onChange={(e) => setGeneralForm(prev => ({ ...prev, registration_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <select value={generalForm.status} onChange={(e) => setGeneralForm(prev => ({ ...prev, status: e.target.value as GeneralAccount['status'] }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
              <option value="active">活跃</option>
              <option value="abnormal">异常</option>
              <option value="banned">封禁</option>
              <option value="expired">过期</option>
            </select>
          </div>
          <input type="text" value={generalForm.security_question} onChange={(e) => setGeneralForm(prev => ({ ...prev, security_question: e.target.value }))} placeholder="安全问题" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <input type="text" value={generalForm.security_answer} onChange={(e) => setGeneralForm(prev => ({ ...prev, security_answer: e.target.value }))} placeholder="安全答案" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <textarea value={generalForm.notes} onChange={(e) => setGeneralForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="备注" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.platform_name || '通用账号详情'}
      />
    </div>
  );
});

export default GeneralPanel;