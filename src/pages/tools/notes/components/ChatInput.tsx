import React, { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Send,
  Wand2,
  MessageCircle,
  Languages,
  List,
  FileText,
  ListChecks,
  StickyNote,
} from 'lucide-react';
import ToggleSwitch from '../../../../components/settings/ToggleSwitch';
import { useChatDraftStore } from '../../../../store/chatDraftStore';

interface ChatInputProps {
  onSend: (text: string) => Promise<void>;
  onAIOrganize: () => void;
  aiOrganizing: boolean;
  selectedCount: number;
  autoArchiveEnabled?: boolean;
  onArchiveChanged?: (enabled: boolean) => void;
}

const MAX_INPUT_HEIGHT = 160;

/** 快捷按钮状态：'' 空闲，busy 进行中，done 完成，error 失败 */
type QuickBtnState = '' | 'busy' | 'done' | 'error';

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onAIOrganize,
  aiOrganizing,
  selectedCount,
  autoArchiveEnabled = false,
  onArchiveChanged,
}) => {
  // 未发送文本提升到 zustand store：跨路由保留 + localStorage 兜底
  const { text, setText, clear: clearDraft } = useChatDraftStore();
  const [noteState, setNoteState] = useState<QuickBtnState>('');
  const [todoState, setTodoState] = useState<QuickBtnState>('');
  const [stickyState, setStickyState] = useState<QuickBtnState>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [text]);

  const handleSend = async () => {
    if (!text.trim()) return;
    await onSend(text.trim());
    clearDraft();
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await handleSend();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setText((prev) => prev + `![${file.name}](media/${file.name})`);
        }
        break;
      }
    }
  };

  /** 存笔记：直接写进「对话整理 / 小橘AI笔记」目录，成功后清空草稿 */
  const handleSaveNote = async () => {
    const content = text.trim();
    if (!content || noteState === 'busy') return;
    setNoteState('busy');
    try {
      const result = await window.electron?.notes?.saveOrganizedNote({ content });
      if (result?.success) {
        setNoteState('done');
        clearDraft();
      } else {
        setNoteState('error');
      }
    } catch {
      setNoteState('error');
    }
    setTimeout(() => setNoteState((s) => (s === 'done' || s === 'error' ? '' : s)), 3000);
  };

  /** 存待办：向主窗口广播触发 Todo 页弹窗创建，成功后清空草稿 */
  const handleCreateTodo = async () => {
    const title = text.trim();
    if (!title || todoState === 'busy') return;
    setTodoState('busy');
    try {
      const result = await window.electron?.todo?.create({ title });
      if (result?.ok) {
        setTodoState('done');
        clearDraft();
      } else {
        setTodoState('error');
      }
    } catch {
      setTodoState('error');
    }
    setTimeout(() => setTodoState((s) => (s === 'done' || s === 'error' ? '' : s)), 3000);
  };

  /** 存便签：直接调用 stickyNotes.create，成功后清空草稿 */
  const handleCreateSticky = async () => {
    const content = text.trim();
    if (!content || stickyState === 'busy') return;
    setStickyState('busy');
    try {
      const result = await window.electron?.stickyNotes?.create({ content, title: content.slice(0, 40) });
      if (result?.ok) {
        setStickyState('done');
        clearDraft();
      } else {
        setStickyState('error');
      }
    } catch {
      setStickyState('error');
    }
    setTimeout(() => setStickyState((s) => (s === 'done' || s === 'error' ? '' : s)), 3000);
  };

  /** 解释：以指令前缀打开小橘面板（不清草稿，用户可能还想换指令再调） */
  const handleExplain = () => {
    const content = text.trim();
    if (!content) return;
    window.electron?.floatPanel?.openChat(`请对以下内容进行详细解释：\n\n${content}`);
  };

  /** 翻译：以指令前缀打开小橘面板 */
  const handleTranslate = () => {
    const content = text.trim();
    if (!content) return;
    window.electron?.floatPanel?.openChat(`请将以下内容翻译成英文：\n\n${content}`);
  };

  /** 总结：以指令前缀打开小橘面板 */
  const handleSummarize = () => {
    const content = text.trim();
    if (!content) return;
    window.electron?.floatPanel?.openChat(`请总结以下内容（不超过100字）：\n\n${content}`);
  };

  const aiTitle = aiOrganizing
    ? 'AI 正在整理...'
    : selectedCount === 0
      ? '请先勾选要整理的想法'
      : 'AI 整理所选想法';

  const hasText = !!text.trim();

  const quickBtnBase =
    'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-content transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const quickBtnIdle = 'text-content-secondary hover:border-primary hover:text-content-primary';
  const quickBtnBusy = 'text-content-secondary cursor-progress';
  const quickBtnDone = 'border-primary text-primary';
  const quickBtnError = 'border-error text-error';

  const getBtnClass = (state: QuickBtnState) =>
    `${quickBtnBase} ${
      state === 'busy' ? quickBtnBusy
      : state === 'done' ? quickBtnDone
      : state === 'error' ? quickBtnError
      : quickBtnIdle
    }`;

  return (
    <div className="flex justify-center px-3 py-2">
      <div className="w-full max-w-[720px] rounded border border-content bg-surface-secondary transition-colors focus-within:border-primary">
        <textarea
          ref={textareaRef}
          rows={1}
          className="block w-full resize-none overflow-y-auto bg-transparent px-2 pt-1.5 text-xs leading-relaxed text-content-primary placeholder-text-content-tertiary scrollbar-5px focus:outline-none"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="输入消息..."
        />
        <div className="flex items-center justify-between gap-1 px-1.5 pb-1.5 pt-0.5">
          {/* 左侧：6 个快捷按钮（复刻小橘面板） */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={quickBtnBase + ' ' + quickBtnIdle}
              onClick={handleExplain}
              disabled={!hasText}
              title="解释 · 用 AI 详细解释选中文本"
              aria-label="解释"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={quickBtnBase + ' ' + quickBtnIdle}
              onClick={handleTranslate}
              disabled={!hasText}
              title="翻译 · 用 AI 将选中文本翻译成英文"
              aria-label="翻译"
            >
              <Languages className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={quickBtnBase + ' ' + quickBtnIdle}
              onClick={handleSummarize}
              disabled={!hasText}
              title="总结 · 用 AI 总结选中文本要点"
              aria-label="总结"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className={getBtnClass(noteState)}
              onClick={handleSaveNote}
              disabled={!hasText}
              title={noteState === 'busy' ? '保存中…' : noteState === 'done' ? '已保存到小橘AI笔记' : noteState === 'error' ? '保存失败，重试' : '存笔记'}
              aria-label="存笔记"
            >
              {noteState === 'busy' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              className={getBtnClass(todoState)}
              onClick={handleCreateTodo}
              disabled={!hasText}
              title={todoState === 'busy' ? '提交中…' : todoState === 'done' ? '已添加到待办' : todoState === 'error' ? '添加失败，重试' : '存待办'}
              aria-label="存待办"
            >
              {todoState === 'busy' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListChecks className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              className={getBtnClass(stickyState)}
              onClick={handleCreateSticky}
              disabled={!hasText}
              title={stickyState === 'busy' ? '提交中…' : stickyState === 'done' ? '已添加到便签' : stickyState === 'error' ? '添加失败，重试' : '存便签'}
              aria-label="存便签"
            >
              {stickyState === 'busy' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <StickyNote className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* 右侧：原有按钮组（ToggleSwitch + AI 整理 + 发送）保持不动 */}
          <div className="flex items-center gap-1">
            <label className="flex cursor-pointer select-none items-center" title="整理后自动归档原消息">
              <ToggleSwitch
                checked={autoArchiveEnabled}
                onChange={(v: boolean) => onArchiveChanged?.(v)}
                checkedLabel=""
                uncheckedLabel=""
              />
            </label>

            <button
              type="button"
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border border-content text-content-secondary transition-colors hover:border-primary hover:text-content-primary disabled:cursor-not-allowed disabled:opacity-40"
              onClick={onAIOrganize}
              disabled={aiOrganizing}
              title={aiTitle}
            >
              {aiOrganizing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
            </button>

            <button
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-primary text-button-text transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleSend}
              disabled={!text.trim()}
              title="发送"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
