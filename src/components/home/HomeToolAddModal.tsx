import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/AuthStore';
import { useToastStore } from '../../store/toastStore';
import { logError } from '../../services/loggerService';
import { todoServiceWrapper, type TodoCategory, type CreateTodoRequest } from '../../services/TodoService';
import { memoService } from '../../services/MemoService';
import { reminderService } from '../../services/ReminderService';
import { quickReplyService } from '../../services/QuickReplyService';
import { clipboardService } from '../../services/ClipboardService';
import type { Memo, MemoCategory } from '../../types/memo';
import type { ClipboardItem, ClipboardCategory } from '../../types/clipboard';
import type { Todo } from '../../types/todo';
import type { Reminder, CreateReminderRequest } from '../../types/reminder';
import type { QuickReply } from '../../types/quickReply';
import { DEFAULT_PRIORITY, DEFAULT_STATUS } from '../../constants/todo';
import TodoFormModal from '../../pages/tools/todo/TodoFormModal';
import ReminderFormModal from '../../pages/tools/reminder/ReminderFormModal';
import MemoFormModal from '../../pages/tools/memo/MemoFormModal';
import type { MemoPriority } from '../../pages/tools/memo/memoPriority';
import QuickReplyFormModal from '../../pages/tools/quick-reply/QuickReplyFormModal';
import ClipboardFormModal from '../../pages/tools/cloud-clipboard/ClipboardFormModal';
import type { AddableToolId } from '../../utils/homeTools';
import type { PreviewItem } from './ExpandedToolCard';

/** 与各工具页新增表单保持同一份默认值 */
const EMPTY_TODO_FORM: CreateTodoRequest & { category_id: string | null } = {
  title: '',
  description: '',
  due_date: '',
  priority: DEFAULT_PRIORITY,
  status: DEFAULT_STATUS,
  category_id: null,
};

const EMPTY_REMINDER_FORM: CreateReminderRequest & { is_enabled?: boolean } = {
  title: '',
  content: '',
  remind_time: '',
  repeat_type: 'none',
  notify_method: 'system',
  source_type: 'manual',
  source_id: null,
  is_enabled: true,
};

interface HomeToolAddModalProps {
  toolId: AddableToolId | null;
  /**
   * 编辑模式：传入要编辑的条目（来自卡片数据行右键的「编辑」）。
   * 为 null / undefined 时是新增。
   */
  editingItem?: PreviewItem | null;
  onClose: () => void;
  /** 新增或编辑成功后通知首页刷新对应卡片的预览数据 */
  onCreated: () => void;
}

/**
 * 首页扩展工具卡片的新增 / 编辑入口：按工具类型复用各工具页已有的表单组件，
 * 只在打开时重置表单，不复制第二套表单 UI。
 *
 * 编辑与新增走同一个 service，因此主进程计划任务的重新武装、
 * 分类与优先级等字段的写回规则与各工具页完全一致。
 */
const HomeToolAddModal: React.FC<HomeToolAddModalProps> = ({ toolId, editingItem, onClose, onCreated }) => {
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editingItem;

  const [todoForm, setTodoForm] = useState(EMPTY_TODO_FORM);
  const [todoCategories, setTodoCategories] = useState<TodoCategory[]>([]);
  const [reminderForm, setReminderForm] = useState(EMPTY_REMINDER_FORM);
  const [memoTitle, setMemoTitle] = useState('');
  const [memoContent, setMemoContent] = useState('');
  const [memoPriority, setMemoPriority] = useState<MemoPriority>('medium');
  const [memoCategoryId, setMemoCategoryId] = useState<string | null>(null);
  const [memoCategories, setMemoCategories] = useState<MemoCategory[]>([]);
  const [quickReplyContent, setQuickReplyContent] = useState('');
  const [clipboardContent, setClipboardContent] = useState('');
  const [clipboardCategoryId, setClipboardCategoryId] = useState<string | null>(null);
  const [clipboardCategories, setClipboardCategories] = useState<ClipboardCategory[]>([]);

  // 每次打开重置表单（编辑时用该条目的原始数据回填），并按需加载分类
  useEffect(() => {
    if (!toolId || !user) return;

    if (toolId === 'todo') {
      const raw = editingItem?.raw as Todo | undefined;
      setTodoForm(raw ? {
        title: raw.title,
        description: raw.description ?? '',
        due_date: raw.due_date ?? '',
        priority: raw.priority,
        status: raw.status,
        category_id: raw.category_id,
      } : EMPTY_TODO_FORM);
      void todoServiceWrapper.category.getCategories(user.id).then((res) => setTodoCategories(res.data ?? []));
    } else if (toolId === 'memo') {
      const raw = editingItem?.raw as Memo | undefined;
      setMemoTitle(raw?.title ?? '');
      setMemoContent(raw?.content ?? '');
      setMemoPriority(raw?.priority ?? 'medium');
      setMemoCategoryId(raw?.category_id ?? null);
      void memoService.getCategories(user.id).then(setMemoCategories);
    } else if (toolId === 'reminder') {
      const raw = editingItem?.raw as Reminder | undefined;
      setReminderForm(raw ? {
        title: raw.title,
        content: raw.content ?? '',
        remind_time: raw.remind_time,
        repeat_type: raw.repeat_type,
        notify_method: raw.notify_method,
        source_type: raw.source_type,
        source_id: raw.source_id,
        is_enabled: raw.is_enabled,
      } : EMPTY_REMINDER_FORM);
    } else if (toolId === 'quick-reply') {
      const raw = editingItem?.raw as QuickReply | undefined;
      setQuickReplyContent(raw?.content ?? '');
    } else {
      const raw = editingItem?.raw as ClipboardItem | undefined;
      setClipboardContent(raw?.content ?? '');
      setClipboardCategoryId(raw?.category_id ?? null);
      void clipboardService.getCategories(user.id).then(setClipboardCategories);
    }
  }, [toolId, editingItem, user]);

  const finish = (message: string) => {
    if (!toolId) return;
    onCreated();
    onClose();
    addToast({ message, type: 'success' });
  };

  const fail = (error: unknown, message: string) => {
    logError(message, 'HomeToolAdd', error as Error);
    addToast({ message, type: 'error' });
  };

  const handleSubmitTodo = async () => {
    if (!user || saving || !todoForm.title.trim()) return;
    setSaving(true);
    try {
      const payload = { ...todoForm, title: todoForm.title.trim() };
      if (isEdit && editingItem) {
        const result = await todoServiceWrapper.todo.updateTodo(user.id, editingItem.id, payload);
        if (!result.success) throw new Error(result.error ?? 'update todo failed');
        finish('任务更新成功');
      } else {
        const result = await todoServiceWrapper.todo.createTodo(user.id, payload);
        if (!result.success) throw new Error(result.error ?? 'create todo failed');
        finish('任务添加成功');
      }
    } catch (error) {
      fail(error, isEdit ? '更新任务失败' : '添加任务失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitReminder = async () => {
    if (!user || saving || !reminderForm.title.trim() || !reminderForm.remind_time) return;
    setSaving(true);
    try {
      if (isEdit && editingItem) {
        // 与各工具页一致：is_enabled 一并写回，改时间时由 ReminderService 重置触发记录并重注册计划任务
        const result = await reminderService.updateReminder(user.id, editingItem.id, {
          title: reminderForm.title.trim(),
          content: reminderForm.content,
          remind_time: reminderForm.remind_time,
          repeat_type: reminderForm.repeat_type,
          notify_method: reminderForm.notify_method,
          is_enabled: reminderForm.is_enabled !== false,
        });
        if (!result.success) throw new Error(result.error ?? 'update reminder failed');
        finish('提醒更新成功');
      } else {
        const result = await reminderService.createReminder(user.id, reminderForm);
        if (!result.success) throw new Error(result.error ?? 'create reminder failed');
        finish('提醒添加成功');
      }
    } catch (error) {
      fail(error, isEdit ? '更新提醒失败' : '添加提醒失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMemo = async () => {
    if (!user || saving || !memoTitle.trim()) return;
    setSaving(true);
    try {
      const payload = {
        category_id: memoCategoryId,
        title: memoTitle.trim(),
        content: memoContent,
        priority: memoPriority,
      };
      if (isEdit && editingItem) {
        await memoService.updateMemo(user.id, editingItem.id, payload);
        finish('备忘录更新成功');
      } else {
        await memoService.createMemo(user.id, payload);
        finish('备忘录添加成功');
      }
    } catch (error) {
      fail(error, isEdit ? '更新备忘录失败' : '添加备忘录失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitQuickReply = async () => {
    if (!user || saving || !quickReplyContent.trim()) return;
    setSaving(true);
    try {
      if (isEdit && editingItem) {
        await quickReplyService.updateQuickReply(user.id, editingItem.id, {
          content: quickReplyContent.trim(),
        });
        finish('快捷回复更新成功');
      } else {
        await quickReplyService.createQuickReply(user.id, {
          category_id: null,
          content: quickReplyContent.trim(),
        });
        finish('快捷回复添加成功');
      }
    } catch (error) {
      fail(error, isEdit ? '更新快捷回复失败' : '添加快捷回复失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClipboardItem = async () => {
    if (!user || saving || !clipboardContent.trim()) return;
    setSaving(true);
    try {
      if (isEdit && editingItem) {
        await clipboardService.updateItem(user.id, editingItem.id, {
          category_id: clipboardCategoryId,
          content: clipboardContent.trim(),
        });
        finish('项目更新成功');
      } else {
        await clipboardService.createItem(user.id, {
          category_id: clipboardCategoryId,
          content: clipboardContent.trim(),
        });
        finish('项目添加成功');
      }
    } catch (error) {
      fail(error, isEdit ? '更新项目失败' : '添加项目失败');
    } finally {
      setSaving(false);
    }
  };

  if (toolId === 'todo') {
    return (
      <TodoFormModal
        isOpen
        onClose={onClose}
        editingTodo={isEdit ? (editingItem?.raw as Todo) ?? null : null}
        newTodo={todoForm}
        categories={todoCategories}
        onNewTodoChange={setTodoForm}
        onConfirm={handleSubmitTodo}
      />
    );
  }

  if (toolId === 'reminder') {
    return (
      <ReminderFormModal
        isOpen
        onClose={onClose}
        editingReminder={isEdit ? (editingItem?.raw as Reminder) ?? null : null}
        formData={reminderForm}
        onFormDataChange={setReminderForm}
        onConfirm={handleSubmitReminder}
      />
    );
  }

  if (toolId === 'memo') {
    return (
      <MemoFormModal
        isOpen
        onClose={onClose}
        title={memoTitle}
        content={memoContent}
        priority={memoPriority}
        categoryId={memoCategoryId}
        categories={memoCategories}
        onTitleChange={setMemoTitle}
        onContentChange={setMemoContent}
        onPriorityChange={setMemoPriority}
        onCategoryChange={setMemoCategoryId}
        onConfirm={handleSubmitMemo}
        modalTitle={isEdit ? '编辑备忘' : '添加备忘'}
        confirmText={isEdit ? '保存' : '添加'}
      />
    );
  }

  if (toolId === 'quick-reply') {
    return (
      <QuickReplyFormModal
        isOpen
        onClose={onClose}
        content={quickReplyContent}
        onContentChange={setQuickReplyContent}
        onConfirm={handleSubmitQuickReply}
        modalTitle={isEdit ? '编辑快捷回复' : '添加快捷回复'}
        confirmText={isEdit ? '保存' : '添加'}
      />
    );
  }

  if (toolId === 'cloud-clipboard') {
    return (
      <ClipboardFormModal
        isOpen
        onClose={onClose}
        content={clipboardContent}
        categoryId={clipboardCategoryId}
        categories={clipboardCategories}
        onContentChange={setClipboardContent}
        onCategoryChange={setClipboardCategoryId}
        onConfirm={handleSubmitClipboardItem}
        modalTitle={isEdit ? '编辑项目' : '添加项目'}
        confirmText={isEdit ? '保存' : '添加'}
      />
    );
  }

  return null;
};

export default React.memo(HomeToolAddModal);
