import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/AuthStore';
import { useToastStore } from '../../store/toastStore';
import { logError } from '../../services/loggerService';
import { todoServiceWrapper, type TodoCategory, type CreateTodoRequest } from '../../services/TodoService';
import { memoService } from '../../services/MemoService';
import { reminderService } from '../../services/ReminderService';
import { quickReplyService } from '../../services/QuickReplyService';
import { clipboardService } from '../../services/ClipboardService';
import type { MemoCategory } from '../../types/memo';
import type { ClipboardCategory } from '../../types/clipboard';
import type { CreateReminderRequest } from '../../types/reminder';
import { DEFAULT_PRIORITY, DEFAULT_STATUS } from '../../constants/todo';
import TodoFormModal from '../../pages/tools/todo/TodoFormModal';
import ReminderFormModal from '../../pages/tools/reminder/ReminderFormModal';
import MemoFormModal from '../../pages/tools/memo/MemoFormModal';
import type { MemoPriority } from '../../pages/tools/memo/memoPriority';
import QuickReplyFormModal from '../../pages/tools/quick-reply/QuickReplyFormModal';
import ClipboardFormModal from '../../pages/tools/cloud-clipboard/ClipboardFormModal';
import type { AddableToolId } from '../../utils/homeTools';
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
  onClose: () => void;
  /** 新增成功后通知首页刷新对应卡片的预览数据 */
  onCreated: () => void;
}

/**
 * 首页扩展工具卡片的新增入口：按工具类型复用各工具页已有的表单组件，
 * 只在打开时重置表单，不复制第二套表单 UI。
 */
const HomeToolAddModal: React.FC<HomeToolAddModalProps> = ({ toolId, onClose, onCreated }) => {
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  const [saving, setSaving] = useState(false);

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

  // 每次打开重置表单，并按需加载分类
  useEffect(() => {
    if (!toolId || !user) return;

    if (toolId === 'todo') {
      setTodoForm(EMPTY_TODO_FORM);
      void todoServiceWrapper.category.getCategories(user.id).then((res) => setTodoCategories(res.data ?? []));
    } else if (toolId === 'memo') {
      setMemoTitle('');
      setMemoContent('');
      setMemoPriority('medium');
      setMemoCategoryId(null);
      void memoService.getCategories(user.id).then(setMemoCategories);
    } else if (toolId === 'reminder') {
      setReminderForm(EMPTY_REMINDER_FORM);
    } else if (toolId === 'quick-reply') {
      setQuickReplyContent('');
    } else {
      setClipboardContent('');
      setClipboardCategoryId(null);
      void clipboardService.getCategories(user.id).then(setClipboardCategories);
    }
  }, [toolId, user]);

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

  const handleCreateTodo = async () => {
    if (!user || saving || !todoForm.title.trim()) return;
    setSaving(true);
    try {
      const result = await todoServiceWrapper.todo.createTodo(user.id, { ...todoForm, title: todoForm.title.trim() });
      if (!result.success) throw new Error(result.error ?? 'create todo failed');
      finish('任务添加成功');
    } catch (error) {
      fail(error, '添加任务失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateReminder = async () => {
    if (!user || saving || !reminderForm.title.trim() || !reminderForm.remind_time) return;
    setSaving(true);
    try {
      const result = await reminderService.createReminder(user.id, reminderForm);
      if (!result.success) throw new Error(result.error ?? 'create reminder failed');
      finish('提醒添加成功');
    } catch (error) {
      fail(error, '添加提醒失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMemo = async () => {
    if (!user || saving || !memoTitle.trim()) return;
    setSaving(true);
    try {
      await memoService.createMemo(user.id, {
        category_id: memoCategoryId,
        title: memoTitle.trim(),
        content: memoContent,
        priority: memoPriority,
      });
      finish('备忘录添加成功');
    } catch (error) {
      fail(error, '添加备忘录失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateQuickReply = async () => {
    if (!user || saving || !quickReplyContent.trim()) return;
    setSaving(true);
    try {
      await quickReplyService.createQuickReply(user.id, {
        category_id: null,
        content: quickReplyContent.trim(),
      });
      finish('快捷回复添加成功');
    } catch (error) {
      fail(error, '添加快捷回复失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClipboardItem = async () => {
    if (!user || saving || !clipboardContent.trim()) return;
    setSaving(true);
    try {
      await clipboardService.createItem(user.id, {
        category_id: clipboardCategoryId,
        content: clipboardContent.trim(),
      });
      finish('项目添加成功');
    } catch (error) {
      fail(error, '添加项目失败');
    } finally {
      setSaving(false);
    }
  };

  if (toolId === 'todo') {
    return (
      <TodoFormModal
        isOpen
        onClose={onClose}
        editingTodo={null}
        newTodo={todoForm}
        categories={todoCategories}
        onNewTodoChange={setTodoForm}
        onConfirm={handleCreateTodo}
      />
    );
  }

  if (toolId === 'reminder') {
    return (
      <ReminderFormModal
        isOpen
        onClose={onClose}
        editingReminder={null}
        formData={reminderForm}
        onFormDataChange={setReminderForm}
        onConfirm={handleCreateReminder}
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
        onConfirm={handleCreateMemo}
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
        onConfirm={handleCreateQuickReply}
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
        onConfirm={handleCreateClipboardItem}
      />
    );
  }

  return null;
};

export default React.memo(HomeToolAddModal);
