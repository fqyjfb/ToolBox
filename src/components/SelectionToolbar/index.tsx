import { useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Languages, ListTodo, NotebookPen, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/AuthStore';
import { useToastStore } from '@/store/toastStore';
import { todoServiceWrapper } from '@/services/TodoService';
import { logError } from '@/services/loggerService';
import { queryKeys } from '@/queries/keys';
import { useSelectionToolbar } from './useSelectionToolbar';
import './SelectionToolbar.css';

/** 转待办字段约束与 useFloatAiActions 同源：title 200 / description 4000 */
const TODO_TITLE_MAX = 200;
const TEXT_MAX = 4000;

/** 定位常量：上下间距 8px；水平夹紧左右各留 100px（工具条约 170px 宽，含半宽余量） */
const GAP = 8;
const TOOLBAR_HEIGHT = 36;
const EDGE_MARGIN = 100;

interface SelectionToolbarProps {
  /** 通用设置开关；关闭时组件仍挂载但不监听、不渲染 */
  enabled: boolean;
}

/**
 * 全局划词工具条：任意支持区域内框选文字后浮出，提供
 * 复制 / 翻译 / 转待办 / 转笔记 / 问AI 五个动作。
 *
 * 五个动作全部复用既有链路（clipboard / translate.open / todoServiceWrapper /
 * notes.saveOrganizedNote / floatPanel.openChat），本组件只做选区监听与分发。
 * 视觉对齐 .mde-inline-toolbar，仅用主题 CSS 变量，明暗主题自动适配。
 */
export function SelectionToolbar({ enabled }: SelectionToolbarProps) {
  const { info, hide } = useSelectionToolbar({ enabled });
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'warning', message: string) => {
      useToastStore.getState().addToast({ type, message });
    },
    [],
  );

  /** 动作成功后收尾：隐藏工具条并清空选区 */
  const finish = () => {
    window.getSelection()?.removeAllRanges();
    hide();
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    showToast('success', '已复制');
    finish();
  };

  const handleTranslate = async (text: string) => {
    // 应用内划词直接传文本，不走系统取词
    await window.electron?.translate.open({
      text,
      autoTranslate: true,
      trigger: 'selection',
    });
    finish();
  };

  const handleTodo = async (text: string) => {
    if (!userId) {
      showToast('warning', '请先登录后使用转待办');
      return;
    }
    const title = text.trim().split('\n')[0].slice(0, TODO_TITLE_MAX);
    try {
      const result = await todoServiceWrapper.todo.createTodo(userId, {
        title,
        description: text.slice(0, TEXT_MAX),
      });
      if (result?.success) {
        showToast('success', '已添加到待办');
        queryClient.invalidateQueries({ queryKey: queryKeys.todo.all });
        finish();
      } else {
        showToast('error', result?.error || '添加待办失败');
      }
    } catch (error) {
      logError('划词转待办失败', 'SelectionToolbar', error instanceof Error ? error : undefined);
      showToast('error', '添加待办失败');
    }
  };

  const handleNote = async (text: string) => {
    try {
      const result = await window.electron?.notes.saveOrganizedNote({
        content: text,
      });
      if (result?.success) {
        const fileName = result.path?.split(/[\\/]/).pop() ?? '';
        showToast('success', fileName ? `已保存到笔记：${fileName}` : '已保存到笔记');
        finish();
      } else {
        showToast('error', result?.error || '保存笔记失败');
      }
    } catch {
      showToast('error', '保存笔记失败');
    }
  };

  const handleAi = async (text: string) => {
    // 打开小橘面板（chat 模式，输入框预填）；悬浮球开关关闭时面板按需创建
    await window.electron?.floatPanel?.openChat(text);
    finish();
  };

  if (!info) return null;

  const { rect } = info;
  const centerX = (rect.left + rect.right) / 2;
  const left = Math.min(Math.max(centerX, EDGE_MARGIN), window.innerWidth - EDGE_MARGIN);
  // 顶部放不下时翻到选区下方
  const above = rect.top >= TOOLBAR_HEIGHT + GAP;

  const actions = [
    { icon: Copy, title: '复制', run: handleCopy },
    { icon: Languages, title: '翻译', run: handleTranslate },
    { icon: ListTodo, title: '转待办', run: handleTodo },
    { icon: NotebookPen, title: '转笔记', run: handleNote },
    { icon: Sparkles, title: '问AI', run: handleAi },
  ];

  // 🔴 mousedown + preventDefault 保住选区（默认行为会先清空选区再触发 click）
  const guard = (event: React.MouseEvent) => event.preventDefault();

  return createPortal(
    <div
      className={`selection-toolbar ${above ? 'is-above' : 'is-below'}`}
      style={{ left, top: above ? rect.top - GAP : rect.bottom + GAP }}
      data-selection-toolbar-disable=""
      role="toolbar"
      aria-label="划词工具条"
      onMouseDown={guard}
    >
      {actions.map(({ icon: Icon, title, run }) => (
        <button
          key={title}
          type="button"
          className="selection-toolbar-btn"
          title={title}
          aria-label={title}
          onClick={() => void run(info.text)}
        >
          <Icon className="selection-toolbar-icon" />
        </button>
      ))}
    </div>,
    document.body,
  );
}

export default SelectionToolbar;
