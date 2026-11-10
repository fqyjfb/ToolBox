import { useCallback, useEffect, useMemo, useState } from 'react';
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
  /** 点击图片弹层放大查看（阅读态用；默认关闭，避免影响其它内嵌预览） */
  enableImageZoom?: boolean;
  className?: string;
}

/**
 * 纯渲染组件：Markdown → 净化后的 HTML。
 *
 * - HTML 由 `renderDocumentMarkdown` 产出并经 DOMPurify 净化，不含任何用户可控的脚本。
 * - `useMemo` 缓存 `{ __html }`，
 *   避免父组件无关重渲染导致图片节点重建而闪烁。
 */
export function MarkdownView({
  source,
  resolveImage,
  enableImageZoom = false,
  className,
}: MarkdownViewProps) {
  const [zoomed, setZoomed] = useState<{ src: string; alt: string } | null>(null);

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

  // Esc 关闭放大层
  useEffect(() => {
    if (!zoomed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomed]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!enableImageZoom) return;
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (!target.classList.contains('document-image')) return;
      setZoomed({ src: target.currentSrc || target.src, alt: target.alt });
    },
    [enableImageZoom],
  );

  const rootClass = ['md', enableImageZoom ? 'md-zoomable' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div
        className={rootClass}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {zoomed ? (
        <div
          className="md-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={zoomed.alt || '图片预览'}
          onClick={() => setZoomed(null)}
        >
          <img src={zoomed.src} alt={zoomed.alt} />
        </div>
      ) : null}
    </>
  );
}

export default MarkdownView;
