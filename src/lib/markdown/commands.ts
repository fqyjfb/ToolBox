const escapableMarkdown = /([\\`*_[\]()])/gu;

export function escapeMarkdownText(text: string): string {
  return text.replace(escapableMarkdown, "\\$1");
}

function longestBacktickRun(text: string): number {
  let longest = 0;
  for (const match of text.matchAll(/`+/gu)) {
    longest = Math.max(longest, match[0].length);
  }
  return longest;
}

export function safeLinkTarget(target: string): string | null {
  const trimmed = target.trim();
  if (
    trimmed.length === 0 ||
    /^(?:javascript|data|vbscript):/iu.test(trimmed) ||
    /[\r\n<>]/u.test(trimmed)
  ) {
    return null;
  }
  if (/\s/u.test(trimmed)) return `<${trimmed}>`;
  return trimmed
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

/** 生成图片语法；目标不可用时返回空串（调用方直接跳过，不落脏数据） */
export function formatImageMarkdown(url: string, alt = "image"): string {
  const target = safeLinkTarget(url);
  if (!target) return "";
  const label = alt.replace(/[[\]\\]/gu, "").trim() || "image";
  return `![${label}](${target})`;
}

/** 形态一：整条图片语法被转义 —— !\[alt\]\(url\) */
const ESCAPED_IMAGE = /!\\\[([^\]]*?)\\\]\\\(([^)\s]+?)\\\)/gu;
/** 形态二·链接包裹且外链干净（href 内无 <>）：<>!<>alt<><>src<><><>href<> */
const ANGLE_LINKED_CLEAN = /<>(!<>([^<>]*)<><>([^<>]+)<>)<><>([^<>]+)<>$/gmu;
/** 形态二·链接包裹但外链本身也被 <> 破坏：只救图片，不猜 href */
const ANGLE_LINKED_DIRTY = /<>!<>([^<>]*)<><>([^<>]+)<><><>.+<>$/gmu;
/** 形态二·单图：!<>alt<><>src<> */
const ANGLE_IMAGE = /!<>([^<>]*)<><>([^<>]+)<>/gu;

/**
 * 修复历史坏数据：只处理「结构可完全判定」的两种形态，幂等。
 *
 * - 形态一：`!\[alt\]\(url\)`（写入时被 escapeMarkdownText 转义）
 * - 形态二：`!<>alt<><>url<>`（转义对又被外部替换成 `<>`）
 *
 * 结构不完整的行原样保留，绝不猜测被压缩掉的字符。
 */
export function repairBrokenImageSyntax(markdown: string): string {
  return markdown
    .replace(
      ANGLE_LINKED_CLEAN,
      (_match, _image, alt: string, src: string, href: string) =>
        `[![${alt}](${src})](${href})`,
    )
    .replace(ANGLE_LINKED_DIRTY, (_match, alt: string, src: string) => `![${alt}](${src})`)
    .replace(ANGLE_IMAGE, (_match, alt: string, src: string) => `![${alt}](${src})`)
    .replace(ESCAPED_IMAGE, (_match, alt: string, url: string) => `![${alt}](${url})`);
}

function serializeChildren(node: Node): string {
  return [...node.childNodes].map((child) => serializeNode(child)).join("");
}

/** 图片/图片占位按原子处理：回写原始 Markdown，避免拆分块时静默丢图 */
function serializeAtomicMedia(node: HTMLElement): string | null {
  const source = node.getAttribute("data-md-src");
  if (!source) return null;
  const target = safeLinkTarget(source);
  if (!target) return "";
  const alt =
    node.tagName === "IMG" ? node.getAttribute("alt") ?? "" : node.getAttribute("data-md-alt") ?? "";
  return `![${alt}](${target})`;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownText(node.textContent ?? "");
  }
  if (!(node instanceof HTMLElement)) return "";
  if (node.matches(".footnote-atom[data-footnote-source]")) {
    return node.getAttribute("data-footnote-source") ?? "";
  }
  const media = serializeAtomicMedia(node);
  if (media !== null) return media;

  const children = serializeChildren(node);
  switch (node.tagName) {
    case "B":
    case "STRONG":
      return children.length === 0 ? "" : `**${children}**`;
    case "EM":
    case "I":
      return children.length === 0 ? "" : `*${children}*`;
    case "DEL":
    case "S":
    case "STRIKE":
      return children.length === 0 ? "" : `~~${children}~~`;
    case "CODE": {
      const content = node.textContent ?? "";
      const delimiter = "`".repeat(longestBacktickRun(content) + 1);
      return `${delimiter}${content}${delimiter}`;
    }
    case "A": {
      const target = safeLinkTarget(node.getAttribute("href") ?? "");
      const title = node.getAttribute("title");
      const serializedTitle = title
        ? ` "${title.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
        : "";
      return target ? `[${children}](${target}${serializedTitle})` : children;
    }
    case "BR":
      return "\n";
    case "IMG":
      return "";
    case "DIV":
    case "P":
      return children;
    default:
      return children;
  }
}

export function serializeInlineDom(root: HTMLElement): string {
  return serializeChildren(root);
}

function plainTextNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof HTMLElement)) return "";
  if (node.matches(".footnote-atom[data-footnote-source]")) {
    return node.getAttribute("data-footnote-source") ?? "";
  }
  if (node.hasAttribute("data-md-src")) return "";
  if (node.tagName === "BR") return "\n";
  if (node.tagName === "IMG") return "";
  return [...node.childNodes].map((child) => plainTextNode(child)).join("");
}

export function plainTextFromInlineDom(root: HTMLElement): string {
  return [...root.childNodes].map((child) => plainTextNode(child)).join("");
}

export function splitInlineDomAtSelection(
  root: HTMLElement,
): { after: string; before: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const caret = selection.getRangeAt(0);
  if (!caret.collapsed || !root.contains(caret.commonAncestorContainer)) {
    return null;
  }

  const serializeFragment = (range: Range) => {
    const fragmentRoot = document.createElement("div");
    fragmentRoot.append(range.cloneContents());
    return serializeInlineDom(fragmentRoot);
  };
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(caret.startContainer, caret.startOffset);
  const after = document.createRange();
  after.selectNodeContents(root);
  after.setStart(caret.startContainer, caret.startOffset);
  return {
    after: serializeFragment(after),
    before: serializeFragment(before),
  };
}

function uniqueIndex(haystack: string, needle: string): number | null {
  const first = haystack.indexOf(needle);
  if (first === -1 || haystack.indexOf(needle, first + 1) !== -1) return null;
  return first;
}

export function mergeInlineTextEdit(
  originalMarkdown: string,
  beforeText: string,
  afterText: string,
): string | null {
  if (beforeText === afterText) return originalMarkdown;
  let prefix = 0;
  while (
    prefix < beforeText.length &&
    prefix < afterText.length &&
    beforeText[prefix] === afterText[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < beforeText.length - prefix &&
    suffix < afterText.length - prefix &&
    beforeText[beforeText.length - suffix - 1] ===
      afterText[afterText.length - suffix - 1]
  ) {
    suffix += 1;
  }
  const removed = beforeText.slice(prefix, beforeText.length - suffix);
  const inserted = escapeMarkdownText(
    afterText.slice(prefix, afterText.length - suffix),
  );

  if (prefix === beforeText.length) return `${originalMarkdown}${inserted}`;
  if (suffix === beforeText.length) return `${inserted}${originalMarkdown}`;

  if (removed.length > 0) {
    // 先尝试唯一匹配（原逻辑，在 removed 不重复时最精确）
    const index = uniqueIndex(originalMarkdown, removed);
    if (index !== null) {
      return `${originalMarkdown.slice(0, index)}${inserted}${originalMarkdown.slice(index + removed.length)}`;
    }
    // 退一步：removed 重复时，从 0 位置找第一个匹配并替换
    // 理由：prefix 告诉我们用户大概率在某侧操作，第一个匹配是最合理的 fallback
    // （如果 Markdown 里确实不存在 removed，indexOf 返回 -1，继续走下面的边界回退）
    const firstIndex = originalMarkdown.indexOf(removed);
    if (firstIndex !== -1) {
      return `${originalMarkdown.slice(0, firstIndex)}${inserted}${originalMarkdown.slice(firstIndex + removed.length)}`;
    }
  }

  const left = beforeText.slice(Math.max(0, prefix - 24), prefix);
  const right = beforeText.slice(prefix, prefix + 24);
  const leftIndex = left.length > 0 ? uniqueIndex(originalMarkdown, left) : 0;
  const rightIndex =
    right.length > 0
      ? uniqueIndex(originalMarkdown, right)
      : originalMarkdown.length;
  if (leftIndex === null || rightIndex === null) {
    // 边界回退：uniqueIndex 失败说明 Markdown 里找不到锚点
    // 这极少见（Markdown 格式语法和纯文本差异太大），返回 null 让调用方走全量序列化兜底
    return null;
  }
  const boundary = leftIndex + left.length;
  if (boundary !== rightIndex) return null;
  return `${originalMarkdown.slice(0, boundary)}${inserted}${originalMarkdown.slice(boundary)}`;
}
