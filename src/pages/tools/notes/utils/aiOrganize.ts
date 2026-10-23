import type { ChatMessage } from '../types/chat';
import { generateTodayHeader } from './chatParser';

interface OrganizePrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = `你是 ToolBox 记事本中的「AI 整理」助手。用户会把零散的想法、片段和待办交给你，你需要在不改变原意、不捏造事实的前提下，将它们梳理成一篇结构清晰、可直接阅读的中文 Markdown 笔记。

输出要求：
1. 只输出 Markdown 正文，不要用 Markdown 代码围栏包裹，不要输出解释性开场白或结束语。
2. 第一行必须是一级标题（# ），标题概括这批想法的主题，不超过 20 个字。
3. 标题下用一段引用（> ）概括核心结论或这批想法的价值，不超过 80 字。
4. 按主题分为若干二级标题（## ），每个主题下使用无序列表；有明确行动项时使用 - [ ] 任务格式。
5. 保留原文中的时间、数字、专有名词；合并重复内容，删除口水词，但不得新增原文没有的事实。
6. 语气客观、简洁；不使用 emoji，不使用 HTML 标签。
7. 内容适合对比或归类时可以使用 Markdown 表格，否则不要强行使用。`;

export function buildOrganizePrompt(messages: ChatMessage[]): OrganizePrompt {
  const lines = messages.map(
    (message) => `- [${message.date}] ${message.timestamp} ${message.text.replace(/\n/g, '\n  ')}`
  );

  const user = [
    `请整理以下 ${messages.length} 条想法（按记录时间排序）：`,
    '',
    ...lines,
    '',
    `今天是 ${generateTodayHeader()}。`,
    '输出语言：简体中文。直接输出 Markdown。',
  ].join('\n');

  return { system: SYSTEM_PROMPT, user };
}

export function normalizeAIMarkdown(raw: string): string {
  let content = raw.trim();

  const fence = content.match(/^\x60{3}(?:markdown|md)?\s*\n([\s\S]*?)\n\x60{3}$/i);
  if (fence) content = fence[1].trim();

  if (!content.startsWith('#')) {
    content = `# AI 整理\n\n${content}`;
  }

  return `${content}\n`;
}

export function buildOrganizeFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `AI整理-${date}-${time}.md`;
}
