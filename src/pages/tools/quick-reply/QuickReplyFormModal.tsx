import React from 'react';
import Modal from '../../../components/ui/Modal';
import PasteTextarea from '../../../components/ui/PasteTextarea';
import { modalTextareaScrollClass } from '../account/shared';

interface QuickReplyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (value: string) => void;
  onConfirm: () => void;
  /** 弹窗标题，默认「添加快捷回复」（首页卡片编辑场景传入「编辑快捷回复」） */
  modalTitle?: string;
  /** 确认按钮文案，默认「添加」 */
  confirmText?: string;
}

/** 快捷回复新增表单：工具页与首页卡片新增入口共用 */
const QuickReplyFormModal: React.FC<QuickReplyFormModalProps> = ({
  isOpen, onClose, content, onContentChange, onConfirm,
  modalTitle = '添加快捷回复', confirmText = '添加',
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
    <PasteTextarea
      value={content}
      onChange={onContentChange}
      placeholder="快捷回复内容"
      rows={4}
      className={modalTextareaScrollClass}
    />
  </Modal>
);

export default React.memo(QuickReplyFormModal);
