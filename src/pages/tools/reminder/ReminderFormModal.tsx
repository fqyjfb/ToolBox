import React, { useState, useEffect } from 'react';
import { zh as chronoZh } from 'chrono-node';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
import type { Reminder, CreateReminderRequest, UpdateReminderRequest, ReminderRepeatType, ReminderNotifyMethod } from '../../../types/reminder';
import { REPEAT_TYPES, NOTIFY_METHODS } from '../../../constants/reminder';
import { modalControlClass, modalTextareaScrollClass } from '../account/shared';
import { formatDateTimeForInput, toLocalDateTimeString } from '../../../utils';

interface ReminderFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingReminder: Reminder | null;
  formData: CreateReminderRequest & { is_enabled?: boolean };
  onFormDataChange: (data: CreateReminderRequest & { is_enabled?: boolean }) => void;
  onConfirm: () => void;
}

const labelClass = 'block text-xs font-medium text-text-secondary mb-1';

const ReminderFormModal: React.FC<ReminderFormModalProps> = ({
  isOpen,
  onClose,
  editingReminder,
  formData,
  onFormDataChange,
  onConfirm,
}) => {
  const isEdit = !!editingReminder;
  const confirmDisabled = !formData.title.trim() || !formData.remind_time;

  // 智能时间输入：解析自然语言后回写 remind_time，上方的原生选择器随之同步；
  // 两个控件写的是同一个字段，不存在第二份状态
  const [smartText, setSmartText] = useState('');
  const [smartHint, setSmartHint] = useState('');
  const [smartFailed, setSmartFailed] = useState(false);

  useEffect(() => {
    if (isOpen) return;
    setSmartText('');
    setSmartHint('');
    setSmartFailed(false);
  }, [isOpen]);

  const handleSmartTextChange = (text: string) => {
    setSmartText(text);
    if (!text.trim()) {
      setSmartHint('');
      setSmartFailed(false);
      return;
    }
    const parsed = chronoZh.parseDate(text, new Date(), { forwardDate: true });
    if (!parsed) {
      // 解析失败时保持已有 remind_time 不变，只给提示
      setSmartHint('无法识别，试试「明天下午3点」');
      setSmartFailed(true);
      return;
    }
    const nextTime = toLocalDateTimeString(parsed);
    onFormDataChange({ ...formData, remind_time: nextTime });
    setSmartHint(`已设为 ${nextTime}`);
    setSmartFailed(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? '编辑提醒' : '新建提醒'}
      confirmText={isEdit ? '保存' : '添加'}
      onConfirm={onConfirm}
      confirmDisabled={confirmDisabled}
      clickOutsideToClose={false}
    >
      <div className="space-y-2">
        <div>
          <label className={labelClass}>提醒标题 *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
            placeholder="输入提醒标题"
            className={modalControlClass}
          />
        </div>
        <div>
          <label className={labelClass}>提醒内容</label>
          <textarea
            value={formData.content || ''}
            onChange={(e) => onFormDataChange({ ...formData, content: e.target.value })}
            placeholder="输入提醒内容（可选）"
            rows={3}
            className={modalTextareaScrollClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass}>提醒时间 *</label>
            <input
              type="datetime-local"
              value={formData.remind_time ? formatDateTimeForInput(formData.remind_time) : ''}
              onChange={(e) => onFormDataChange({ ...formData, remind_time: e.target.value.replace('T', ' ') })}
              className={modalControlClass}
            />
          </div>
          <div>
            <label className={labelClass}>重复类型</label>
            <Select
              value={formData.repeat_type || 'none'}
              onChange={(v) => onFormDataChange({ ...formData, repeat_type: v as ReminderRepeatType })}
              options={REPEAT_TYPES.map(r => ({ value: r.value, label: r.label }))}
              className={modalControlClass}
            />
          </div>
          <div>
            <label className={labelClass}>通知方式</label>
            <Select
              value={formData.notify_method}
              onChange={(v) => onFormDataChange({ ...formData, notify_method: v as ReminderNotifyMethod })}
              options={NOTIFY_METHODS.map(m => ({ value: m.value, label: m.label }))}
              className={modalControlClass}
            />
          </div>
          {isEdit && (
            <div>
              <label className={labelClass}>状态</label>
              <Select
                value={formData.is_enabled === false ? '0' : '1'}
                onChange={(v) => onFormDataChange({ ...formData, is_enabled: v === '1' })}
                options={[
                  { value: '1', label: '启用' },
                  { value: '0', label: '禁用' },
                ]}
                className={modalControlClass}
              />
            </div>
          )}
        </div>
        <div>
          <label className={labelClass}>智能时间输入（可选）</label>
          <input
            type="text"
            value={smartText}
            onChange={(e) => handleSmartTextChange(e.target.value)}
            placeholder="如：明天下午3点 / 下周一 9:30"
            className={modalControlClass}
          />
          <p className={`mt-1 text-xs ${smartFailed ? 'text-error' : smartHint ? 'text-primary' : 'text-content-secondary'}`}>
            {smartHint || '识别后自动填入上方提醒时间；识别失败不会改动已有时间'}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export type { CreateReminderRequest, UpdateReminderRequest };
export default ReminderFormModal;
