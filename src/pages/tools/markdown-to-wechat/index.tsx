import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileCode, Copy, Trash2, FileText, Download, Upload, Eye, Edit3, Save, FileDown, LayoutTemplate, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListOrdered, Quote, Code, Minus, Bold, Italic, Strikethrough, Link, Image, Table, GitBranch, Hash } from 'lucide-react';
import { useToastStore } from '../../../store/toastStore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import ContextMenu, { ContextMenuItem } from '../../../components/ui/ContextMenu';

const MarkdownToWechatPage: React.FC = () => {
  const addToast = useToastStore((state) => state.addToast);
  
  const getInitialMarkdown = (): string => {
    const cached = localStorage.getItem('markdown-wechat-content');
    return cached || '';
  };
  
  const [markdown, setMarkdown] = useState<string>(getInitialMarkdown);
  
  useEffect(() => {
    localStorage.setItem('markdown-wechat-content', markdown);
  }, [markdown]);
  
  const [activeTab, setActiveTab] = useState<'edit' | 'preview' | 'split'>('split');
  const [fileName, setFileName] = useState('未命名.md');
  const previewRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuX, setContextMenuX] = useState(0);
  const [contextMenuY, setContextMenuY] = useState(0);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setMarkdown(content);
        setFileName(file.name);
        addToast({ message: `文件已加载: ${file.name}`, type: 'success' });
      };
      reader.readAsText(file);
    }
  }, [addToast]);

  const handleFileDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast({ message: `文件已保存: ${fileName}`, type: 'success' });
  }, [markdown, fileName, addToast]);

  const handleSave = useCallback(() => {
    handleFileDownload();
  }, [handleFileDownload]);

  const handleClear = useCallback(() => {
    setMarkdown('');
    setFileName('未命名.md');
    addToast({ message: '编辑器已清空', type: 'info' });
  }, [addToast]);
  
  const handleInsertTemplate = useCallback(() => {
    const template = `# 标题：赛博科技蓝色系公众号排版

## 开场
一段简短引言，说明主题与价值。

### 亮点一：阅读层级清晰
- 蓝色点缀标题
- 段落节奏舒适
- 重点内容自动强调

> 引用内容会自动转换成醒目的蓝色块。

### 亮点二：代码块更易读

\`\`\`js
const theme = "cyber-blue";
console.log(theme);
\`\`\`

**粗体** 与 *斜体* 会被轻微强调，~~删除线~~ 可用于标注旧内容。

[查看文档](https://example.com)

| 模块 | 说明 | 状态 |
| --- | --- | --- |
| 主题 | 赛博科技蓝 | ✅ |
| 表格 | 自动排版 | ✅ |`;
    setMarkdown(template);
    setFileName('模板.md');
    addToast({ message: '模板已插入', type: 'success' });
  }, [addToast]);

  const insertText = useCallback((text: string, prependNewline: boolean = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = markdown.substring(0, start);
    const after = markdown.substring(end);
    
    let newText = before + text + after;
    
    if (prependNewline && start > 0 && !before.endsWith('\n')) {
      newText = before + '\n' + text + after;
    }
    
    setMarkdown(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }, [markdown]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setContextMenuX(e.clientX);
    setContextMenuY(e.clientY);
    setIsContextMenuOpen(true);
  }, []);

  const insertTextWithSelection = useCallback((before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = markdown.substring(start, end);
    const fullText = before + selectedText + after;
    
    setMarkdown(markdown.substring(0, start) + fullText + markdown.substring(end));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + fullText.length);
    }, 0);
  }, [markdown]);

  const contextMenuItems: ContextMenuItem[] = [
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
        { id: 'code-block', label: '代码块', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```\n\n```\n', true) },
        { id: 'code-js', label: 'JavaScript', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```javascript\n\n```\n', true) },
        { id: 'code-ts', label: 'TypeScript', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```typescript\n\n```\n', true) },
        { id: 'code-py', label: 'Python', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```python\n\n```\n', true) },
        { id: 'code-css', label: 'CSS', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```css\n\n```\n', true) },
        { id: 'code-html', label: 'HTML', icon: <Code className="w-4 h-4" />, onClick: () => insertText('\n```html\n\n```\n', true) },
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
        { id: 'table-basic', label: '基础表格', icon: <Table className="w-4 h-4" />, onClick: () => insertText('\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n', true) },
        { id: 'table-align', label: '对齐表格', icon: <Table className="w-4 h-4" />, onClick: () => insertText('\n| 左对齐 | 居中对齐 | 右对齐 |\n| :--- | :---: | ---: |\n| 内容 | 内容 | 内容 |\n', true) },
      ]
    },
    {
      id: 'other',
      label: '其他',
      icon: <Minus className="w-4 h-4" />,
      subMenu: [
        { id: 'quote', label: '引用块', icon: <Quote className="w-4 h-4" />, onClick: () => insertText('> ') },
        { id: 'hr', label: '分割线', icon: <Minus className="w-4 h-4" />, onClick: () => insertText('\n---\n', true) },
        { id: 'footnote', label: '脚注', icon: <GitBranch className="w-4 h-4" />, onClick: () => insertText('[1](@ref)') },
        { id: 'task-list', label: '任务列表', icon: <Hash className="w-4 h-4" />, onClick: () => insertText('- [ ] 待办事项\n- [x] 已完成\n') },
      ]
    },
  ];

  const handleExportPDF = useCallback(async () => {
    if (!previewRef.current) {
      addToast({ message: '无法找到预览区域', type: 'error' });
      return;
    }

    addToast({ message: '正在生成 PDF...', type: 'info' });

    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

      const pdfFileName = fileName.replace('.md', '.pdf');
      pdf.save(pdfFileName);

      addToast({ message: `PDF 文件已导出: ${pdfFileName}`, type: 'success' });
    } catch (error) {
      console.error('PDF 导出失败:', error);
      addToast({ message: 'PDF 导出失败，请重试', type: 'error' });
    }
  }, [fileName, addToast]);

  const parseTables = (md: string): string => {
    const lines = md.split('\n');
    const out: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const next = lines[i + 1] || '';
      const isTableHeader = line.includes('|') && /^\s*\|?[\s:-]+\|[\s|:-]+\|?\s*$/.test(next);

      if (isTableHeader) {
        const headers = splitTableRow(line);
        const tableRows: string[][] = [];
        i += 2;
        while (i < lines.length && lines[i].includes('|')) {
          if (lines[i].trim() === '') break;
          tableRows.push(splitTableRow(lines[i]));
          i += 1;
        }
        out.push(renderTable(headers, tableRows));
        continue;
      }

      out.push(line);
      i += 1;
    }

    return out.join('\n');
  };

  const splitTableRow = (line: string): string[] => {
    const trimmed = line.trim();
    const raw = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
    const stripped = raw.endsWith('|') ? raw.slice(0, -1) : raw;
    return stripped.split('|').map(cell => cell.trim());
  };

  const renderTable = (headers: string[], rows: string[][]): string => {
    const head = headers.map(cell => `<th>${cell}</th>`).join('');
    const body = rows.map((row) => {
      const cols = headers.map((_, idx) => `<td>${row[idx] || ''}</td>`).join('');
      return `<tr>${cols}</tr>`;
    }).join('');
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const parseMarkdown = (md: string): string => {
    let html = parseTables(md);
    
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      return `<pre><code class="language-${lang || ''}">${escapeHtml(code.trim())}</code></pre>`;
    });
    
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong style="color: #0f4c81;"><span style="font-style: italic; color: #0f4c81;">$1</span></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color: #0f4c81;">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<span style="font-style: italic; color: #0f4c81;">$1</span>');
    html = html.replace(/___(.+?)___/g, '<strong style="color: #0f4c81;"><span style="font-style: italic; color: #0f4c81;">$1</span></strong>');
    html = html.replace(/__(.+?)__/g, '<strong style="color: #0f4c81;">$1</strong>');
    html = html.replace(/_(.+?)_/g, '<span style="font-style: italic; color: #0f4c81;">$1</span>');
    
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    html = html.replace(/!\[([^\]]*)\]\(([^\)]+)\)/g, '<img src="$2" alt="$1">');
    
    html = html.replace(/^[\*\-] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      if (match.includes('<ul>')) return match;
      return '<ol>' + match + '</ol>';
    });
    
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/(<blockquote>.*<\/blockquote>\n?)+/g, (match) => {
      return '<blockquote>' + match.replace(/<\/?blockquote>/g, '').trim() + '</blockquote>';
    });
    
    html = html.replace(/^-{3,}$/gm, '<hr>');
    html = html.replace(/^\*{3,}$/gm, '<hr>');
    html = html.replace(/^(?!<[h|u|o|b|p|d|t])(.+)$/gm, '<p>$1</p>');
    html = html.replace(/\n\n/g, '</p>\n<p>');
    html = html.replace(/<p><(h[1-6]|ul|ol|blockquote|pre|hr|table|thead|tbody|tr|td|th)/g, '<$1');
    html = html.replace(/<\/(h[1-6]|ul|ol|blockquote|pre|hr|table|thead|tbody|tr|td|th)><\/p>/g, '</$1>');
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
  };

  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const applyInlineStyles = (html: string): string => {
    return html
      .replace(/<pre><code[^>]*>/g, '<pre style="background: #0b1a2b; color: #e2f2ff; padding: 16px; border-radius: 12px; overflow-x: auto; margin: 1rem 0; border: 1px solid rgba(56, 189, 248, 0.2);"><code style="background: transparent; padding: 0; color: inherit; font-family: Courier New, monospace; font-size: 0.92em;">')
      .replace(/<pre>/g, '<pre style="background: #0b1a2b; color: #e2f2ff; padding: 16px; border-radius: 12px; overflow-x: auto; margin: 1rem 0; border: 1px solid rgba(56, 189, 248, 0.2);">')
      .replace(/<code>/g, '<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-family: Courier New, monospace; font-size: 0.92em; color: #0f172a;">')
      .replace(/<h1>/g, '<h1 style="font-size: 1.9rem; margin: 0 0 1rem 0; color: #0b2a4a; border-bottom: 2px solid #bae6fd; padding-bottom: 0.6rem;">')
      .replace(/<h2>/g, '<h2 style="font-size: 1.4rem; margin: 1.6rem 0 0.8rem; color: #0f4c81; padding-left: 12px; border-left: 4px solid #38bdf8;">')
      .replace(/<h3>/g, '<h3 style="font-size: 1.15rem; margin: 1.2rem 0 0.6rem; color: #115e9b;">')
      .replace(/<h4>/g, '<h4 style="font-size: 1rem; margin: 1rem 0 0.5rem; color: #1e40af;">')
      .replace(/<p>/g, '<p style="margin: 0 0 1rem; color: #334155;">')
      .replace(/<strong>/g, '<strong style="color: #0f4c81;">')
      .replace(/<em>/g, '<em style="font-style: italic !important; color: #0f4c81; font-weight: 400;">')
      .replace(/<a /g, '<a style="color: #0ea5e9; text-decoration: none; border-bottom: 1px dashed rgba(14, 165, 233, 0.5);" ')
      .replace(/<ul>/g, '<ul style="margin: 0 0 1rem 1.2rem;">')
      .replace(/<ol>/g, '<ol style="margin: 0 0 1rem 1.2rem;">')
      .replace(/<li>/g, '<li style="margin: 0.4rem 0;">')
      .replace(/<blockquote>/g, '<blockquote style="margin: 1.2rem 0; padding: 0.8rem 1rem; background: #f0f9ff; border-left: 4px solid #38bdf8; color: #475569;">')
      .replace(/<img /g, '<img style="max-width: 100%; border-radius: 12px; margin: 1rem 0;" ')
      .replace(/<table>/g, '<table style="border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.95rem;">')
      .replace(/<th>/g, '<th style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; background: #f1f5f9; color: #0f172a;">')
      .replace(/<td>/g, '<td style="border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left;">')
      .replace(/<hr>/g, '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.8rem 0;">');
  };

  const copyWechatHtml = useCallback(() => {
    if (!markdown.trim()) {
      addToast({ message: '请先输入内容', type: 'warning' });
      return;
    }
    
    const content = applyInlineStyles(parseMarkdown(markdown));
    const html = `<section style="font-family: Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif; color: #1f2937; line-height: 1.75; padding: 0 24px;">${content}</section>`;
    
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    document.body.appendChild(wrapper);
    
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    try {
      document.execCommand('copy');
      addToast({ message: '公众号内容已复制', type: 'success' });
    } catch {
      navigator.clipboard.writeText(html).then(() => {
        addToast({ message: '公众号 HTML 已复制', type: 'success' });
      }).catch(() => {
        addToast({ message: '复制失败', type: 'error' });
      });
    } finally {
      selection?.removeAllRanges();
      document.body.removeChild(wrapper);
    }
  }, [markdown, addToast]);

  const copyPreviewHtml = useCallback(() => {
    if (!markdown.trim()) {
      addToast({ message: '请先输入内容', type: 'warning' });
      return;
    }
    
    const html = `<div class="wx-article">${parseMarkdown(markdown)}</div>`;
    navigator.clipboard.writeText(html).then(() => {
      addToast({ message: '预览 HTML 已复制', type: 'success' });
    }).catch(() => {
      addToast({ message: '复制失败', type: 'error' });
    });
  }, [markdown, addToast]);

  return (
    <div className="h-full flex flex-col p-4 markdown-wechat-container">
      <style>{`
        .markdown-wechat-container ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .markdown-wechat-container ::-webkit-scrollbar-track {
          background: transparent;
        }
        .markdown-wechat-container ::-webkit-scrollbar-thumb {
          background: #ccc;
          border-radius: 3px;
        }
        .markdown-wechat-container ::-webkit-scrollbar-thumb:hover {
          background: #999;
        }
        .dark .markdown-wechat-container ::-webkit-scrollbar-thumb {
          background: #555;
        }
        .dark .markdown-wechat-container ::-webkit-scrollbar-thumb:hover {
          background: #777;
        }
        .wx-article {
          font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
          color: #1f2937;
          line-height: 1.75;
        }
        .dark .wx-article {
          color: #d1d5db;
        }
        .wx-article h1 {
          font-size: 1.9rem;
          margin: 0 0 1rem 0;
          color: #0b2a4a;
          border-bottom: 2px solid #bae6fd;
          padding-bottom: 0.6rem;
        }
        .wx-article h2 {
          font-size: 1.4rem;
          margin: 1.6rem 0 0.8rem;
          color: #0f4c81;
          padding-left: 14px;
          position: relative;
        }
        .wx-article h2::before {
          content: "";
          position: absolute;
          left: 0;
          top: 6px;
          width: 6px;
          height: 18px;
          background: linear-gradient(180deg, #38bdf8, #0ea5e9);
          border-radius: 999px;
        }
        .wx-article h3 {
          font-size: 1.15rem;
          margin: 1.2rem 0 0.6rem;
          color: #115e9b;
        }
        .wx-article h4 {
          font-size: 1rem;
          margin: 1rem 0 0.5rem;
          color: #1e40af;
        }
        .wx-article p {
          margin: 0 0 1rem;
          color: #334155;
        }
        .wx-article strong {
          color: #0f4c81;
        }
        .wx-article em,
        .wx-article i {
          font-style: italic;
          color: #0f4c81;
        }
        .wx-article a {
          color: #0ea5e9;
          text-decoration: none;
          border-bottom: 1px dashed rgba(14, 165, 233, 0.5);
        }
        .wx-article ul, .wx-article ol {
          margin: 0 0 1rem 1.2rem;
        }
        .wx-article li {
          margin: 0.4rem 0;
        }
        .wx-article blockquote {
          margin: 1.2rem 0;
          padding: 0.8rem 1rem;
          background: #f0f9ff;
          border-left: 4px solid #38bdf8;
          color: #475569;
        }
        .wx-article code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 6px;
          font-family: "Courier New", monospace;
          font-size: 0.92em;
        }
        .wx-article pre {
          background: #0b1a2b;
          color: #e2f2ff;
          padding: 16px;
          border-radius: 12px;
          overflow-x: auto;
          margin: 1rem 0;
          border: 1px solid rgba(56, 189, 248, 0.2);
        }
        .wx-article pre code {
          background: transparent;
          padding: 0;
          color: inherit;
        }
        .wx-article img {
          max-width: 100%;
          border-radius: 12px;
          margin: 1rem 0;
        }
        .wx-article table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
          font-size: 0.95rem;
        }
        .wx-article th, .wx-article td {
          border: 1px solid #e2e8f0;
          padding: 8px 12px;
          text-align: left;
        }
        .wx-article th {
          background: #f1f5f9;
        }
        .wx-article hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 1.8rem 0;
        }
      `}</style>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <FileCode className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Markdown 转公众号排版</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors" title="打开文件">
            <Upload className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </label>
          <button onClick={handleSave} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="保存">
            <Save className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button onClick={handleFileDownload} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="导出 Markdown">
            <Download className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button onClick={handleExportPDF} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="导出 PDF">
            <FileDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button onClick={handleInsertTemplate} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="插入模板">
            <LayoutTemplate className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button onClick={copyWechatHtml} className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm">
            <Copy className="w-4 h-4" />
            复制公众号内容
          </button>
          <button onClick={copyPreviewHtml} className="flex items-center gap-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm">
            <FileText className="w-4 h-4" />
            复制 HTML
          </button>
          <button onClick={handleClear} className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors" title="清空">
            <Trash2 className="w-5 h-5 text-red-500" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setActiveTab('edit')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'edit' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
          <Edit3 className="w-4 h-4" />
          编辑
        </button>
        <button onClick={() => setActiveTab('preview')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'preview' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
          <Eye className="w-4 h-4" />
          预览
        </button>
        <button onClick={() => setActiveTab('split')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'split' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
          <Eye className="w-4 h-4" />
          分屏查看
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex">
        {activeTab === 'edit' && (
          <div className="w-full flex flex-col">
            <textarea
              ref={textareaRef}
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              onContextMenu={handleContextMenu}
              className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
              placeholder="在此输入你的 Markdown 内容..."
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="w-full overflow-auto">
            <div ref={previewRef} className="p-6 bg-white dark:bg-gray-900">
              <div className="wx-article" dangerouslySetInnerHTML={{ __html: markdown ? parseMarkdown(markdown) : '<p class="text-gray-400">输入 Markdown 内容预览效果...</p>' }} />
            </div>
          </div>
        )}

        {activeTab === 'split' && (
          <>
            <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Markdown 输入</span>
              </div>
              <textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                onContextMenu={handleContextMenu}
                className="flex-1 w-full p-4 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm resize-none outline-none"
                placeholder="在此输入你的 Markdown 内容..."
              />
            </div>
            <div className="w-1/2 overflow-auto">
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">公众号排版预览</span>
              </div>
              <div ref={previewRef} className="p-4 bg-white dark:bg-gray-900">
                <div className="wx-article" dangerouslySetInnerHTML={{ __html: markdown ? parseMarkdown(markdown) : '<p class="text-gray-400">输入 Markdown 内容预览效果...</p>' }} />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <span>{fileName}</span>
        <span>{markdown.split('\n').length} 行 | {markdown.length} 字符</span>
      </div>

      <ContextMenu isOpen={isContextMenuOpen} x={contextMenuX} y={contextMenuY} items={contextMenuItems} onClose={() => setIsContextMenuOpen(false)} />
    </div>
  );
};

export default MarkdownToWechatPage;