/**
 * Markdown → 纯文本。
 *
 * 用于笔记「导出 TXT」。只做轻量剥离语法标记，不做完整 AST 解析：
 * - 代码块/行内代码/标题/粗体/斜体/删除线/列表/引用/分隔线/表格 → 去掉标记留正文
 * - 图片仅保留 alt；链接仅保留文本
 * - 多余空行压缩为最多两行
 *
 * 规则参考原「MD转纯文本」工具页，迁到公共 lib 以便笔记导出复用。
 */
export function markdownToPlainText(source: string): string {
  if (!source) return '';
  let result = source;

  // 代码块整体移除（保留内部纯文本没意义，且可能与行内 code 正则相互干扰）
  result = result.replace(/```[\s\S]*?```/g, '');
  // 行内代码：去掉反引号
  result = result.replace(/`([^`]+)`/g, '$1');

  // 标题标记
  result = result.replace(/^#{1,6}\s+/gm, '');

  // 粗体/斜体/删除线 —— 注意顺序：*** 比 ** 先匹配更安全
  result = result.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
  result = result.replace(/\*\*(.+?)\*\*/g, '$1');
  result = result.replace(/\*(.+?)\*/g, '$1');
  result = result.replace(/___(.+?)___/g, '$1');
  result = result.replace(/__(.+?)__/g, '$1');
  result = result.replace(/_(.+?)_/g, '$1');
  result = result.replace(/~~(.+?)~~/g, '$1');

  // 链接/图片：只留可见文本
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // 列表/引用标记
  result = result.replace(/^\s*[-*+]\s+/gm, '');
  result = result.replace(/^\s*\d+\.\s+/gm, '');
  result = result.replace(/^>\s+/gm, '');

  // 分隔线
  result = result.replace(/^-{3,}$/gm, '');
  result = result.replace(/^\*{3,}$/gm, '');
  result = result.replace(/^={3,}$/gm, '');

  // 表格分隔符（竖线统一替换为空格）
  result = result.replace(/\|/g, ' ');

  // 多余空行压缩
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}
