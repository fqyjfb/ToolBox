import React, { useEffect, useRef } from 'react';
import { useToastStore } from '../../store/toastStore';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';

const Toast: React.FC = () => {
  const { toasts, removeToast } = useToastStore();
  const toastRefs = useRef<HTMLLIElement[]>([]);

  useEffect(() => {
    if (toasts.length > 0) {
      const newToast = toastRefs.current[toasts.length - 1];
      if (newToast) {
        setTimeout(() => {
          newToast.classList.add('show');
        }, 10);
      }
    }
  }, [toasts]);

  const getToastTypeStyles = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200';
      case 'info':
        return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const getToastIcon = (type: string) => {
    const iconClass = 'w-5 h-5';
    switch (type) {
      case 'success':
        return <CheckCircle className={iconClass} />;
      case 'error':
        return <XCircle className={iconClass} />;
      case 'warning':
        return <AlertCircle className={iconClass} />;
      case 'info':
        return <Info className={iconClass} />;
      default:
        return <Info className={iconClass} />;
    }
  };

  const getProgressBarColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-600 dark:bg-green-400';
      case 'error':
        return 'bg-red-600 dark:bg-red-400';
      case 'warning':
        return 'bg-amber-600 dark:bg-amber-400';
      case 'info':
        return 'bg-blue-600 dark:bg-blue-400';
      default:
        return 'bg-gray-600 dark:bg-gray-400';
    }
  };

  return (
    <div className="fixed top-[8%] left-1/2 -translate-x-1/2 z-[1000] max-w-[80%]">
      <ul className="flex flex-col gap-2 list-none font-sans">
        {toasts.map((toast, index) => (
          <li
            key={toast.id}
            ref={(el) => {
              if (el) toastRefs.current[index] = el;
            }}
            role="alert"
            className={`relative flex items-center justify-between gap-4 p-3 px-4 min-w-[280px] max-w-[400px] rounded-md shadow-lg border transition-all duration-250 ${getToastTypeStyles(toast.type)}`}
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="flex-shrink-0">{getToastIcon(toast.type)}</span>
              <span className="text-sm select-none">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-250"
            >
              <X className="w-4 h-4" />
            </button>
            <div className={`absolute bottom-0 left-0 h-[1px] w-full ${getProgressBarColor(toast.type)} animate-toast-progress-origin-left`} />
          </li>
        ))}
      </ul>
      <style>{`
        @keyframes toast-progress-origin-left {
          from {
            transform: scaleX(1);
            transform-origin: left;
          }
          to {
            transform: scaleX(0);
            transform-origin: left;
          }
        }
        .animate-toast-progress-origin-left {
          animation: toast-progress-origin-left var(--duration-toast, 5s) linear forwards;
        }
      `}</style>
    </div>
  );
};

export default React.memo(Toast);
