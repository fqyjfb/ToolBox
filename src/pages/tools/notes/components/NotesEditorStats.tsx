// NotesEditorStats —— 顶部状态栏统计

import React from 'react';
import { AlignLeft, BookOpen, ListTree } from 'lucide-react';
import type { NotesStats } from '../types';

interface NotesEditorStatsProps {
  stats: NotesStats;
  visible: boolean;
}

const chipBase =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-surface-secondary text-gray-600 dark:text-content-secondary';

const NotesEditorStats: React.FC<NotesEditorStatsProps> = ({ stats, visible }) => {
  if (!visible) return null;

  return (
    <div className="flex items-center gap-2">
      <span className={chipBase} title={`当前文档字数（含中英文与空白）：${stats.wordCount}`}>
        <AlignLeft className="h-3 w-3" />
        {stats.wordCount} 字
      </span>
      <span className={chipBase} title={`预估阅读时长（按 400 字/分钟粗估）`}>
        <BookOpen className="h-3 w-3" />
        {stats.readingMinutes} 分钟
      </span>
      <span className={chipBase} title={`大纲条目数（H1-H6）`}>
        <ListTree className="h-3 w-3" />
        {stats.outline.length} 大纲
      </span>
    </div>
  );
};

export default NotesEditorStats;
