import React from 'react';
import Modal from '../../../components/ui/Modal';
import PasteTextarea from '../../../components/ui/PasteTextarea';
import { modalTextareaClass } from '../account/shared';

interface QuickReplyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  onContentChange: (value: string) => void;
  onConfirm: () => void;
}

/** 快捷回复新增表单：工具页与首页卡片新增入口共用 */
const QuickReplyFormModal: React.FC<QuickReplyFormModalProps> = ({
  isOpen, onClose, content, onContentChange, onConfirm,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title="添加快捷回复"
    confirmText="添加"
    onConfirm={onConfirm}
    confirmDisabled={!content.trim()}
    clickOutsideToClose={false}
  >
    <PasteTextarea
      value={content}
      onChange={onContentChange}
      placeholder="快捷回复内容"
      rows={4}
      className={modalTextareaClass}
    />
  </Modal>
);

export default React.memo(QuickReplyFormModal);
