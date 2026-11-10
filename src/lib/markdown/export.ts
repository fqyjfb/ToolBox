import { renderDocumentMarkdown } from './render.ts';
import { resolveAssetUrl } from './resolveAssetUrl.ts';

/**
 * 导出 HTML / PDF 的文档构建。
 *
 * 🔴 **必须解耦主题（G14）**：导出物是独立文件，拿不到主应用的 `--color-*`，
 * 且暗色主题下若跟随变量会导出黑底 PDF。这里强制 `color-scheme: light` + **浅色字面值**。
 */

/** 单图上限：超过则占位，避免 base64 撑爆内存 */
const MAX_SINGLE_IMAGE_BYTES = 8 * 1024 * 1024;
/** 累计上限：达到后停止内联后续图片 */
const MAX_TOTAL_IMAGE_BYTES = 40 * 1024 * 1024;

/** Markdown 图片引用：`![alt](src "title")` */
const IMAGE_REF = /!\[[^\]]*\]\((\S+?)(?:\s+"[^"]*")?\)/gu;

export interface BuildExportHtmlOptions {
  title?: string;
  /** 笔记所在目录，用于解析相对路径图片 */
  noteDir?: string;
}

/** 打印友好的浅色样式（不引用任何主应用 CSS 变量） */
const EXPORT_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px 32px;
  background: #ffffff;
  color: #18181b;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  font-size: 15px;
  line-height: 1.75;
}
h1, h2, h3, h4, h5, h6 { color: #18181b; font-weight: 600; line-height: 1.3; break-after: avoid; }
h1 { font-size: 26px; margin: 1.4em 0 .6em; padding-bottom: .3em; border-bottom: 1px solid #e4e4e7; }
h2 { font-size: 22px; margin: 1.3em 0 .5em; padding-bottom: .25em; border-bottom: 1px solid #e4e4e7; }
h3 { font-size: 18px; }
h4 { font-size: 16px; }
h5 { font-size: 15px; }
h6 { font-size: 14px; color: #71717a; }
p { margin: .8em 0; }
a { color: #2563eb; text-decoration: none; }
ul, ol { margin: .8em 0; padding-left: 1.5em; }
li { margin: .25em 0; }
blockquote {
  margin: 1em 0; padding: .2em 1em;
  border-left: 3px solid #e4e4e7; background: #f4f4f5; color: #71717a;
}
code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: .9em; padding: .15em .4em;
  background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: .25rem;
}
pre {
  margin: 1em 0; padding: .9em 1em;
  background: #f4f4f5; border: 1px solid #e4e4e7; border-radius: .375rem;
  overflow-x: auto; break-inside: avoid;
}
pre code { display: block; padding: 0; background: none; border: 0; font-size: 13px; }
table { width: 100%; margin: 1em 0; border-collapse: collapse; break-inside: auto; }
th, td { padding: .5em .75em; border: 1px solid #e4e4e7; text-align: left; }
th { background: #f4f4f5; font-weight: 600; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
img { max-width: 100%; max-height: 640px; width: auto; height: auto; object-fit: contain; margin: .6em 0; break-inside: avoid; }
hr { margin: 1.6em 0; border: 0; border-top: 1px solid #e4e4e7; }
.footnotes { margin-top: 2em; padding-top: .8em; border-top: 1px solid #e4e4e7; font-size: 14px; color: #71717a; }
.blocked-media { color: #a1a1aa; font-size: 13px; }
@page { margin: 18mm 16mm; }
`;

/**
 * 构建导出用 HTML。
 *
 * 图片会先异步内联成 base64（走 `resolveAssetUrl` 的 `data-uri` 模式），
 * 再交给渲染器——渲染器的 `resolveImage` 是同步的，无法直接等待异步 IO。
 */
export async function buildExportHtml(
  markdown: string,
  options: BuildExportHtmlOptions = {},
): Promise<string> {
  const noteDir = options.noteDir ?? '';
  const cache = new Map<string, string>();
  let totalBytes = 0;
  let quotaExhausted = false;

  for (const match of markdown.matchAll(IMAGE_REF)) {
    const source = match[1];
    if (!source || cache.has(source)) continue;

    if (quotaExhausted) {
      cache.set(source, '');
      continue;
    }

    let dataUri: string | null = null;
    try {
      dataUri = await resolveAssetUrl(noteDir, source, 'data-uri');
    } catch {
      dataUri = null;
    }
    if (!dataUri) {
      cache.set(source, '');
      continue;
    }

    // base64 体积约为原始字节的 4/3，这里按编码后长度粗估
    const bytes = Math.floor((dataUri.length * 3) / 4);
    if (bytes > MAX_SINGLE_IMAGE_BYTES || totalBytes + bytes > MAX_TOTAL_IMAGE_BYTES) {
      cache.set(source, '');
      if (bytes > MAX_SINGLE_IMAGE_BYTES) continue;
      quotaExhausted = true;
      continue;
    }
    totalBytes += bytes;
    cache.set(source, dataUri);
  }

  const body = renderDocumentMarkdown(markdown, {
    // 返回空串 → 渲染成 `[alt: 图片不可用]` 占位，不中断导出
    resolveImage: (destination) => cache.get(destination) ?? null,
    imageUnavailableLabel: '图片不可用',
  });

  return wrapHtml(body, options.title ?? '导出文档');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

export function wrapHtml(body: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${EXPORT_CSS}</style>
</head>
<body>
<main class="md">${body}</main>
</body>
</html>`;
}
