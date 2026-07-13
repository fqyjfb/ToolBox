import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Eye } from 'lucide-react';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import { accountService } from '../../../../services/AccountService';
import { Credential, CredentialRequest, Phone } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import SelectWithCustom from '../../../../components/forms/SelectWithCustom';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import PreviewModal from '../../../../components/ui/PreviewModal';
import { logError } from '../../../../services/loggerService';

interface CredentialPanelProps {
  userId: string;
}

interface CredentialPanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const CredentialPanel = forwardRef<CredentialPanelRef, CredentialPanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['certificate_type', 'certificate_number', 'name']);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Credential | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<Credential | null>(null);

  const [credentialForm, setCredentialForm] = useState<CredentialRequest>({
    certificate_name: '', id_card_number: '', gender: '', birth_date: '',
    id_card_address: '', certificate_status: '正常', bank_name: '', bank_account: '',
    phone: '', certificate_remark: ''
  });

  const [phones, setPhones] = useState<Phone[]>([]);

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useImperativeHandle(ref, () => ({
    openModal: (credential?: Credential) => {
      if (credential) {
        setEditingItem(credential);
        setCredentialForm({
          certificate_name: credential.certificate_name,
          id_card_number: credential.id_card_number,
          gender: credential.gender,
          birth_date: credential.birth_date,
          id_card_address: credential.id_card_address,
          certificate_status: credential.certificate_status,
          bank_name: credential.bank_name,
          bank_account: credential.bank_account,
          phone: credential.phone,
          certificate_remark: credential.certificate_remark
        });
      } else {
        setEditingItem(null);
        setCredentialForm({
          certificate_name: '', id_card_number: '', gender: '', birth_date: '',
          id_card_address: '', certificate_status: '正常', bank_name: '', bank_account: '',
          phone: '', certificate_remark: ''
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
      logError('加载手机数据失败', 'CredentialPanel', error as Error);
    }
  }, [userId]);

  const loadData = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      let result;
      if (isSearchActive && searchQuery.trim()) {
        result = await accountService.searchCredentials(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        result = await accountService.getCredentials(userId, pageNum, pageSize);
      }
      setCredentials(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载证件信息失败', 'CredentialPanel', error as Error);
      addToast({ message: '加载证件信息失败', type: 'error' });
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

  const openModal = (item: Credential | null = null) => {
    setEditingItem(item);
    if (item) {
      setCredentialForm({
        certificate_name: item.certificate_name, id_card_number: item.id_card_number,
        gender: item.gender, birth_date: item.birth_date, id_card_address: item.id_card_address,
        certificate_status: item.certificate_status, bank_name: item.bank_name,
        bank_account: item.bank_account, phone: item.phone, certificate_remark: item.certificate_remark
      });
    } else {
      setCredentialForm({
        certificate_name: '', id_card_number: '', gender: '', birth_date: '',
        id_card_address: '', certificate_status: '正常', bank_name: '', bank_account: '',
        phone: '', certificate_remark: ''
      });
    }
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!credentialForm.certificate_name.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await accountService.updateCredential(userId, editingItem.id, credentialForm);
      } else {
        await accountService.createCredential(userId, credentialForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadData(1);
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      logError('保存失败', 'CredentialPanel', error as Error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await accountService.deleteCredential(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadData(currentPage);
    } catch (error) {
      logError('删除失败', 'CredentialPanel', error as Error);
      addToast({ message: '删除失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, loadData, currentPage, userId]);

  const parseIdCardNumber = (idCard: string): { gender: '' | '男' | '女'; birthDate: string } => {
    const cleanIdCard = idCard.replace(/\s/g, '');
    if (cleanIdCard.length !== 18) return { gender: '', birthDate: '' };
    
    const genderCode = parseInt(cleanIdCard.charAt(16));
    const gender: '男' | '女' = genderCode % 2 === 1 ? '男' : '女';
    
    const birthDate = cleanIdCard.substring(6, 14);
    const formattedDate = `${birthDate.substring(0, 4)}-${birthDate.substring(4, 6)}-${birthDate.substring(6, 8)}`;
    
    return { gender, birthDate: formattedDate };
  };

  const handleIdCardChange = (value: string) => {
    setCredentialForm(prev => {
      const { gender, birthDate } = parseIdCardNumber(value);
      return {
        ...prev,
        id_card_number: value,
        gender: gender || prev.gender,
        birth_date: birthDate || prev.birth_date
      };
    });
  };

  const handleCopyText = useCallback(async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message, type: 'success' });
    } catch (error) {
      logError('复制失败', 'CredentialPanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleShareCredential = useCallback(async (credential: Credential) => {
    try {
      let shareContent = `${credential.certificate_name}\n`;
      shareContent += credential.id_card_number ? `身份证号: ${credential.id_card_number}\n` : '';
      shareContent += credential.gender ? `性别: ${credential.gender}\n` : '';
      shareContent += credential.birth_date ? `出生日期: ${credential.birth_date}\n` : '';
      shareContent += credential.id_card_address ? `身份证地址: ${credential.id_card_address}\n` : '';
      shareContent += credential.bank_name ? `开户行: ${credential.bank_name}\n` : '';
      shareContent += credential.bank_account ? `银行账号: ${credential.bank_account}\n` : '';
      shareContent += credential.phone ? `手机号: ${credential.phone}\n` : '';
      shareContent += credential.certificate_status ? `状态: ${credential.certificate_status}\n` : '';
      shareContent += credential.certificate_remark ? `备注: ${credential.certificate_remark}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '证件信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享失败', 'CredentialPanel', error as Error);
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

  const handleRowClick = (credential: Credential) => {
    setPreviewItem(credential);
    setShowPreviewModal(true);
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const credential = credentials.find(c => c.id === contextMenu.targetId);
      if (!credential) return [];

      return [
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(credential); handleCloseContextMenu(); } },
        { id: 'copy-id', label: '复制身份证', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(credential.id_card_number || '', '身份证号已复制'); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'share', label: '分享', icon: <Share2 className="w-4 h-4" />, onClick: () => { handleShareCredential(credential); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openModal(credential); handleCloseContextMenu(); } },
        { id: 'divider3', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个证件信息吗？', () => handleDeleteItem(credential.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-credential', label: '添加证件信息', icon: <Plus className="w-4 h-4" />, onClick: () => { openModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, credentials, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyText, handleDeleteItem, handleShareCredential]);

  return (
    <div className="h-full flex flex-col overflow-hidden" onClick={handleCloseContextMenu}>
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : credentials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无证件信息</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.includes('certificate_name') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">证件名称</th>}
                  {visibleColumns.includes('id_card_number') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">证件号码</th>}
                  {visibleColumns.includes('gender') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">性别</th>}
                  {visibleColumns.includes('birth_date') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">出生日期</th>}
                  {visibleColumns.includes('id_card_address') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">身份证地址</th>}
                  {visibleColumns.includes('bank_name') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">开户行</th>}
                  {visibleColumns.includes('bank_account') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">银行账号</th>}
                  {visibleColumns.includes('phone') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">手机号</th>}
                  {visibleColumns.includes('certificate_status') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">状态</th>}
                  {visibleColumns.includes('certificate_remark') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">备注</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {credentials.map((credential) => (
                  <tr
                    key={credential.id}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(credential)}
                    onContextMenu={(e) => handleContextMenu(e, 'item', credential.id)}
                  >
                    {visibleColumns.includes('certificate_name') && (
                      <td className="px-4 py-3">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{credential.certificate_name}</span>
                      </td>
                    )}
                    {visibleColumns.includes('id_card_number') && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{credential.id_card_number || '-'}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyText(credential.id_card_number || '', '身份证号已复制'); }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="复制身份证号"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('gender') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{credential.gender || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('birth_date') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{credential.birth_date || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('id_card_address') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{credential.id_card_address || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('bank_name') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{credential.bank_name || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('bank_account') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[150px]">{credential.bank_account || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('phone') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{credential.phone || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('certificate_status') && (
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          credential.certificate_status === '正常' ? 'bg-green-50 text-green-600' :
                          credential.certificate_status === '到期' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {credential.certificate_status || '未知'}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('certificate_remark') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words max-w-[200px]">{credential.certificate_remark || '-'}</span>
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? '编辑证件信息' : '添加证件信息'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-3">
          <input type="text" value={credentialForm.certificate_name} onChange={(e) => setCredentialForm(prev => ({ ...prev, certificate_name: e.target.value }))} placeholder="证件名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <input type="text" value={credentialForm.id_card_number} onChange={(e) => handleIdCardChange(e.target.value)} placeholder="身份证号码" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <div className="grid grid-cols-2 gap-3">
            <select value={credentialForm.gender} onChange={(e) => setCredentialForm(prev => ({ ...prev, gender: e.target.value as '' | '男' | '女' }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
              <option value="">性别</option>
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
            <input type="date" value={credentialForm.birth_date} onChange={(e) => setCredentialForm(prev => ({ ...prev, birth_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <input type="text" value={credentialForm.id_card_address} onChange={(e) => setCredentialForm(prev => ({ ...prev, id_card_address: e.target.value }))} placeholder="身份证地址" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <div className="grid grid-cols-2 gap-3">
            <select value={credentialForm.certificate_status} onChange={(e) => setCredentialForm(prev => ({ ...prev, certificate_status: e.target.value as Credential['certificate_status'] }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
              <option value="正常">正常</option>
              <option value="异常">异常</option>
              <option value="过期">过期</option>
            </select>
            <input type="text" value={credentialForm.bank_name} onChange={(e) => setCredentialForm(prev => ({ ...prev, bank_name: e.target.value }))} placeholder="开户银行" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <input type="text" value={credentialForm.bank_account} onChange={(e) => setCredentialForm(prev => ({ ...prev, bank_account: e.target.value }))} placeholder="银行账号" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <SelectWithCustom
            value={credentialForm.phone}
            onChange={(value) => setCredentialForm(prev => ({ ...prev, phone: value }))}
            options={phones.map(p => ({ id: p.id, label: p.phone_number }))}
            placeholder="手机号"
          />
          <textarea value={credentialForm.certificate_remark} onChange={(e) => setCredentialForm(prev => ({ ...prev, certificate_remark: e.target.value }))} placeholder="备注" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.certificate_name || '证件信息详情'}
      />
    </div>
  );
});

export default CredentialPanel;