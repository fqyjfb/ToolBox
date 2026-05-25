import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Plus, Edit, Trash2, Copy, Share2, Eye } from 'lucide-react';
import { useNavSearch } from '../../../../contexts/NavSearchContext';
import { accountService } from '../../../../services/AccountService';
import { Company, CompanyRequest } from '../../../../types/account';
import { useToastStore } from '../../../../store/toastStore';
import LoadingSpinner from '../../../../components/ui/LoadingSpinner';
import Modal from '../../../../components/ui/Modal';
import ConfirmDialog from '../../../../components/ui/ConfirmDialog';
import Pagination from '../../../../components/ui/Pagination';
import ContextMenu, { ContextMenuItem } from '../../../../components/ui/ContextMenu';
import PreviewModal from '../../../../components/ui/PreviewModal';
import { logError } from '../../../../services/loggerService';

interface CompanyPanelProps {
  userId: string;
}

interface CompanyPanelRef {
  openModal: () => void;
  setVisibleColumns: (columns: string[]) => void;
}

const CompanyPanel = forwardRef<CompanyPanelRef, CompanyPanelProps>(({ userId }, ref) => {
  const addToast = useToastStore((state) => state.addToast);
  const { searchQuery, isSearchActive } = useNavSearch();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(['name', 'unified_social_credit_code', 'legal_person']);

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<Company | null>(null);

  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<Company | null>(null);

  const [companyForm, setCompanyForm] = useState<CompanyRequest>({
    name: '', unified_social_credit_code: '', legal_person: '', establishment_date: '',
    address: '', registered_capital: '', business_scope: ''
  });

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean; x: number; y: number; type: 'item' | 'empty'; targetId?: string;
  }>({ isOpen: false, x: 0, y: 0, type: 'empty' });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  useImperativeHandle(ref, () => ({
    openModal: (company?: Company) => {
      if (company) {
        setEditingItem(company);
        setCompanyForm({
          name: company.name,
          unified_social_credit_code: company.unified_social_credit_code,
          legal_person: company.legal_person,
          establishment_date: company.establishment_date,
          address: company.address,
          registered_capital: company.registered_capital,
          business_scope: company.business_scope
        });
      } else {
        setEditingItem(null);
        setCompanyForm({
          name: '', unified_social_credit_code: '', legal_person: '', establishment_date: '',
          address: '', registered_capital: '', business_scope: ''
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
        result = await accountService.searchCompanies(userId, searchQuery.trim(), pageNum, pageSize);
      } else {
        result = await accountService.getCompanies(userId, pageNum, pageSize);
      }
      setCompanies(result.list);
      setTotal(result.total);
      setCurrentPage(pageNum);
    } catch (error) {
      logError('加载企业信息失败', 'CompanyPanel', error as Error);
      addToast({ message: '加载企业信息失败', type: 'error' });
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

  const openModal = (item: Company | null = null) => {
    setEditingItem(item);
    if (item) {
      setCompanyForm({
        name: item.name, unified_social_credit_code: item.unified_social_credit_code,
        legal_person: item.legal_person, establishment_date: item.establishment_date,
        address: item.address, registered_capital: item.registered_capital,
        business_scope: item.business_scope
      });
    } else {
      setCompanyForm({
        name: '', unified_social_credit_code: '', legal_person: '', establishment_date: '',
        address: '', registered_capital: '', business_scope: ''
      });
    }
    setShowModal(true);
  };

  const saveItem = async () => {
    if (!companyForm.name.trim()) return;
    try {
      setLoading(true);
      if (editingItem) {
        await accountService.updateCompany(userId, editingItem.id, companyForm);
      } else {
        await accountService.createCompany(userId, companyForm);
      }
      addToast({ message: editingItem ? '更新成功' : '创建成功', type: 'success' });
      await loadData(1);
      setShowModal(false);
      setEditingItem(null);
    } catch (error) {
      logError('保存失败', 'CompanyPanel', error as Error);
      addToast({ message: '保存失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await accountService.deleteCompany(userId, id);
      addToast({ message: '删除成功', type: 'success' });
      await loadData(currentPage);
    } catch (error) {
      logError('删除失败', 'CompanyPanel', error as Error);
      addToast({ message: '删除失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [addToast, loadData, currentPage, userId]);

  const handleCopyText = useCallback(async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ message: successMsg, type: 'success' });
    } catch (error) {
      logError('复制失败', 'CompanyPanel', error as Error);
      addToast({ message: '浏览器权限限制，请手动复制', type: 'warning' });
    }
  }, [addToast]);

  const handleShareCompany = useCallback(async (company: Company) => {
    try {
      let shareContent = `${company.name}\n`;
      shareContent += company.unified_social_credit_code ? `统一社会信用代码: ${company.unified_social_credit_code}\n` : '';
      shareContent += company.legal_person ? `法人: ${company.legal_person}\n` : '';
      shareContent += company.establishment_date ? `成立日期: ${company.establishment_date}\n` : '';
      shareContent += company.registered_capital ? `注册资本: ${company.registered_capital}\n` : '';
      shareContent += company.address ? `地址: ${company.address}\n` : '';
      shareContent += company.business_scope ? `经营范围: ${company.business_scope}\n` : '';
      await navigator.clipboard.writeText(shareContent.trim());
      addToast({ message: '企业信息已复制到剪贴板', type: 'success' });
    } catch (error) {
      logError('分享失败', 'CompanyPanel', error as Error);
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

  const handleRowClick = (company: Company) => {
    setPreviewItem(company);
    setShowPreviewModal(true);
  };

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    if (contextMenu.type === 'item' && contextMenu.targetId) {
      const company = companies.find(c => c.id === contextMenu.targetId);
      if (!company) return [];

      return [
        { id: 'view', label: '查看详情', icon: <Eye className="w-4 h-4" />, onClick: () => { handleRowClick(company); handleCloseContextMenu(); } },
        { id: 'copy-code', label: '复制信用代码', icon: <Copy className="w-4 h-4" />, onClick: () => { handleCopyText(company.unified_social_credit_code || '', '信用代码已复制'); handleCloseContextMenu(); } },
        { id: 'divider1', label: '', divider: true },
        { id: 'share', label: '分享', icon: <Share2 className="w-4 h-4" />, onClick: () => { handleShareCompany(company); handleCloseContextMenu(); } },
        { id: 'divider2', label: '', divider: true },
        { id: 'edit', label: '编辑', icon: <Edit className="w-4 h-4" />, onClick: () => { openModal(company); handleCloseContextMenu(); } },
        { id: 'divider3', label: '', divider: true },
        { id: 'delete', label: '删除', icon: <Trash2 className="w-4 h-4" />, onClick: () => handleOpenConfirmDialog('删除确认', '确定要删除这个企业信息吗？', () => handleDeleteItem(company.id)) }
      ];
    }

    if (contextMenu.type === 'empty') {
      return [
        { id: 'add-company', label: '添加企业信息', icon: <Plus className="w-4 h-4" />, onClick: () => { openModal(); handleCloseContextMenu(); } }
      ];
    }

    return [];
  }, [contextMenu.type, contextMenu.targetId, companies, handleCloseContextMenu, handleOpenConfirmDialog, handleCopyText, handleDeleteItem, handleShareCompany]);

  return (
    <div className="h-full flex flex-col" onClick={handleCloseContextMenu}>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : companies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"/>
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">暂无企业信息</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  {visibleColumns.includes('name') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">企业名称</th>}
                  {visibleColumns.includes('unified_social_credit_code') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">统一社会信用代码</th>}
                  {visibleColumns.includes('legal_person') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">法人</th>}
                  {visibleColumns.includes('establishment_date') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">成立日期</th>}
                  {visibleColumns.includes('address') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">注册地址</th>}
                  {visibleColumns.includes('registered_capital') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">注册资本</th>}
                  {visibleColumns.includes('business_scope') && <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider max-w-[120px] truncate">经营范围</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {companies.map((company) => (
                  <tr
                    key={company.id}
                    className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(company)}
                    onContextMenu={(e) => handleContextMenu(e, 'item', company.id)}
                  >
                    {visibleColumns.includes('name') && (
                      <td className="px-4 py-3 max-w-[120px] whitespace-pre-wrap break-words">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{company.name}</span>
                      </td>
                    )}
                    {visibleColumns.includes('unified_social_credit_code') && (
                      <td className="px-4 py-3 max-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{company.unified_social_credit_code || '-'}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCopyText(company.unified_social_credit_code || '', '信用代码已复制'); }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex-shrink-0"
                            title="复制信用代码"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    )}
                    {visibleColumns.includes('legal_person') && (
                      <td className="px-4 py-3 max-w-[120px] whitespace-pre-wrap break-words">
                        <span className="text-sm text-gray-900 dark:text-white">{company.legal_person || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('establishment_date') && (
                      <td className="px-4 py-3 max-w-[120px] whitespace-pre-wrap break-words">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{company.establishment_date || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('address') && (
                      <td className="px-4 py-3 max-w-[120px] whitespace-pre-wrap break-words">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{company.address || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('registered_capital') && (
                      <td className="px-4 py-3 max-w-[120px] whitespace-pre-wrap break-words">
                        <span className="text-sm text-gray-500 dark:text-gray-400">{company.registered_capital || '-'}</span>
                      </td>
                    )}
                    {visibleColumns.includes('business_scope') && (
                      <td className="px-4 py-3 max-w-[120px]">
                        <span 
                          className="text-sm text-gray-500 dark:text-gray-400"
                          style={{ 
                            display: '-webkit-box', 
                            WebkitLineClamp: 2, 
                            WebkitBoxOrient: 'vertical', 
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >{company.business_scope || '-'}</span>
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingItem(null); }} title={editingItem ? '编辑企业信息' : '添加企业信息'} confirmText="保存" onConfirm={saveItem}>
        <div className="space-y-3">
          <input type="text" value={companyForm.name} onChange={(e) => setCompanyForm(prev => ({ ...prev, name: e.target.value }))} placeholder="企业名称" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <input type="text" value={companyForm.unified_social_credit_code} onChange={(e) => setCompanyForm(prev => ({ ...prev, unified_social_credit_code: e.target.value }))} placeholder="统一社会信用代码" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <input type="text" value={companyForm.legal_person} onChange={(e) => setCompanyForm(prev => ({ ...prev, legal_person: e.target.value }))} placeholder="法人" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={companyForm.establishment_date} onChange={(e) => setCompanyForm(prev => ({ ...prev, establishment_date: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
            <input type="text" value={companyForm.registered_capital} onChange={(e) => setCompanyForm(prev => ({ ...prev, registered_capital: e.target.value }))} placeholder="注册资本" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          </div>
          <textarea value={companyForm.address} onChange={(e) => setCompanyForm(prev => ({ ...prev, address: e.target.value }))} placeholder="地址" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
          <textarea value={companyForm.business_scope} onChange={(e) => setCompanyForm(prev => ({ ...prev, business_scope: e.target.value }))} placeholder="经营范围" rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-500 dark:bg-gray-700 dark:text-white" />
        </div>
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={handleCloseConfirmDialog} onConfirm={() => { confirmDialog.onConfirm(); handleCloseConfirmDialog(); }} title={confirmDialog.title} message={confirmDialog.message} />

      <ContextMenu isOpen={contextMenu.isOpen} x={contextMenu.x} y={contextMenu.y} items={getContextMenuItems()} onClose={handleCloseContextMenu} />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        item={previewItem}
        title={previewItem?.name || '企业信息详情'}
      />
    </div>
  );
});

export default CompanyPanel;