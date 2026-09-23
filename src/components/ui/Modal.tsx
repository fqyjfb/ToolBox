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
  confirmVariant?: 'primary' | 'danger';
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
  confirmVariant = 'primary',
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
          bg-surface rounded-lg shadow-lg
          overflow-hidden
          animate-[slideIn_0.25s_cubic-bezier(0.175,0.885,0.32,1.275)]
          ${className}
        `}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 bg-surface-60">
            <h2 className="text-sm font-semibold text-content-primary">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-content-secondary hover:text-content-primary hover:bg-menu-hover transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="p-4">
          {children}
        </div>
        {(showCancel || showConfirm) && (
          <div className="flex items-center justify-center gap-3 px-4 py-3 bg-surface-40">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-sm font-medium text-content-secondary bg-surface-secondary rounded-md hover:bg-menu-hover transition-colors"
              >
                {cancelText}
              </button>
            )}
            {showConfirm && onConfirm && (
              <button
                onClick={onConfirm}
                disabled={confirmDisabled}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  confirmVariant === 'danger'
                    ? 'text-white bg-red-600 hover:bg-red-700'
                    : 'text-button-text bg-primary dark:bg-primary hover:bg-primary/90 dark:hover:bg-primary/90'
                }`}
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