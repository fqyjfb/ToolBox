import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Bell } from 'lucide-react';
import { reminderService } from '../../../services/ReminderService';
import { useAuthStore } from '../../../store/AuthStore';
import { useToastStore } from '../../../store/toastStore';
import { useRequireAuth } from '../../../hooks/useRequireAuth';
import { useNavSearch } from '../../../contexts/NavSearchContext';
import { logError, logInfo } from '../../../services/loggerService';
import type { Reminder, CreateReminderRequest } from '../../../types/reminder';
import { REMINDER_DEBOUNCE_MS } from '../../../constants/reminder';
import { debounce } from '../../../utils';
import ContextMenu, { ContextMenuItem } from '../../../components/ui/ContextMenu';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import ReminderCard from './ReminderCard';
import ReminderFormModal from './ReminderFormModal';

const EMPTY_FORM: CreateReminderRequest & { is_enabled?: boolean } = {
  title: '',
  content: '',
  remind_time: '',
  repeat_type: 'none',
  notify_method: 'system',
  source_type: 'manual',
  source_id: null,
  is_enabled: true,
};

const ReminderPage: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useRequireAuth();
  const addToast = useToastStore((state) => state.addToast);
  const location = useLocation();
  const { searchQuery, isSearchActive } = useNavSearch();

  const searchKeyword = isSearchActive ? searchQuery.trim() : '';
  const isSearching = searchKeyword.length > 0;

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [formData, setFormData] = useState<CreateReminderRequest & { is_enabled?: boolean }>(EMPTY_FORM);

  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; targetId?: string }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadReminders = useCallback(async () => {
    if (!user) return;
    try {
      let result;
      if (isSearching) {
        result = await reminderService.searchReminders(user.id, searchKeyword);
      } else {
        result = await reminderService.getReminders(user.id);
      }
      if (result.success && result.data) {
        setReminders(result.data);
      }
    } catch (error) {
      logError('加载提醒列表失败', 'ReminderPage', error as Error);
      addToast({ message: '加载提醒列表失败', type: 'error' });
    }
  }, [user, isSearching, searchKeyword, addToast]);

  const debouncedLoadRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    debouncedLoadRef.current = debounce(() => {
      loadReminders();
    }, REMINDER_DEBOUNCE_MS);
  }, [loadReminders]);

  useEffect(() => {
    if (debouncedLoadRef.current) {
      debouncedLoadRef.current();
    }
    return () => {
      debouncedLoadRef.current = null;
    };
  }, [searchKeyword]);

  // 托盘/悬浮球触发的 open-add-reminder 事件，可能携带预填数据
  useEffect(() => {
    const handleOpenAddReminder = (data?: unknown) => {
      const partial = (data || {}) as Partial<CreateReminderRequest>;
      if (data && (partial.title || partial.source_id)) {
        setFormData({
          ...EMPTY_FORM,
          title: partial.title || '',
          content: partial.content || '',
          remind_time: partial.remind_time || '',
          source_type: partial.source_type || 'manual',
          source_id: partial.source_id ?? null,
        });
      } else {
        setFormData(EMPTY_FORM);
      }
      setEditingReminder(null);
      setShowFormModal(true);
    };

    window.electron?.onOpenAddReminder?.(handleOpenAddReminder);
    return () => {
      window.electron?.onOpenAddReminder?.(() => {});
    };
  }, []);

  // 从备忘录/待办事项右键"设为提醒"跳转过来时，通过路由 state 携带预填数据
  useEffect(() => {
    const state = location.state as Partial<CreateReminderRequest> | null;
    if (state && (state.title || state.source_id)) {
      setFormData({
        ...EMPTY_FORM,
        title: state.title || '',
        content: state.content || '',
        remind_time: state.remind_time || '',
        source_type: state.source_type || 'manual',
        source_id: state.source_id ?? null,
      });
      setEditingReminder(null);
      setShowFormModal(true);
      // 消费后清空 state，避免刷新或返回时重复触发
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const openCreateModal = useCallback(() => {
    setFormData(EMPTY_FORM);
    setEditingReminder(null);
    setShowFormModal(true);
  }, []);

  const handleEditReminder = useCallback((reminder: Reminder) => {
    setEditingReminder(reminder);
    setFormData({
      title: reminder.title,
      content: reminder.content,
      remind_time: reminder.remind_time,
      repeat_type: reminder.repeat_type,
      notify_method: reminder.notify_method,
      // 一次性提醒弹出后会被自动禁用；再次编辑时默认恢复启用，
      // 否则改完时间仍是禁用态，计划任务不会被注册，重启后就再也不会响。
      is_enabled: reminder.is_enabled || !!reminder.last_triggered_at,
      source_type: reminder.source_type,
      source_id: reminder.source_id,
    });
    setShowFormModal(true);
  }, []);

  const handleCloseFormModal = useCallback(() => {
    setShowFormModal(false);
    setEditingReminder(null);
    setFormData(EMPTY_FORM);
  }, []);

  const handleConfirm = async () => {
    if (!user || !formData.title.trim() || !formData.remind_time) return;

    if (editingReminder) {
      const result = await reminderService.updateReminder(user.id, editingReminder.id, {
        title: formData.title,
        content: formData.content,
        remind_time: formData.remind_time,
        repeat_type: formData.repeat_type,
        notify_method: formData.notify_method,
        is_enabled: formData.is_enabled !== false,
      });
      if (result.success) {
        addToast({ message: '提醒修改成功', type: 'success' });
        logInfo('提醒修改成功', 'ReminderPage');
        handleCloseFormModal();
        loadReminders();
      } else {
        addToast({ message: result.error || '修改提醒失败', type: 'error' });
      }
    } else {
      const result = await reminderService.createReminder(user.id, {
        title: formData.title,
        content: formData.content,
        remind_time: formData.remind_time,
        repeat_type: formData.repeat_type,
        notify_method: formData.notify_method,
        source_type: formData.source_type,
        source_id: formData.source_id,
      });
      if (result.success) {
        addToast({ message: '提醒创建成功', type: 'success' });
        logInfo('提醒创建成功', 'ReminderPage');
        handleCloseFormModal();
        loadReminders();
      } else {
        addToast({ message: result.error || '创建提醒失败', type: 'error' });
      }
    }
  };

  const handleToggleEnabled = useCallback(async (id: string, enabled: boolean) => {
    if (!user) return;
    const result = await reminderService.updateReminder(user.id, id, { is_enabled: enabled });
    if (result.success) {
      setReminders(prev => prev.map(r => (r.id === id ? { ...r, is_enabled: enabled } : r)));
    } else {
      addToast({ message: '更新状态失败', type: 'error' });
    }
  }, [user, addToast]);

  const handleDeleteReminder = useCallback(async (id: string) => {
    if (!user) return;
    const result = await reminderService.deleteReminder(user.id, id);
    if (result.success) {
      addToast({ message: '提醒已删除', type: 'success' });
      loadReminders();
    } else {
      addToast({ message: '删除提醒失败', type: 'error' });
    }
  }, [user, addToast, loadReminders]);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, targetId: id });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleOpenConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 立即触发：与主进程定时触发共用同一通道，系统通知失败时主进程自动回退弹窗
  const handleTriggerNow = useCallback(async (reminder: Reminder) => {
    if (!user) return;
    try {
      await window.electron?.reminder?.notify({
        title: reminder.title,
        content: reminder.content || '',
        id: reminder.id,
        notify_method: reminder.notify_method,
      });
      addToast({ message: '已触发提醒', type: 'success' });
    } catch (err) {
      logError('触发提醒失败', 'ReminderPage', err as Error);
      addToast({ message: '触发提醒失败', type: 'error' });
    }
  }, [user, addToast]);

  const contextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!contextMenu.targetId) return [];
    const reminder = reminders.find(r => r.id === contextMenu.targetId);
    if (!reminder) return [];
    return [
      {
        id: 'edit',
        label: '编辑',
        onClick: () => handleEditReminder(reminder),
      },
      {
        id: 'toggle-enabled',
        label: reminder.is_enabled ? '禁用' : '启用',
        onClick: () => {
          handleToggleEnabled(reminder.id, !reminder.is_enabled);
          handleCloseContextMenu();
        },
      },
      {
        id: 'trigger-now',
        label: '立即触发',
        onClick: () => {
          handleTriggerNow(reminder);
          handleCloseContextMenu();
        },
      },
      { id: 'divider1', label: '', divider: true },
      {
        id: 'delete',
        label: '删除',
        onClick: () => handleOpenConfirmDialog(
          '删除确认',
          '确定要删除这个提醒吗？',
          () => handleDeleteReminder(reminder.id)
        ),
      },
    ];
  }, [contextMenu.targetId, reminders, handleEditReminder, handleToggleEnabled, handleTriggerNow, handleCloseContextMenu, handleOpenConfirmDialog, handleDeleteReminder]);

  if (!isAuthenticated) return null;

  const enabledCount = reminders.filter(r => r.is_enabled).length;

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      onContextMenu={(e) => {
        // 空白区域右键：打开新建提醒
        e.preventDefault();
        openCreateModal();
      }}
    >
      <div className="flex-1 overflow-y-auto scrollbar-hide p-1">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-text-primary mb-1">定时提醒</h3>
            <p className="text-xs text-text-secondary">
              共 {reminders.length} 条 · 启用 {enabledCount} 条
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-primary text-button-text px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-primary-hover flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            新建提醒
          </button>
        </div>

        {reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Bell className="w-12 h-12 text-content-tertiary mb-4" />
            <p className="text-content-secondary text-sm mb-4">
              {isSearching ? '未找到匹配的提醒' : '暂无提醒'}
            </p>
            {!isSearching && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-button-text rounded-lg hover:bg-primary-hover transition-colors text-sm"
              >
                <Plus size={14} />
                创建一条
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reminders.map(reminder => (
              <ReminderCard
                key={reminder.id}
                reminder={reminder}
                onToggleEnabled={handleToggleEnabled}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      <ReminderFormModal
        isOpen={showFormModal}
        onClose={handleCloseFormModal}
        editingReminder={editingReminder}
        formData={formData}
        onFormDataChange={setFormData}
        onConfirm={handleConfirm}
      />

      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={contextMenuItems}
        onClose={handleCloseContextMenu}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={handleCloseConfirmDialog}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
      />
    </div>
  );
};

export default ReminderPage;
