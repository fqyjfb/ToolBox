// useNotesTemplates —— 模板读写：builtin 来自 constants/templates.ts，user 来自 <userData>/notes/templates/*.md。
// ⚠️ 返回对象字面量（未 useMemo），调用方禁止整体进 deps，须解构稳定的 useCallback。

import { useCallback, useEffect, useState } from 'react';
import type { NotesTemplate } from '../types';
import { NOTE_TEMPLATES, TEMPLATE_WEEKDAYS } from '../constants/templates';

export type TemplateVars = Record<string, string>;

export interface UseNotesTemplatesReturn {
  builtin: NotesTemplate[];
  user: NotesTemplate[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  all: () => NotesTemplate[];
  render: (tpl: NotesTemplate, vars?: TemplateVars) => string;
}

// 默认占位符值每次调用取当前时间，避免模块级缓存导致日期过期
function buildDefaultVars(): TemplateVars {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    date,
    time,
    datetime: `${date} ${time}`,
    weekday: TEMPLATE_WEEKDAYS[now.getDay()] ?? '',
    // 默认空串：模板标题渲染为「读书笔记 · 」由用户补全，避免出现「未命名」字样
    title: '',
  };
}

// 占位符替换（纯函数）：`{{ key }}` 允许空白；未知占位符原样保留。
export function renderTemplate(tpl: NotesTemplate, vars: TemplateVars = {}): string {
  if (!tpl || typeof tpl.content !== 'string') return '';
  const map: TemplateVars = { ...buildDefaultVars(), ...vars };
  return tpl.content.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (raw, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : raw
  );
}

export function useNotesTemplates(): UseNotesTemplatesReturn {
  const [user, setUser] = useState<NotesTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await window.electron?.notes?.listTemplates?.();
      if (res && res.success) {
        const list = Array.isArray(res.templates) ? res.templates : [];
        setUser(
          list
            .filter((item) => item && typeof item.id === 'string' && item.id.length > 0)
            .map<NotesTemplate>((item) => ({
              id: item.id,
              name: typeof item.name === 'string' && item.name ? item.name : item.id,
              description: '我的模板',
              content: typeof item.content === 'string' ? item.content : '',
            }))
        );
        setError(null);
      } else {
        setUser([]);
        setError(res?.error ?? '模板读取失败');
      }
    } catch (err) {
      setUser([]);
      setError(err instanceof Error ? err.message : '模板读取失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 挂载时拉取一次；refresh 为稳定引用，不会重复触发
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 内置 + 用户合并；后写入的用户模板覆盖同名内置
  const all = useCallback((): NotesTemplate[] => {
    const merged = new Map<string, NotesTemplate>();
    for (const tpl of NOTE_TEMPLATES) merged.set(tpl.id, tpl);
    for (const tpl of user) merged.set(tpl.id, tpl);
    return Array.from(merged.values());
  }, [user]);

  const render = useCallback((tpl: NotesTemplate, vars?: TemplateVars): string => renderTemplate(tpl, vars), []);

  return { builtin: NOTE_TEMPLATES, user, loading, error, refresh, all, render };
}
