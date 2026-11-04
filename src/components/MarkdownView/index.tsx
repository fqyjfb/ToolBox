import { useMemo } from 'react';
import { renderDocumentMarkdown } from '../../lib/markdown';
import './markdown.css';

export interface MarkdownViewProps {
  /** Markdown 源码 */
  source: string;
  /**
   * 把 Markdown 中的图片引用解析成可显示的 URL。
   * 返回 null 时渲染成 `[alt: 图片未加载]` 占位，而不是显示一个坏图。
   *
   * ⚠️ 请用 `useCallback` 包裹，否则每次父组件渲染都会重算 HTML、触发图片重建闪烁。
   */
  resolveImage?: (src: string) => string | null;
  className?: string;
}

/**
 * 纯渲染组件：Markdown → 净化后的 HTML。
 *
 * - HTML 由 `renderDocumentMarkdown` 产出并经 DOMPurify 净化，不含任何用户可控的脚本。
 * - `useMemo` 缓存 `{ __html }`，
 *   避免父组件无关重渲染导致图片节点重建而闪烁。
 */
export function MarkdownView({ source, resolveImage, className }: MarkdownViewProps) {
  const html = useMemo(() => {
    try {
      return renderDocumentMarkdown(source, {
        resolveImage,
        imageUnavailableLabel: '图片未加载',
      });
    } catch (error) {
      // DOMPurify 在无 DOM 的环境（如 SSR / 单测）会抛错，降级为转义后的纯文本
      console.error('[MarkdownView] 渲染失败，降级为纯文本', error);
      const escaped = source
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre class="md-render-error">${escaped}</pre>`;
    }
  }, [source, resolveImage]);

  return (
    <div
      className={className ? `md ${className}` : 'md'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default MarkdownView;
