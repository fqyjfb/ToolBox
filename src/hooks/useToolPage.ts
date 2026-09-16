import { useCallback } from 'react';
import { useToastStore } from '../store/toastStore';

export const useToolPage = () => {
  const addToast = useToastStore((state) => state.addToast);

  const handleCopy = useCallback((text: string, successMsg?: string, failMsg?: string) => {
    if (!text || text === '不支持') {
      addToast({ message: '没有可复制的内容', type: 'warning' });
      return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
      addToast({ message: successMsg || '已复制到剪贴板', type: 'success' });
    }).catch(() => {
      addToast({ message: failMsg || '复制失败', type: 'error' });
    });
  }, [addToast]);

  return { handleCopy, addToast };
};