import React from 'react';
import Modal from './Modal';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  deleteItemName?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '确认操作',
  message = '确定要执行此操作吗？',
  confirmText = '确定',
  cancelText = '取消',
  deleteItemName,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      confirmText={confirmText}
      cancelText={cancelText}
      onConfirm={handleConfirm}
      showCancel={true}
      showConfirm={true}
      size="sm"
    >
      <div className="py-2">
        <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
        {deleteItemName && (
          <p className="text-red-500 dark:text-red-400 text-sm mt-2 font-medium">
            {deleteItemName}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmDialog;