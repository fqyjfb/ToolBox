// NotesEditorStats —— 顶部状态栏 3 个统计 chip：字数 · 阅读时长 · 大纲数。
// 抽为独立小组件以避免 NotesEditor.tsx 超过 600 行硬约束；是否渲染由父组件按文件类型判定
// （仅 md / txt / html / json 显示）。

import React from 'react';
import { AlignLeft, BookOpen, ListTree } from 'lucide-react';
import type { NotesStats } from '../types';

interface NotesEditorStatsProps {
  stats: NotesStats;
  /** 是否展示：false 时返回 null（供父组件按 fileType 决定） */
  visible: boolean;
}

const chipBase =
  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';

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
