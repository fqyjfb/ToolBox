import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
  showConfirm?: boolean;
  confirmDisabled?: boolean;
  clickOutsideToClose?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  size = 'md',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  showCancel = true,
  showConfirm = true,
  confirmDisabled = false,
  clickOutsideToClose = false,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      if (e.key === 'Enter' && isOpen && !e.shiftKey && !confirmDisabled && !(e.target instanceof HTMLTextAreaElement)) {
        onConfirm?.();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose, onConfirm, confirmDisabled]);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      const firstInput = modalRef.current.querySelector('input, textarea, button') as HTMLElement;
      firstInput?.focus();
    }
  }, [isOpen]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (clickOutsideToClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={handleOverlayClick}
      />
      <div
        ref={modalRef}
        className={`
          relative w-full ${sizeClasses[size]} mx-4
          bg-white dark:bg-gray-800 rounded-lg shadow-lg
          border border-gray-200 dark:border-gray-700
          overflow-hidden
          animate-[slideIn_0.25s_cubic-bezier(0.175,0.885,0.32,1.275)]
          ${className}
        `}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-4">
          {children}
        </div>
        {(showCancel || showConfirm) && (
          <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {cancelText}
              </button>
            )}
            {showConfirm && onConfirm && (
              <button
                onClick={onConfirm}
                disabled={confirmDisabled}
                className="px-4 py-1.5 text-sm font-medium text-button-text bg-primary dark:bg-primary rounded-md hover:bg-primary/90 dark:hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default Modal;