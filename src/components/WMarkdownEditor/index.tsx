import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './WMarkdownEditor.css';
import { openUrl } from '../../services/browserService';
import { logError } from '../../services/loggerService';
import { isElectron } from '../../utils/environment';
import ContextMenu, { ContextMenuItem } from '../ui/ContextMenu';
import { Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListOrdered, Quote, Code, Minus, Bold, Italic, Strikethrough, Link, Image, Table, GitBranch, Hash } from 'lucide-react';

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

  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);

  const insertText = useCallback((text: string) => {
    const vditor = vditorRef.current;
    if (!vditor || !isReadyRef.current) return;
    vditor.insertValue(text);
    vditor.focus();
  }, []);

  const insertTextWithSelection = useCallback((before: string, after: string = '') => {
    const vditor = vditorRef.current;
    if (!vditor || !isReadyRef.current) return;
    const selectedText = vditor.getSelection() || '';
    vditor.insertValue(before + selectedText + after);
    vditor.focus();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readonly) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setIsContextMenuOpen(true);
  }, [readonly]);

  const contextMenuItems: ContextMenuItem[] = useMemo(() => [
    {
      id: 'headings',
      label: '标题',
      icon: <Heading1 className="w-4 h-4" />,
      subMenu: [
        { id: 'h1', label: '一级标题', icon: <Heading1 className="w-4 h-4" />, onClick: () => insertText('# ') },
        { id: 'h2', label: '二级标题', icon: <Heading2 className="w-4 h-4" />, onClick: () => insertText('## ') },
        { id: 'h3', label: '三级标题', icon: <Heading3 className="w-4 h-4" />, onClick: () => insertText('### ') },
        { id: 'h4', label: '四级标题', icon: <Heading4 className="w-4 h-4" />, onClick: () => insertText('#### ') },
        { id: 'h5', label: '五级标题', icon: <Heading5 className="w-4 h-4" />, onClick: () => insertText('##### ') },
        { id: 'h6', label: '六级标题', icon: <Heading6 className="w-4 h-4" />, onClick: () => insertText('###### ') },
      ]
    },
    {
      id: 'format',
      label: '文本格式',
      icon: <Bold className="w-4 h-4" />,
      subMenu: [
        { id: 'bold', label: '加粗', icon: <Bold className="w-4 h-4" />, onClick: () => insertTextWithSelection('**', '**') },
        { id: 'italic', label: '斜体', icon: <Italic className="w-4 h-4" />, onClick: () => insertTextWithSelection('*', '*') },
        { id: 'bold-italic', label: '加粗斜体', icon: <Bold className="w-4 h-4" />, onClick: () => insertTextWithSelection('***', '***') },
        { id: 'strikethrough', label: '删除线', icon: <Strikethrough className="w-4 h-4" />, onClick: () => insertTextWithSelection('~~', '~~') },
        { id: 'inline-code', label: '行内代码', icon: <Code className="w-4 h-4" />, onClick: () => insertTextWithSelection('`', '`') },
      ]
    },
    {
      id: 'lists',
      label: '列表',
      icon: <List className="w-4 h-4" />,
      subMenu: [
        { id: 'ul', label: '无序列表', icon: <List className="w-4 h-4" />, onClick: () => insertText('- ') },
        { id: 'ol', label: '有序列表', icon: <ListOrdered className="w-4 h-4" />, onClick: () => insertText('1. ') },
        { id: 'task', label: '任务列表', icon: <List className="w-4 h-4" />, onClick: () => insertText('- [ ] ') },
        { id: 'task-done', label: '已完成任务', icon: <List className="w-4 h-4" />, onClick: () => insertText('- [x] ') },
      ]
    },
    {
      id: 'code',
      label: '代码块',
      icon: <Code className="w-4 h-4" />,
      subMenu: [
        { id: 'code-block', label: '代码块', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```\n\n```\n') },
        { id: 'code-js', label: 'JavaScript', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```javascript\n\n```\n') },
        { id: 'code-ts', label: 'TypeScript', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```typescript\n\n```\n') },
        { id: 'code-py', label: 'Python', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```python\n\n```\n') },
        { id: 'code-css', label: 'CSS', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```css\n\n```\n') },
        { id: 'code-html', label: 'HTML', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```html\n\n```\n') },
      ]
    },
    {
      id: 'links',
      label: '链接与图片',
      icon: <Link className="w-4 h-4" />,
      subMenu: [
        { id: 'link', label: '链接', icon: <Link className="w-4 h-4" />, onClick: () => insertText('[链接文字](url)') },
        { id: 'image', label: '图片', icon: <Image className="w-4 h-4" />, onClick: () => insertText('![图片描述](url)') },
      ]
    },
    {
      id: 'tables',
      label: '表格',
      icon: <Table className="w-4 h-4" />,
      subMenu: [
        { id: 'table-basic', label: '基础表格', icon: <Table className="w-4 h-4" />, onClick: () => insertText('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n') },
        { id: 'table-align', label: '对齐表格', icon: <Table className="w-4 h-4" />, onClick: () => insertText('\n| 左对齐 | 居中对齐 | 右对齐 |\n| :--- | :---: | ---: |\n| 内容 | 内容 | 内容 |\n') },
      ]
    },
    {
      id: 'other',
      label: '其他',
      icon: <Minus className="w-4 h-4" />,
      subMenu: [
        { id: 'quote', label: '引用块', icon: <Quote className="w-4 h-4" />, onClick: () => insertText('> ') },
        { id: 'hr', label: '分割线', icon: <Minus className="w-4 h-4" />, onClick: () => insertText('\n---\n') },
        { id: 'footnote', label: '脚注', icon: <GitBranch className="w-4 h-4" />, onClick: () => insertText('[1](@ref)') },
        { id: 'task-list', label: '任务列表', icon: <Hash className="w-4 h-4" />, onClick: () => insertText('- [ ] 待办事项\n- [x] 已完成\n') },
      ]
    },
  ], [insertText, insertTextWithSelection]);

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
  }, [onChange, onSave, placeholder, height, minHeight, readonly, mode, theme, onFocus, onBlur, onUpload, handleLinkClick]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <>
      <div
        ref={containerRef}
        className={`w-markdown-editor ${className}`}
        style={{ height }}
        onContextMenu={handleContextMenu}
      />
      <ContextMenu
        isOpen={isContextMenuOpen}
        x={contextMenuX}
        y={contextMenuY}
        items={contextMenuItems}
        onClose={() => setIsContextMenuOpen(false)}
      />
    </>
  );
};

export default WMarkdownEditor;