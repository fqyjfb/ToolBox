import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Eye } from 'lucide-react';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import { accountService } from '../../../../services/AccountService';
import { Email, EmailRequest, Phone } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import PasswordInput from '../../../../components/forms/PasswordInput';
import SelectWithCustom from '../../../../components/forms/SelectWithCustom';
import PreviewModal from '../../../../components/ui/PreviewModal';
import { logError } from '../../../../services/loggerService';
import { modalControlClass, modalTextareaClass } from '../shared';

interface EmailPanelProps {
  userId: string;
}

interface EmailPanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const emailPlatformMap: Record<string, { label: string; icon: string }> = {
  '163.com': { label: '163邮箱', icon: './imgs/email/163邮箱.png' },
  '126.com': { label: '126邮箱', icon: './imgs/email/126邮箱.png' },
  'qq.com': { label: 'QQ邮箱', icon: './imgs/email/QQ邮箱.png' },
  'gmail.com': { label: 'Google', icon: './imgs/email/google.png' },
  'outlook.com': { label: 'Outlook', icon: './imgs/email/outlook.png' },
  'hotmail.com': { label: 'Outlook', icon: './imgs/email/outlook.png' },
  'live.com': { label: 'Outlook', icon: './imgs/email/outlook.png' },
  'aliyun.com': { label: '阿里邮箱', icon: './imgs/email/阿里邮箱.png' },
  'alibaba.com': { label: '阿里邮箱', icon: './imgs/email/阿里邮箱.png' },
  'taobao.com': { label: '阿里邮箱', icon: './imgs/email/阿里邮箱.png' },
};

const getEmailPlatform = (email: string): { label: string; icon: string } => {
  if (!email) {
    return { label: '其他邮箱', icon: './imgs/email/其他邮箱.png' };
  }
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) {
    return { label: '其他邮箱', icon: './imgs/email/其他邮箱.png' };
  }

  for (const [key, value] of Object.entries(emailPlatformMap)) {
    if (domain === key || domain.endsWith(`.${key}`)) {
      return value;
    }
  }

  if (domain.includes('company') || domain.includes('enterprise') || domain.includes('corp')) {
    return { label: '企业邮箱', icon: './imgs/email/企业邮箱.png' };
  }

  return { label: '其他邮箱', icon: './imgs/email/其他邮箱.png' };
};

const EmailPanel = forwardRef<EmailPanelRef, EmailPanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [emails, setEmails] = useState<Email[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['platform', 'email', 'phone', 'remark']);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Email | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<Email | null>(null);

  const [emailForm, setEmailForm] = useState<EmailRequest>({
    email: '', password: '', phone: '', verification_info: '', remark: ''
  });

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useImperativeHandle(ref, () => ({
    openModal: (email?: Email) => {
      if (email) {
        setEditingItem(email);
        setEmailForm({
          email: email.email,
          password: email.password,
          phone: email.phone,
          verification_info: email.verification_info,
          remark: email.remark
        });
      } else {
        setEditingItem(null);
        setEmailForm({
          email: '', password: '', phone: '', verification_info: '', remark: ''
        });
      }
      setShowModal(true);
    },
    setVisibleColumns: (columns: string[]) => {
      setVisibleColumns(columns);
    }
  }));

  const loadPhones = useCallback(async () => {
    try {
      const result = await accountService.getPhones(userId, 1, 100);
      setPhones(result.list);
    } catch (error) {
      logError('加载手机数据失败', 'EmailPanel', error as Error);
    }
  }, [userId]);

  const loadData = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      let result;
      if (isSearchActive && searchQuery.trim()) {
        result = await accountService.searchEmails(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        result = await accountService.getEmails(userId, pageNum, pageSize);
      }
      setEmails(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载邮箱数据失败', 'EmailPanel', error as Error);
      addToast({ message: '加载邮箱数据失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, isSearchActive, pageSize, addToast]);

  useEffect(() => {
    loadData(1);
    loadPhones();
  }, [loadData, loadPhones]);

  useEffect(() => {
    if (currentPage > 1) {
      loadData(currentPage);
    }
  }, [currentPage, loadData]);

  useEffect(() => {
    setCurrentPage(1);
    loadData(1);
  }, [searchQuery, isSearchActive, loadData]);

  const openModal = (item: Email | null = null) => {
    setEditingItem(item);
    if (item) {
      setEmailForm({
        email: item.email, password: item.password, phone: item.phone,
        verification_info: item.verification_info, remark: item.remark
      });
    } else {
      setEmailForm({
        email: '', password: '', phone: '', verification_info: '', remark: ''
      });
    }
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!emailForm.email.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await accountService.updateEmail(userId, editingItem.id, emailForm);
      } else {
        await accountService.createEmail(userId, emailForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadData(1);
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      logError('保存失败', 'EmailPanel', error as Error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await accountService.deleteEmail(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadData(currentPage);
    } catch (error) {
      logError('删除失败', 'EmailPanel', error as Error);
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
      logError('复制失败', 'EmailPanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleShareEmail = useCallback(async (email: Email) => {
    try {
      let shareContent = `${email.email}\n`;
      shareContent += email.password ? `密码: ${email.password}\n` : '';
      shareContent += email.phone ? `手机: ${email.phone}\n` : '';
      shareContent += email.verification_info ? `验证信息: ${email.verification_info}\n` : '';
      shareContent += email.remark ? `备注: ${email.remark}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '邮箱信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享失败', 'EmailPanel', error as Error);
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

  const handleRowClick = (email: Email) => {
    setPreviewItem(email);
    setShowPreviewModal(true);
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const email = emails.find(e => e.id === contextMenu.targetId);
      if (!email) return [];

      return [
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(email); handleCloseContextMenu(); } },
        { id: 'copy-email', label: '复制邮箱', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(email.email || '', '邮箱已复制'); handleCloseContextMenu(); } },
        { id: 'copy-pwd', label: '复制密码', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(email.password || '', '密码已复制'); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'share', label: '分享', icon: <Share2 className="w-4 h-4" />, onClick: () => { handleShareEmail(email); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openModal(email); handleCloseContextMenu(); } },
        { id: 'divider3', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个邮箱吗？', () => handleDeleteItem(email.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-email', label: '添加邮箱', icon: <Plus className="w-4 h-4" />, onClick: () => { openModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, emails, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyText, handleDeleteItem, handleShareEmail]);

  return (
    <div className="h-full flex flex-col overflow-hidden" onClick={handleCloseContextMenu}>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无邮箱账号</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.includes('platform') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">平台</th>}
                  {visibleColumns.includes('email') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">邮箱</th>}
                  {visibleColumns.includes('phone') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">手机号</th>}
                  {visibleColumns.includes('remark') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">备注</th>}
                  {visibleColumns.includes('password') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">密码</th>}
                  {visibleColumns.includes('verification_info') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">验证信息</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {emails.map((email) => {
                  const platform = getEmailPlatform(email.email);
                  return (<tr
                      key={email.id}
                      className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => handleRowClick(email)}
                      onContextMenu={(e) => handleContextMenu(e, 'item', email.id)}
                    >
                      {visibleColumns.includes('platform') && (
                        <td className="px-4 py-3 w-24">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-600 whitespace-nowrap">
                            <img loading="lazy" src={platform.icon} alt={platform.label} className="w-3 h-3 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            {platform.label}
                          </span>
                        </td>
                      )}
                      {visibleColumns.includes('email') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900 dark:text-white">{email.email}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyText(email.email, '邮箱已复制'); }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="复制邮箱"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('phone') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-900 dark:text-white">{email.phone || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('remark') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words max-w-[200px]" title={email.remark}>{email.remark || '-'}</span>
                        </td>
                      )}
                      {visibleColumns.includes('password') && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400">******</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyText(email.password, '密码已复制'); }}
                              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                              title="复制密码"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      )}
                      {visibleColumns.includes('verification_info') && (
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{email.verification_info || '-'}</span>
                        </td>
                      )}
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination className="mt-2" currentPage={currentPage} total={total} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? '编辑邮箱' : '添加邮箱'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-2">
          <input type="email" value={emailForm.email} onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))} placeholder="邮箱地址*" className={modalControlClass} />
          <PasswordInput
              value={emailForm.password}
              onChange={(value) => setEmailForm(prev => ({ ...prev, password: value }))}
              placeholder="密码"
              className={modalControlClass}
            />
          <SelectWithCustom
              value={emailForm.phone}
              onChange={(value) => setEmailForm(prev => ({ ...prev, phone: value }))}
              options={phones.map(p => ({ id: p.id, label: p.phone_number }))}
              placeholder="手机号"
              className={modalControlClass}
            />
          <textarea value={emailForm.verification_info} onChange={(e) => setEmailForm(prev => ({ ...prev, verification_info: e.target.value }))} placeholder="验证信息（如安全问题等）" rows={2} className={modalTextareaClass} />
          <textarea value={emailForm.remark} onChange={(e) => setEmailForm(prev => ({ ...prev, remark: e.target.value }))} placeholder="备注" rows={2} className={modalTextareaClass} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.email || '邮箱详情'}
      />
    </div>
  );
});

export default EmailPanel;