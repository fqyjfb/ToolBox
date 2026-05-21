import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Eye } from 'lucide-react';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import { accountService } from '../../../../services/AccountService';
import { Phone, PhoneRequest } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import PreviewModal from '../../../../components/ui/PreviewModal';
import { logError } from '../../../../services/loggerService';

interface PhonePanelProps {
  userId: string;
}

interface PhonePanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const PhonePanel = forwardRef<PhonePanelRef, PhonePanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [phones, setPhones] = useState<Phone[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['phone_number', 'owner', 'phone_operator', 'phone_region', 'status']);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Phone | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<Phone | null>(null);

  const [phoneForm, setPhoneForm] = useState<PhoneRequest>({
    phone_number: '', owner: '', phone_operator: '', phone_region: '', status: '正常', remarks: ''
  });

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useImperativeHandle(ref, () => ({
    openModal: (phone?: Phone) => {
      if (phone) {
        setEditingItem(phone);
        setPhoneForm({
          phone_number: phone.phone_number,
          owner: phone.owner,
          phone_operator: phone.phone_operator,
          phone_region: phone.phone_region,
          status: phone.status,
          remarks: phone.remarks
        });
      } else {
        setEditingItem(null);
        setPhoneForm({
          phone_number: '', owner: '', phone_operator: '', phone_region: '', status: '正常', remarks: ''
        });
      }
      setShowModal(true);
    },
    setVisibleColumns: (columns: string[]) => {
      setVisibleColumns(columns);
    }
  }));

  const loadData = useCallback(async (pageNum: number = 1) => {
    try {
      setLoading(true);
      let result;
      if (isSearchActive && searchQuery.trim()) {
        result = await accountService.searchPhones(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        result = await accountService.getPhones(userId, pageNum, pageSize);
      }
      setPhones(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载手机号数据失败', 'PhonePanel', error as Error);
      addToast({ message: '加载手机号数据失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [userId, searchQuery, isSearchActive, pageSize, addToast]);

  useEffect(() => {
    loadData(1);
  }, [loadData]);

  useEffect(() => {
    if (currentPage > 1) {
      loadData(currentPage);
    }
  }, [currentPage, loadData]);

  useEffect(() => {
    setCurrentPage(1);
    loadData(1);
  }, [searchQuery, isSearchActive, loadData]);

  const openModal = (item: Phone | null = null) => {
    setEditingItem(item);
    if (item) {
      setPhoneForm({
        phone_number: item.phone_number, owner: item.owner, phone_operator: item.phone_operator,
        phone_region: item.phone_region, status: item.status, remarks: item.remarks
      });
    } else {
      setPhoneForm({
        phone_number: '', owner: '', phone_operator: '', phone_region: '', status: '正常', remarks: ''
      });
    }
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!phoneForm.phone_number.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await accountService.updatePhone(userId, editingItem.id, phoneForm);
      } else {
        await accountService.createPhone(userId, phoneForm);
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
      await accountService.deletePhone(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadData(currentPage);
    } catch (error) {
      console.error('删除失败:', error);
      addToast({ message: '删除失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, loadData, currentPage]);

  const handleCopyText = useCallback(async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message, type: 'success' });
    } catch (error) {
      console.error('复制失败:', error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleSharePhone = useCallback(async (phone: Phone) => {
    try {
      let shareContent = `${phone.phone_number}\n`;
      shareContent += phone.owner ? `机主: ${phone.owner}\n` : '';
      shareContent += phone.phone_operator ? `运营商: ${phone.phone_operator}\n` : '';
      shareContent += phone.phone_region ? `地区: ${phone.phone_region}\n` : '';
      shareContent += phone.status ? `状态: ${phone.status}\n` : '';
      shareContent += phone.remarks ? `备注: ${phone.remarks}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '手机号信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享失败', 'PhonePanel', error as Error);
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

  const handleRowClick = (phone: Phone) => {
    setPreviewItem(phone);
    setShowPreviewModal(true);
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const phone = phones.find(p => p.id === contextMenu.targetId);
      if (!phone) return [];

      return [
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(phone); handleCloseContextMenu(); } },
        { id: 'copy-phone', label: '复制手机号', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(phone.phone_number || '', '手机号已复制'); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'share', label: '分享', icon: <Share2 className="w-4 h-4" />, onClick: () => { handleSharePhone(phone); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openModal(phone); handleCloseContextMenu(); } },
        { id: 'divider3', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个手机号吗？', () => handleDeleteItem(phone.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-phone', label: '添加手机号', icon: <Plus className="w-4 h-4" />, onClick: () => { openModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, phones, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyText, handleDeleteItem, handleSharePhone]);

  return (
    <div className="h-full flex flex-col" onClick={handleCloseContextMenu}>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : phones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无手机号</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.includes('phone_number') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">手机号</th>}
                  {visibleColumns.includes('owner') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">机主</th>}
                  {visibleColumns.includes('phone_operator') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">运营商</th>}
                  {visibleColumns.includes('phone_region') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">地区</th>}
                  {visibleColumns.includes('status') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">状态</th>}
                  {visibleColumns.includes('remarks') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">备注</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {phones.map((phone) => (
                  <tr
                    key={phone.id}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(phone)}
                    onContextMenu={(e) => handleContextMenu(e, 'item', phone.id)}
                  >
                    {visibleColumns.includes('phone_number') && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 dark:text-white">{phone.phone_number}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyText(phone.phone_number, '手机号已复制'); }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                            title="复制手机号"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('owner') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-900 dark:text-white">{phone.owner || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('phone_operator') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{phone.phone_operator || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('phone_region') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{phone.phone_region || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('status') && (
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          phone.status === '正常' ? 'bg-green-50 text-green-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {phone.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.includes('remarks') && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap break-words max-w-[200px]">{phone.remarks || '-'}</span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 mt-4">
        <Pagination currentPage={currentPage} total={total} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? '编辑手机号' : '添加手机号'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-3">
          <input type="text" value={phoneForm.phone_number} onChange={(e) => setPhoneForm(prev => ({ ...prev, phone_number: e.target.value }))} placeholder="手机号码" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <input type="text" value={phoneForm.owner} onChange={(e) => setPhoneForm(prev => ({ ...prev, owner: e.target.value }))} placeholder="机主姓名" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={phoneForm.phone_operator} onChange={(e) => setPhoneForm(prev => ({ ...prev, phone_operator: e.target.value }))} placeholder="运营商" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <input type="text" value={phoneForm.phone_region} onChange={(e) => setPhoneForm(prev => ({ ...prev, phone_region: e.target.value }))} placeholder="地区" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <select value={phoneForm.status} onChange={(e) => setPhoneForm(prev => ({ ...prev, status: e.target.value as Phone['status'] }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white">
            <option value="正常">正常</option>
            <option value="停用">停用</option>
          </select>
          <textarea value={phoneForm.remarks} onChange={(e) => setPhoneForm(prev => ({ ...prev, remarks: e.target.value }))} placeholder="备注" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.phone_number || '手机号详情'}
      />
    </div>
  );
});

export default PhonePanel;