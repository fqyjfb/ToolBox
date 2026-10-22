import React from 'react';
import { CheckSquare, Square } from 'lucide-react';
import Modal from '../ui/Modal';
import type { PreviewItem } from './ExpandedToolCard';

interface ExpandedToolPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolName: string;
  item: PreviewItem;
  onToggleTodo?: (id: string) => void;
}

/**
 * 扩展工具卡片行点击预览弹窗，展示完整条目详情。
 * todo 类型条目支持勾选完成状态。
 */
const ExpandedToolPreviewModal: React.FC<ExpandedToolPreviewModalProps> = ({
  isOpen, onClose, toolName, item, onToggleTodo,
}) => {
  const isTodo = item.type === 'todo';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={toolName}
      size="sm"
      showCancel={false}
      showConfirm={false}
      clickOutsideToClose
    >
      <div className="flex items-start gap-2">
        {isTodo && onToggleTodo && (
          <button
            onClick={() => onToggleTodo(item.id)}
            className="mt-0.5 flex-shrink-0 text-content-secondary hover:text-accent transition-colors"
            title={isTodo ? '标记为已完成' : '标记为未完成'}
          >
            {item.subtitle === '已完成'
              ? <CheckSquare size={16} className="text-accent" />
              : <Square size={16} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-content-primary break-words">
            {item.title}
          </p>
          {item.subtitle && (
            <p className="text-xs text-content-secondary mt-1">{item.subtitle}</p>
          )}
          {item.detail && (
            <div className="mt-3 pt-3 border-t border-border text-xs text-content-primary whitespace-pre-wrap break-words max-h-48 overflow-y-auto modal-detail-scroll">
              {item.detail}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default React.memo(ExpandedToolPreviewModal);
