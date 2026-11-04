/**
 * 行内格式（加粗 / 斜体 / 删除线 / 行内代码）的 Markdown 层面改写。
 *
 * 单独成文件，避免与组件同文件导出非组件内容而触发
 * `react-refresh/only-export-components`。
 *
 * 实现取舍：块内是**渲染后**的 DOM，选区拿到的是纯文本，而写回目标是 **Markdown 源文本**，
 * 两者偏移并不一致（`**粗**` 渲染后只剩 `粗`）。精确映射需要维护 DOM→源的位置表，
 * 成本高且易错。这里采用「在源文本里定位选中纯文本」的实用做法：
 * 命中则包裹/解包，未命中返回 `null` 由上层降级。
 */

export type InlineFormat = "bold" | "italic" | "strike" | "code" | "clear";

/** 包裹型标记：`clear` 不参与，见 stripInlineFormat */
const MARKERS: Record<Exclude<InlineFormat, "clear">, string> = {
  bold: "**",
  italic: "*",
  strike: "~~",
  code: "`",
};

/** 剥离标记的顺序：先长后短，避免 `**` 被当成两个 `*` 处理 */
const STRIP_ORDER = ["**", "~~", "*", "`"] as const;

/**
 * 在 `sourceText` 中包裹或解包 `selectedText`。
 *
 * `format` 刻意排除 `"clear"`：清除走 `stripInlineFormat`，
 * 这样误传 `"clear"` 会在**编译期**被拦下，而不是静默取不到标记。
 *
 * @returns 改写后的整块文本；无法定位时返回 `null`。
 */
export function toggleInlineFormat(
  sourceText: string,
  selectedText: string,
  format: Exclude<InlineFormat, "clear">,
): string | null {
  const text = selectedText.trim();
  if (!text) return null;
  const marker = MARKERS[format];
  const wrapped = `${marker}${text}${marker}`;

  // 已是「带标记」形态（源里本来就包着）→ 解包
  if (sourceText.includes(wrapped)) {
    return sourceText.replace(wrapped, text);
  }

  // 否则包裹首次出现的位置
  const index = sourceText.indexOf(text);
  if (index < 0) return null;
  return (
    sourceText.slice(0, index) + wrapped + sourceText.slice(index + text.length)
  );
}

/**
 * 清除选区上的行内标记。
 * 只去掉**紧贴选区两侧成对出现**的标记，不触碰文本内部，避免误删语义符号。
 * @returns 改写后的整块文本；无法定位时返回 `null`。
 */
export function stripInlineFormat(
  sourceText: string,
  selectedText: string,
): string | null {
  const text = selectedText.trim();
  if (!text) return null;
  const index = sourceText.indexOf(text);
  if (index < 0) return null;
  let before = sourceText.slice(0, index);
  let after = sourceText.slice(index + text.length);
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const marker of STRIP_ORDER) {
      if (before.endsWith(marker) && after.startsWith(marker)) {
        before = before.slice(0, -marker.length);
        after = after.slice(marker.length);
        stripped = true;
      }
    }
  }
  return before + text + after;
}

/** 生成 Markdown 表格骨架（含对齐分隔行） */
export function buildTableMarkdown(rows: number, cols: number): string {
  const width = Math.max(1, Math.min(cols, 20));
  const height = Math.max(1, Math.min(rows, 40));
  const header = `| ${Array.from({ length: width }, (_, i) => `列 ${i + 1}`).join(" | ")} |`;
  const divider = `| ${Array.from({ length: width }, () => "---").join(" | ")} |`;
  const body = Array.from(
    { length: height },
    () => `| ${Array.from({ length: width }, () => " ").join(" | ")} |`,
  );
  return [header, divider, ...body].join("\n");
}
