import React from 'react';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
import PasteTextarea from '../../../components/ui/PasteTextarea';
import type { ClipboardCategory } from '../../../types/clipboard';
import { modalControlClass, modalTextareaScrollClass } from '../account/shared';

interface ClipboardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  categoryId: string | null;
  categories: ClipboardCategory[];
  onContentChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onConfirm: () => void;
  /** 弹窗标题，默认「添加项目」（首页卡片编辑场景传入「编辑项目」） */
  modalTitle?: string;
  /** 确认按钮文案，默认「添加」 */
  confirmText?: string;
}

/** 云剪贴板新增表单：工具页与首页卡片新增入口共用 */
const ClipboardFormModal: React.FC<ClipboardFormModalProps> = ({
  isOpen, onClose, content, categoryId, categories, onContentChange, onCategoryChange, onConfirm,
  modalTitle = '添加项目', confirmText = '添加',
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={modalTitle}
    confirmText={confirmText}
    onConfirm={onConfirm}
    confirmDisabled={!content.trim()}
    clickOutsideToClose={false}
  >
    <div className="space-y-2">
      <Select
        value={categoryId || ''}
        onChange={(v) => onCategoryChange(v || null)}
        options={[
          { value: '', label: '全部' },
          ...categories.map((category) => ({ value: category.id, label: category.name })),
        ]}
        className={modalControlClass}
      />
      <PasteTextarea
        value={content}
        onChange={onContentChange}
        placeholder="内容"
        rows={4}
        className={modalTextareaScrollClass}
      />
    </div>
  </Modal>
);

export default React.memo(ClipboardFormModal);
