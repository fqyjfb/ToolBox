import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (...args: unknown[]) => void;
  confirmDisabled?: boolean;
  showCancel?: boolean;
  showConfirm?: boolean;
  size?: 'sm' | 'md' | 'lg';
  clickOutsideToClose?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  confirmDisabled = false,
  showCancel = true,
  showConfirm = true,
  size = 'md',
  clickOutsideToClose = false,
}) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3"
      onClick={(e) => {
        if (clickOutsideToClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full ${sizeClasses[size]} animate-modal-in`}
      >
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2.5">{children}</div>
        {(showCancel || showConfirm) && (
          <div className="flex justify-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                {cancelText}
              </button>
            )}
            {showConfirm && (
              <button
                onClick={onConfirm || onClose}
                disabled={confirmDisabled}
                className="px-3.5 py-1.5 text-sm font-medium text-white bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes modal-in {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-in {
          animation: modal-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
};

export default Modal;