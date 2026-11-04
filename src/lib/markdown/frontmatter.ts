/**
 * YAML frontmatter 的**最小**实现：只做定界扫描，不解析 YAML。
 *
 * 刻意只保留块投影与渲染真正需要的定界能力（`markdownBodyStart` / `indexFrontmatter`）。
 * 笔记是普通 Markdown（不使用 frontmatter 元数据编辑），因此不引入 `yaml` 包，
 * 也不实现 entries/metadata 等结构化解析能力。
 *
 * 这样既让含 `---` 前导块的笔记能被正确切块，又避免了无用的第三方依赖与死代码。
 */

export type FrontmatterStatus = "absent" | "safe" | "unsafe";

export interface FrontmatterIndex {
  bodyStart: number;
  frontmatterRange?: [number, number];
  status: FrontmatterStatus;
}

/**
 * 正文起始偏移：若源码以 `---` 开头并有闭合定界，返回闭合之后的位置；否则 0。
 * 仅按行定界扫描，不解析内容，因此与 YAML 语义无关。
 */
export function markdownBodyStart(source: string): number {
  const opening = /^\ufeff?---\r?\n/u.exec(source);
  if (!opening) return 0;
  const closing = /^(?:---|\.\.\.)\r?$/gmu;
  closing.lastIndex = opening[0].length;
  const match = closing.exec(source);
  if (!match) return 0;
  return (
    match.index +
    match[0].length +
    (source[match.index + match[0].length] === "\n" ? 1 : 0)
  );
}

/** 定位 frontmatter 区间。只识别定界，不解析字段。 */
export function indexFrontmatter(source: string): FrontmatterIndex {
  const start = source.startsWith("\ufeff") ? 1 : 0;
  const bodyStart = markdownBodyStart(source);
  if (bodyStart === 0) {
    // 没有闭合的 `---`：视为未终止的 frontmatter，交给块投影降级处理
    const unterminated =
      source.startsWith("---\n", start) || source.startsWith("---\r\n", start);
    return {
      bodyStart: 0,
      status: unterminated ? "unsafe" : "absent",
    };
  }
  return {
    bodyStart,
    frontmatterRange: [start, bodyStart],
    status: "safe",
  };
}
