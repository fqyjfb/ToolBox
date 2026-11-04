import { markdownBodyStart } from "./frontmatter.ts";
import { setextHeadingLevel } from "./markdown-lines.ts";

export interface OutlineItem {
  anchor: string;
  level: number;
  text: string;
  /** 1-based 行号（相对**完整源码**，含 frontmatter），供大纲点击跳转定位 */
  line: number;
}

export interface OutlineNode extends OutlineItem {
  children: OutlineNode[];
}

export function headingAnchor(text: string): string {
  const slug = text
    .normalize("NFKD")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/[\s-]+/gu, "-");
  return slug || "section";
}

function plainHeading(source: string): string {
  return source
    .replace(/^ {0,3}#{1,6}\s+/u, "")
    .replace(/\s+#+\s*\n?$/u, "")
    .replace(/[*_`~]/gu, "")
    .trim();
}

function addOutlineItem(
  items: OutlineItem[],
  seen: Map<string, number>,
  level: number,
  source: string,
  line: number,
) {
  const text = plainHeading(source);
  if (!text) return;
  const base = headingAnchor(text);
  const count = (seen.get(base) ?? 0) + 1;
  seen.set(base, count);
  items.push({
    anchor: count === 1 ? base : `${base}-${count}`,
    level,
    text,
    line,
  });
}

export function deriveOutline(source: string): OutlineItem[] {
  const bodyStart = markdownBodyStart(source);
  const body = source.slice(bodyStart);
  // frontmatter 占用的行数，用于把 body 内下标换算成完整源码的 1-based 行号
  const lineOffset = source.slice(0, bodyStart).split("\n").length - 1;
  const seen = new Map<string, number>();
  const items: OutlineItem[] = [];
  const lines = body.split("\n");
  let fence: { marker: "`" | "~"; size: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const lineNumber = lineOffset + index + 1;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})/u.exec(line);
    if (fenceMatch) {
      const run = fenceMatch[1]!;
      const marker = run[0] as "`" | "~";
      if (!fence) {
        fence = { marker, size: run.length };
      } else if (fence.marker === marker && run.length >= fence.size) {
        fence = null;
      }
      continue;
    }
    if (fence) continue;
    const match = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+\s*)?$/u.exec(line);
    if (match) {
      addOutlineItem(items, seen, match[1]!.length, line, lineNumber);
      continue;
    }
    const setextLevel = setextHeadingLevel(line, lines[index + 1]);
    if (setextLevel !== null) {
      addOutlineItem(items, seen, setextLevel, line, lineNumber);
      index += 1;
    }
  }
  return items;
}

export function nestOutline(items: readonly OutlineItem[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const ancestors: OutlineNode[] = [];
  for (const item of items) {
    const node: OutlineNode = { ...item, children: [] };
    while (
      ancestors.length > 0 &&
      ancestors[ancestors.length - 1]!.level >= node.level
    ) {
      ancestors.pop();
    }
    const parent = ancestors[ancestors.length - 1];
    (parent?.children ?? roots).push(node);
    ancestors.push(node);
  }
  return roots;
}

export function filterOutlineTree(
  nodes: readonly OutlineNode[],
  query: string,
): OutlineNode[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...nodes];
  return nodes.flatMap((node) => {
    const children = filterOutlineTree(node.children, query);
    return node.text.toLocaleLowerCase().includes(normalized) || children.length
      ? [{ ...node, children }]
      : [];
  });
}
