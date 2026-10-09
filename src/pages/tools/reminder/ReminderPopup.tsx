import React, { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';

interface ReminderData {
  title: string;
  content: string;
  id?: string;
}

const ReminderPopup: React.FC = () => {
  const [reminder, setReminder] = useState<ReminderData | null>(null);

  useEffect(() => {
    const handleShow = (data: ReminderData) => {
      if (!data || reminder) return;
      setReminder(data);
    };
    window.electron?.onShowReminder?.(handleShow);
    return () => {
      window.electron?.onShowReminder?.(() => {});
    };
  }, []);

  const handleClose = () => {
    window.close();
  };

  if (!reminder) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg-primary text-text-secondary text-sm">
        加载中...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary rounded-lg overflow-hidden shadow-lg"
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}
    >
      {/* 标题栏：frameless 窗口自定义拖拽区 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-primary"
        style={{ ['-webkit-app-region' as string]: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-1.5 text-text-primary text-sm font-semibold">
          <Bell size={14} className="text-primary" />
          定时提醒
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded hover:bg-bg-secondary text-text-tertiary hover:text-text-primary transition-colors"
          style={{ ['-webkit-app-region' as string]: 'no-drag' } as React.CSSProperties}
          title="关闭"
        >
          <X size={14} />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 px-4 py-3 overflow-y-auto scrollbar-hide">
        <h3 className="text-base font-semibold text-text-primary mb-2 break-words">
          {reminder.title}
        </h3>
        {reminder.content ? (
          <p className="text-sm text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
            {reminder.content}
          </p>
        ) : (
          <p className="text-sm text-text-tertiary italic">（无内容）</p>
        )}
      </div>

      {/* 底部操作栏 */}
      <div className="flex justify-end px-4 py-3 border-t border-border-primary">
        <button
          onClick={handleClose}
          className="px-4 py-1.5 rounded-md text-sm font-medium bg-primary text-button-text hover:brightness-110 transition-all"
        >
          知道了
        </button>
      </div>
    </div>
  );
};

export default ReminderPopup;
