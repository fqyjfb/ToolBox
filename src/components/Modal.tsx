import React, { useEffect, useCallback } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (...args: any[]) => void;
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (clickOutsideToClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full ${sizeClasses[size]} animate-fade-in`}
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <span className="text-xl">&times;</span>
          </button>
        </div>
        <div className="p-4">{children}</div>
        {(showCancel || showConfirm) && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {cancelText}
              </button>
            )}
            {showConfirm && (
              <button
                onClick={onConfirm || onClose}
                disabled={confirmDisabled}
                className="modal-confirm-btn px-4 py-2 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md transition-colors"
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
        .modal-confirm-btn:not(:disabled) {
          background-color: var(--color-primary);
        }
        .modal-confirm-btn:not(:disabled):hover {
          background-color: var(--color-primary-hover, #0085a0);
        }
      `}</style>
    </div>
  );
};

export default Modal;