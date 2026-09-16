// CreateNoteMenu —— 「用模板新建笔记」下拉：分组展示内置/我的模板，含 loading / error / empty 三态。

import React from 'react';
import { AlertCircle, FileText, Loader2, RefreshCw, User } from 'lucide-react';
import type { NotesTemplate } from '../types';

export interface CreateNoteMenuProps {
  open: boolean;
  builtin: NotesTemplate[];
  user: NotesTemplate[];
  loading: boolean;
  error: string | null;
  busy?: boolean;
  onSelect: (tpl: NotesTemplate) => void;
  onRefresh: () => void;
  onClose: () => void;
}

interface TemplateRowProps {
  tpl: NotesTemplate;
  disabled: boolean;
  onSelect: (tpl: NotesTemplate) => void;
}

const TemplateRow: React.FC<TemplateRowProps> = ({ tpl, disabled, onSelect }) => (
  <button
    type="button"
    disabled={disabled}
    className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-text-primary transition-colors hover:bg-bg-secondary disabled:opacity-60"
    onClick={() => onSelect(tpl)}
    title={tpl.description}
  >
    <span className="w-full truncate text-xs font-medium">{tpl.name}</span>
    {tpl.description && (
      <span className="w-full truncate text-[10px] text-text-secondary">{tpl.description}</span>
    )}
  </button>
);

interface TemplateGroupProps {
  title: string;
  icon: React.ReactNode;
  items: NotesTemplate[];
  disabled: boolean;
  onSelect: (tpl: NotesTemplate) => void;
  // 空态引导文案；不传则空组整块不渲染
  emptyHint?: string;
}

const TemplateGroup: React.FC<TemplateGroupProps> = ({
  title,
  icon,
  items,
  disabled,
  onSelect,
  emptyHint,
}) => {
  if (items.length === 0 && !emptyHint) return null;
  return (
    <div className="py-1">
      <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-text-secondary">
        {icon}
        <span>{title}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-2 pb-1 text-[10px] leading-relaxed text-text-secondary">{emptyHint}</div>
      ) : (
        <div className="px-1">
          {items.map((tpl) => (
            <TemplateRow key={tpl.id} tpl={tpl} disabled={disabled} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

export const CreateNoteMenu: React.FC<CreateNoteMenuProps> = ({
  open,
  builtin,
  user,
  loading,
  error,
  busy = false,
  onSelect,
  onRefresh,
  onClose,
}) => {
  if (!open) return null;

  const disabled = busy;

  return (
    <>
      {/* 点击遮罩关闭（不拦截面板内点击） */}
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div
        className="absolute left-0 top-full z-40 mt-1 w-56 max-w-[15rem] rounded-md border border-border bg-bg-primary shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border px-2 py-1.5 text-xs font-medium text-text-primary">
          用模板新建笔记
        </div>

        <div className="max-h-64 overflow-y-auto scrollbar-hide">
          {/* 内置模板恒非空，故无需「整体加载中」骨架；用户模板刷新态见下方 footer */}
          <TemplateGroup
            title="内置模板"
            icon={<FileText className="h-3 w-3" />}
            items={builtin}
            disabled={disabled}
            onSelect={onSelect}
          />
          <TemplateGroup
            title="我的模板"
            icon={<User className="h-3 w-3" />}
            items={user}
            disabled={disabled}
            onSelect={onSelect}
            emptyHint="把 .md 文件放到 userData/notes/templates 目录下，即可在此显示"
          />
        </div>

        {loading && (
          <div className="flex items-center gap-2 border-t border-border px-2 py-1.5 text-[10px] text-text-secondary">
            <Loader2 className="h-3 w-3 animate-spin" />
            正在刷新我的模板…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-error">
              <AlertCircle className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{error}</span>
            </span>
            <button
              type="button"
              className="flex flex-shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-bg-secondary"
              onClick={onRefresh}
              title="重新加载我的模板"
            >
              <RefreshCw className="h-3 w-3" />
              重试
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default CreateNoteMenu;
