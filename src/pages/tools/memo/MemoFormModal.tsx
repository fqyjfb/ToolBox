import React from 'react';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
import type { MemoCategory } from '../../../types/memo';
import { modalControlClass, modalTextareaScrollClass } from '../account/shared';
import type { MemoPriority } from './memoPriority';

interface MemoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  priority: MemoPriority;
  categoryId: string | null;
  categories: MemoCategory[];
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onPriorityChange: (value: MemoPriority) => void;
  onCategoryChange: (value: string | null) => void;
  onConfirm: () => void;
  /** 弹窗标题，默认「添加备忘」（首页卡片编辑场景传入「编辑备忘」） */
  modalTitle?: string;
  /** 确认按钮文案，默认「添加」 */
  confirmText?: string;
}

/** 备忘录新增表单：工具页与首页卡片新增入口共用 */
const MemoFormModal: React.FC<MemoFormModalProps> = ({
  isOpen, onClose, title, content, priority, categoryId, categories,
  onTitleChange, onContentChange, onPriorityChange, onCategoryChange, onConfirm,
  modalTitle = '添加备忘', confirmText = '添加',
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={modalTitle}
    confirmText={confirmText}
    onConfirm={onConfirm}
    confirmDisabled={!title.trim()}
    clickOutsideToClose={false}
  >
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={priority}
          onChange={(v) => onPriorityChange(v as MemoPriority)}
          options={[
            { value: 'high', label: '高优先级' },
            { value: 'medium', label: '中优先级' },
            { value: 'low', label: '低优先级' },
          ]}
          className={modalControlClass}
        />
        <Select
          value={categoryId || ''}
          onChange={(v) => onCategoryChange(v || null)}
          options={[
            { value: '', label: '全部' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          className={modalControlClass}
        />
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="标题"
        className={modalControlClass}
      />
      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="内容"
        rows={5}
        className={modalTextareaScrollClass}
      />
    </div>
  </Modal>
);

export default React.memo(MemoFormModal);
