/**
 * 图片 / 附件 URL 的**唯一**解析入口（防 G15 冗余）。
 *
 * 历史上有两份「相对路径 → 可显示 URL」的拼接逻辑（编辑器预览、导出），
 * 一旦分叉就会出现「预览能显示、导出丢图」这类难查的 bug。这里收敛为：
 *
 * - `protocol`  → `local-media://host/<abs>`（流式返回，不整读文件；日常预览用）
 * - `data-uri`  → `data:<mime>;base64,<…>`（走 IPC `readFileAsBuffer`；导出内嵌用）
 */

export type AssetUrlMode = 'protocol' | 'data-uri';

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

/** 带协议头的 URL（http(s) / data / blob / local-media / file 等），可直接使用。 */
const HAS_SCHEME = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/\/)/u;
const WINDOWS_ABS = /^[a-zA-Z]:[\\/]/u;

export function mimeFromPath(target: string): string {
  const dot = target.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  return MIME_BY_EXT[target.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

/** 是否已是可直接赋给 src 的 URL（调用方应原样使用，不做路径拼接）。 */
export function isExternalAsset(src: string): boolean {
  const raw = src.trim();
  return raw === '' || HAS_SCHEME.test(raw) || raw.startsWith('#');
}

/** 生成 local-media 协议 URL。统一用正斜杠，Electron 侧按此还原路径。 */
export function localMediaUrl(absPath: string): string {
  return `local-media://host/${encodeURIComponent(absPath.replace(/\\/g, '/'))}`;
}

/**
 * 把 Markdown 里的图片引用解析成绝对路径（纯字符串运算，不访问文件系统）。
 *
 * @param noteDir 笔记文件所在目录
 * @param src     Markdown 中书写的引用，如 `attachments/2024-01/x.png`
 * @returns 绝对路径；若 `src` 本身是外链/协议地址则返回 null（调用方用原值）
 */
export function resolveAssetPath(noteDir: string, src: string): string | null {
  const raw = src.trim();
  if (isExternalAsset(raw)) return null;
  if (WINDOWS_ABS.test(raw)) return raw.replace(/\//g, '\\');
  // POSIX 绝对路径：渲染进程无从判断其宿主含义，交给协议层，不做拼接
  if (raw.startsWith('/')) return null;

  const base = noteDir.replace(/[\\/]+$/u, '');
  const segments: string[] = [];
  for (const part of raw.split(/[\\/]/u)) {
    if (part === '' || part === '.') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  if (segments.length === 0) return null;
  return `${base}/${segments.join('/')}`;
}

/**
 * 统一解析入口。
 *
 * @returns 可直接用于 `src` 的 URL；无法解析时返回 null（调用方决定是否降级）。
 */
export async function resolveAssetUrl(
  noteDir: string,
  src: string,
  mode: AssetUrlMode = 'protocol',
): Promise<string | null> {
  const raw = src.trim();
  if (raw === '') return null;
  if (isExternalAsset(raw)) return raw;

  const abs = resolveAssetPath(noteDir, raw);
  if (!abs) return null;
  if (mode === 'protocol') return localMediaUrl(abs);

  // data-uri：导出场景需要内嵌，走 IPC 整读文件
  const api = typeof window !== 'undefined' ? window.electron?.notes : undefined;
  if (!api?.readFileAsBuffer) return null;
  try {
    const result = await api.readFileAsBuffer(abs);
    if (!result?.success || !result.base64) return null;
    const mime = result.mimeType || mimeFromPath(abs);
    return `data:${mime};base64,${result.base64}`;
  } catch {
    return null;
  }
}
