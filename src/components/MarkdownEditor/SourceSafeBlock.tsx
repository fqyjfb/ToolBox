import type { SourceBlock } from '@/lib/markdown';
import './MarkdownEditor.css';

const REASON_TEXT: Record<string, string> = {
  'ambiguous-frontmatter': 'frontmatter 边界不明确',
  'footnote-is-source-safe': '脚注定义',
  'unclosed-fence': '围栏未闭合',
};

/**
 * 不可就地编辑的块（未闭合围栏、mermaid、脚注定义等）。
 * 降级为「显示源码 + 明确提示」，而不是静默变成不可用的空白。
 */
export function SourceSafeBlock({
  block,
  line,
}: {
  block: SourceBlock;
  line: number;
}) {
  return (
    <div
      className="mde-block mde-source-safe"
      data-source-from={block.range.from}
      data-source-to={block.range.to}
      data-source-kind={block.kind}
      data-source-line={line}
    >
      <div className="mde-source-safe-tip">
        {REASON_TEXT[block.reason ?? ''] ?? '此块暂不支持就地编辑'}（源码模式保留）
      </div>
      <pre className="mde-source-safe-code">{block.expectedText}</pre>
    </div>
  );
}

export default SourceSafeBlock;
