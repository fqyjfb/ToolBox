import React from 'react';
import { Bell, BellOff, Clock, Repeat, Monitor, MessageSquare } from 'lucide-react';
import type { Reminder } from '../../../types/reminder';
import { REPEAT_LABEL_MAP, NOTIFY_METHOD_LABEL_MAP } from '../../../constants/reminder';
import { toLocalDateTimeString } from '../../../utils';

interface ReminderCardProps {
  reminder: Reminder;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

const formatRemindTime = (remindTime: string): string => {
  if (!remindTime) return '';
  const d = new Date(remindTime);
  if (Number.isNaN(d.getTime())) return remindTime;
  return toLocalDateTimeString(d);
};

const ReminderCard: React.FC<ReminderCardProps> = ({ reminder, onToggleEnabled, onContextMenu }) => {
  const enabled = reminder.is_enabled;

  return (
    <div
      className="reminder-card rounded-lg p-3 cursor-pointer transition-colors"
      style={{ backgroundColor: 'color-mix(in srgb, var(--color-card) 60%, transparent)' }}
      onContextMenu={(e) => onContextMenu(e, reminder.id)}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleEnabled(reminder.id, !enabled);
          }}
          className={`p-1 rounded transition-colors ${enabled ? 'text-primary hover:bg-menu-hover' : 'text-content-tertiary hover:bg-menu-hover'}`}
          title={enabled ? '已启用，点击禁用' : '已禁用，点击启用'}
        >
          {enabled ? <Bell size={14} /> : <BellOff size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${enabled ? 'bg-primary/10 text-primary' : 'bg-surface-secondary text-content-tertiary'}`}>
              <Clock size={8} />
              {formatRemindTime(reminder.remind_time)}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface-secondary text-content-secondary flex items-center gap-0.5">
              <Repeat size={8} />
              {REPEAT_LABEL_MAP[reminder.repeat_type]}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-surface-secondary text-content-secondary flex items-center gap-0.5">
              {reminder.notify_method === 'system' ? <Monitor size={8} /> : <MessageSquare size={8} />}
              {NOTIFY_METHOD_LABEL_MAP[reminder.notify_method]}
            </span>
          </div>
          <h3 className={`text-sm font-medium truncate ${enabled ? 'text-content-primary' : 'text-content-tertiary line-through'}`}>
            {reminder.title}
          </h3>
          {reminder.content && (
            <p className="text-xs text-content-secondary whitespace-pre-wrap break-words max-h-32 overflow-hidden mt-1">
              {reminder.content}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ReminderCard);
