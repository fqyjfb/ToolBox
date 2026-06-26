import React, { useEffect, useRef, useCallback } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { openUrl } from '../../services/browserService';
import { logError } from '../../services/loggerService';

export interface WMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: (value: string) => void;
  placeholder?: string;
  height?: number | string;
  minHeight?: number;
  readonly?: boolean;
  mode?: 'sv' | 'ir' | 'wysiwyg';
  theme?: 'classic' | 'dark';
  onFocus?: () => void;
  onBlur?: () => void;
  onUpload?: (file: File) => Promise<string>;
  className?: string;
}

export const WMarkdownEditor: React.FC<WMarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  placeholder = '请输入 Markdown 内容...',
  height = '100%',
  minHeight = 300,
  readonly = false,
  mode = 'ir',
  theme = 'dark',
  onFocus,
  onBlur,
  onUpload,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const isReadyRef = useRef(false);
  const lastValueRef = useRef(value);

  const handleLinkClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const linkElement = target.closest('a');
    if (linkElement && linkElement.href) {
      const href = linkElement.getAttribute('href') || '';
      if (href && !href.startsWith('#')) {
        e.preventDefault();
        e.stopPropagation();
        openUrl(href);
      }
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const vditor = new Vditor(containerRef.current, {
      height,
      minHeight,
      placeholder,
      mode,
      theme,
      icon: 'material',
      lang: 'zh_CN',
      value,
      toolbar: [
        'headings', 'bold', 'italic', 'strike', 'link', '|',
        'list', 'ordered-list', 'check', 'outdent', 'indent', '|',
        'quote', 'line', 'code', 'inline-code', '|',
        'upload', 'table', '|',
        'undo', 'redo', '|',
        'edit-mode', 'preview', 'outline', '|',
        'export', 'help',
      ],
      cache: { enable: false },
      preview: {
        theme: { current: theme === 'dark' ? 'dark' : 'light' },
        hljs: {
          enable: true,
          lineNumber: true,
          style: theme === 'dark' ? 'monokai' : 'github-gist',
        },
        markdown: { toc: true, mark: true, footnotes: true, autoSpace: true },
        math: { inlineDigit: true },
      },
      hint: {
        parse: false,
        emoji: {
          ':+1:': '👍', ':-1:': '👎', ':smile:': '😄',
          ':tada:': '🎉', ':heart:': '❤️', ':rocket:': '🚀',
        },
      },
      upload: {
        handler: async (files: File[]) => {
          if (!onUpload || files.length === 0) return null;
          try {
            const url = await onUpload(files[0]);
            if (url) vditor.insertValue(`![](${url})`);
          } catch (error) {
            logError('上传图片失败', 'WMarkdownEditor', error as Error);
          }
          return null;
        },
      },
      input: (inputValue) => {
        lastValueRef.current = inputValue;
        onChange(inputValue);
      },
      focus: () => onFocus?.(),
      blur: () => onBlur?.(),
      after: () => {
        isReadyRef.current = true;
        lastValueRef.current = value;
        applyToolbarTipFix();
      },
    });

    const applyToolbarTipFix = () => {
      const styleEl = document.createElement('style');
      styleEl.id = 'vditor-tip-fix';
      styleEl.textContent = `
        .w-markdown-editor {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .w-markdown-editor > div:first-child {
          flex-shrink: 0;
        }
        .w-markdown-editor .vditor-toolbar {
          position: relative;
          z-index: 10;
        }
        .w-markdown-editor .vditor-toolbar__item {
          position: relative;
        }
        .w-markdown-editor .vditor-toolbar__tip {
          position: fixed !important;
          z-index: 99999 !important;
          margin: 0 !important;
          padding: 4px 10px !important;
          background: rgba(0, 0, 0, 0.9) !important;
          color: #ffffff !important;
          border-radius: 4px !important;
          font-size: 12px !important;
          white-space: nowrap !important;
          pointer-events: none !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
          border: none !important;
        }
        .w-markdown-editor .vditor-toolbar__tip::before {
          display: none !important;
        }
        .w-markdown-editor .vditor-toolbar__tip::after {
          content: '';
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid rgba(0, 0, 0, 0.9);
        }
        .w-markdown-editor .vditor-content {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .w-markdown-editor .vditor-ir,
        .w-markdown-editor .vditor-sv,
        .w-markdown-editor .vditor-wysiwyg {
          height: 100%;
        }
        .w-markdown-editor .vditor-ir pre,
        .w-markdown-editor .vditor-sv pre,
        .w-markdown-editor .vditor-wysiwyg pre {
          background-color: ${theme === 'dark' ? '#0d1117' : '#f6f8fa'};
        }
        .w-markdown-editor .vditor-ir code,
        .w-markdown-editor .vditor-sv code,
        .w-markdown-editor .vditor-wysiwyg code {
          color: ${theme === 'dark' ? '#c9d1d9' : '#24292e'};
        }
        .w-markdown-editor .vditor-content .code-block-wrapper {
          margin: 0.5rem 0;
          border-radius: 0.375rem;
          overflow: hidden;
        }
        .w-markdown-editor .vditor-content .code-block-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.375rem 1rem;
          background: ${theme === 'dark' ? '#374151' : '#e5e7eb'};
          border-bottom: 1px solid ${theme === 'dark' ? '#4b5563' : '#d1d5db'};
        }
        .w-markdown-editor .vditor-content .code-block-language {
          font-size: 0.75rem;
          font-weight: 500;
          color: ${theme === 'dark' ? '#d1d5db' : '#4b5563'};
          text-transform: capitalize;
        }
        .w-markdown-editor .vditor-content .code-block-copy {
          padding: 0.125rem 0.5rem;
          background: transparent;
          border: none;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          color: ${theme === 'dark' ? '#9ca3af' : '#6b7280'};
          cursor: pointer;
          transition: all 0.2s;
        }
        .w-markdown-editor .vditor-content .code-block-copy:hover {
          color: ${theme === 'dark' ? '#e5e7eb' : '#374151'};
          background: ${theme === 'dark' ? '#4b5563' : '#d1d5db'};
        }
        .w-markdown-editor .vditor-content .code-block-wrapper pre {
          margin: 0 !important;
          border-radius: 0 !important;
        }
      `;
      document.head.appendChild(styleEl);

      const toolbarItems = containerRef.current?.querySelectorAll('.vditor-toolbar__item');
      toolbarItems?.forEach((item) => {
        const tip = item.querySelector('.vditor-toolbar__tip');
        if (tip) {
          item.addEventListener('mouseenter', () => {
            const rect = item.getBoundingClientRect();
            const tipElement = tip as HTMLElement;
            tipElement.style.left = `${rect.left + rect.width / 2}px`;
            tipElement.style.top = `${rect.bottom + 8}px`;
            tipElement.style.transform = 'translateX(-50%)';
          });
        }
      });

      const wrapCodeBlocks = () => {
        const contentContainer = containerRef.current?.querySelector('.vditor-content');
        if (!contentContainer) return;

        const preElements = contentContainer.querySelectorAll('pre');
        preElements.forEach((pre) => {
          if (pre.parentElement?.classList.contains('code-block-wrapper')) return;

          const codeElement = pre.querySelector('code');
          let language = '';
          if (codeElement) {
            const className = codeElement.className || '';
            const match = className.match(/language-([\w\u4e00-\u9fa5]+)/);
            language = match ? match[1] : '';
          }

          const wrapper = document.createElement('div');
          wrapper.className = 'code-block-wrapper';

          const header = document.createElement('div');
          header.className = 'code-block-header';

          const languageSpan = document.createElement('span');
          languageSpan.className = 'code-block-language';
          languageSpan.textContent = language || '代码';

          const copyButton = document.createElement('button');
          copyButton.className = 'code-block-copy';
          copyButton.textContent = '复制';
          copyButton.onclick = () => {
            navigator.clipboard.writeText(pre.textContent || '');
          };

          header.appendChild(languageSpan);
          header.appendChild(copyButton);

          wrapper.appendChild(header);
          wrapper.appendChild(pre.cloneNode(true));
          pre.replaceWith(wrapper);
        });
      };

      if (mode === 'sv') {
        wrapCodeBlocks();
      }
    };

    const handleContainerClick = (e: MouseEvent) => {
      handleLinkClick(e);
    };

    const currentContainer = containerRef.current;
    currentContainer.addEventListener('click', handleContainerClick, true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave?.(vditor.getValue());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    vditorRef.current = vditor;

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      currentContainer?.removeEventListener('click', handleContainerClick, true);

      const styleEl = document.getElementById('vditor-tip-fix');
      if (styleEl) styleEl.remove();

      try {
        vditorRef.current?.destroy();
      } catch { /* ignore */ }
      vditorRef.current = null;
      isReadyRef.current = false;
    };
  }, [value, onChange, onSave, placeholder, height, minHeight, readonly, mode, theme, onFocus, onBlur, onUpload, handleLinkClick]);

  useEffect(() => {
    if (!vditorRef.current || !isReadyRef.current) return;
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      vditorRef.current.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (!vditorRef.current || !isReadyRef.current) return;
    if (readonly) {
      (vditorRef.current as unknown as { disable: () => void }).disable();
    } else {
      (vditorRef.current as unknown as { enable: () => void }).enable();
    }
  }, [readonly]);

  return (
    <div
      ref={containerRef}
      className={`w-markdown-editor ${className}`}
      style={{ height }}
    />
  );
};

export default WMarkdownEditor;