import React, { useEffect, useRef, useCallback } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './WMarkdownEditor.css';
import { openUrl } from '../../services/browserService';
import { logError } from '../../services/loggerService';
import { isElectron } from '../../utils/environment';

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
  const beforePreviewRef = useRef<string>('');

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

    const electronEnv = isElectron();
    const cdnPath = electronEnv
      ? './vditor'
      : 'https://cdn.jsdelivr.net/npm/vditor';

    const vditor = new Vditor(containerRef.current, {
      cdn: cdnPath,
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
        theme: {
          current: theme === 'dark' ? 'dark' : 'light',
          path: electronEnv ? `${cdnPath}/dist/css/content-theme` : undefined,
        },
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
        emojiPath: electronEnv ? `${cdnPath}/dist/images/emoji` : undefined,
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

      if (mode === 'sv') {
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
      }
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleModeChange = () => {
      const contentElement = containerRef.current?.querySelector('.vditor-content');
      if (!contentElement) return;

      const isPreviewMode = contentElement.classList.contains('vditor-sv');
      const isEditMode = contentElement.classList.contains('vditor-ir') || contentElement.classList.contains('vditor-wysiwyg');

      if (isPreviewMode) {
        beforePreviewRef.current = vditor.getValue();
      } else if (isEditMode) {
        const currentValue = vditor.getValue();
        if (!currentValue && beforePreviewRef.current) {
          vditor.setValue(beforePreviewRef.current);
          lastValueRef.current = beforePreviewRef.current;
          onChange(beforePreviewRef.current);
        } else if (!currentValue && value) {
          vditor.setValue(value);
          lastValueRef.current = value;
          onChange(value);
        } else if (currentValue !== lastValueRef.current) {
          lastValueRef.current = currentValue;
          onChange(currentValue);
        }
      }

      if (contentElement.classList.contains('vditor-sv')) {
        setTimeout(() => {
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
        }, 100);
      }
    };

    const observeModeChange = () => {
      const observer = new MutationObserver((mutations) => {
        let shouldHandle = false;
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target as HTMLElement;
            if (target.classList.contains('vditor-sv') ||
              target.classList.contains('vditor-ir') ||
              target.classList.contains('vditor-wysiwyg')) {
              shouldHandle = true;
            }
          }
        });
        if (shouldHandle) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(handleModeChange, 50);
        }
      });
      const contentElement = containerRef.current?.querySelector('.vditor-content');
      if (contentElement) {
        observer.observe(contentElement, { attributes: true, attributeFilter: ['class'] });
      }
      return observer;
    };

    const modeObserver = observeModeChange();

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
      modeObserver.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('keydown', handleKeyDown);
      currentContainer?.removeEventListener('click', handleContainerClick, true);

      try {
        vditorRef.current?.destroy();
      } catch { /* ignore */ }
      vditorRef.current = null;
      isReadyRef.current = false;
    };
  }, [onChange, onSave, placeholder, height, minHeight, readonly, mode, theme, onFocus, onBlur, onUpload, handleLinkClick]);

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

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark';

    root.style.setProperty('--vditor-bg-color', isDark ? '#0d1117' : '#ffffff');
    root.style.setProperty('--vditor-text-color', isDark ? '#c9d1d9' : '#24292e');
    root.style.setProperty('--vditor-text-color-secondary', isDark ? '#9ca3af' : '#6b7280');
    root.style.setProperty('--vditor-code-bg', isDark ? '#0d1117' : '#f6f8fa');
    root.style.setProperty('--vditor-header-bg', isDark ? '#374151' : '#e5e7eb');
    root.style.setProperty('--vditor-border-color', isDark ? '#4b5563' : '#d1d5db');
    root.style.setProperty('--vditor-hover-bg', isDark ? '#4b5563' : '#d1d5db');

    return () => {
      root.style.removeProperty('--vditor-bg-color');
      root.style.removeProperty('--vditor-text-color');
      root.style.removeProperty('--vditor-text-color-secondary');
      root.style.removeProperty('--vditor-code-bg');
      root.style.removeProperty('--vditor-header-bg');
      root.style.removeProperty('--vditor-border-color');
      root.style.removeProperty('--vditor-hover-bg');
    };
  }, [theme]);

  return (
    <div
      ref={containerRef}
      className={`w-markdown-editor ${className}`}
      style={{ height }}
    />
  );
};

export default WMarkdownEditor;