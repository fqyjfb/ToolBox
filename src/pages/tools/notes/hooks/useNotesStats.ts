// useNotesStats —— 文档统计：字数 / 阅读时长 / 大纲。切文件时 reset，新内容由 recompute(content) 主动更新。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NotesOutlineItem, NotesStats } from '../types';

const READING_CHARS_PER_MINUTE = 400;
const HEADING_REGEX = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

// markdown → 统计结果（纯函数）
export function computeStats(content: string): NotesStats {
  const trimmed = (content ?? '').trim();
  const wordCount = trimmed.length;
  const readingMinutes = wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / READING_CHARS_PER_MINUTE));

  const outline: NotesOutlineItem[] = [];
  if (trimmed.length > 0) {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const match = HEADING_REGEX.exec(raw);
      if (!match) continue;
      outline.push({
        level: match[1].length,
        text: match[2].trim(),
        line: i + 1,
      });
    }
  }

  return { wordCount, readingMinutes, outline };
}

export interface UseNotesStatsReturn {
  stats: NotesStats;
  recompute: (content: string) => void;
}

const EMPTY_STATS: NotesStats = { wordCount: 0, readingMinutes: 0, outline: [] };

export function useNotesStats(filePath: string | null | undefined): UseNotesStatsReturn {
  const [stats, setStats] = useState<NotesStats>(EMPTY_STATS);
  const lastPathRef = useRef<string | null>(null);

  // useCallback 保持引用稳定，避免消费端 useEffect 死循环
  const recompute = useCallback((content: string) => {
    setStats(computeStats(content));
  }, []);

  // 切文件时重置；组件层应在新内容加载完成后再调用 recompute()
  useEffect(() => {
    if (lastPathRef.current !== filePath) {
      lastPathRef.current = filePath ?? null;
      setStats(EMPTY_STATS);
    }
  }, [filePath]);

  return useMemo(() => ({ stats, recompute }), [stats, recompute]);
}
