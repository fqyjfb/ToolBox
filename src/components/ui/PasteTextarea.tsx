import React from 'react';
import { ClipboardPaste } from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { logError } from '../../services/loggerService';

interface PasteTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  /** 文本框样式（各页面传入自己的表单控件类） */
  className?: string;
}

/** 带「粘贴剪贴板」按钮的多行输入框，快捷回复与云剪贴板的表单共用 */
const PasteTextarea: React.FC<PasteTextareaProps> = ({ value, onChange, placeholder, rows = 4, className = '' }) => {
  const addToast = useToastStore((state) => state.addToast);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch (error) {
      logError('Error pasting from clipboard', 'PasteTextarea', error as Error);
      addToast({ message: '浏览器权限限制，请手动粘贴', type: 'warning' });
    }
  };

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={handlePaste}
        title="粘贴剪贴板内容"
        className="absolute top-2 right-2 p-1.5 rounded-md text-content-tertiary hover:text-content-primary transition-colors"
      >
        <ClipboardPaste className="w-4 h-4" />
      </button>
    </div>
  );
};

export default React.memo(PasteTextarea);
