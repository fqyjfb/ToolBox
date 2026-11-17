import { useCallback, useEffect, useRef, useState } from 'react';
import type { StickyNote, StickyNoteColor } from '../../../types/stickyNote';
import { stickyNotesService } from '../../../services/stickyNotesService';
import { STICKY_NOTE_COLORS } from './stickyNoteColors';

const SAVE_DELAY = 500;

interface StickyNoteEditorProps {
  note: StickyNote;
  clientId: string;
  onSaved: (note: StickyNote) => void;
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const formatClock = () =>
  new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

export const StickyNoteEditor = ({
  note,
  clientId,
  onSaved,
}: StickyNoteEditorProps) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState<StickyNoteColor>(note.color);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorText, setErrorText] = useState('');
  const [savedAt, setSavedAt] = useState('');

  const savedRef = useRef({ title: note.title, content: note.content, color: note.color });
  const latestRef = useRef({ title: note.title, content: note.content, color: note.color });

  useEffect(() => {
    latestRef.current = { title, content, color };
  }, [title, content, color]);

  // 便签墙右键改色后同步到主窗口（本地尚未保存的取色会被最新值覆盖）
  useEffect(() => {
    setColor(note.color);
  }, [note.color]);

  const save = useCallback(async (next: { title: string; content: string; color: StickyNoteColor }) => {
    if (!next.content.trim()) {
      setStatus('error');
      setErrorText('内容不能为空，请补充后再保存');
      return false;
    }
    const saved = savedRef.current;
    if (next.title === saved.title && next.content === saved.content && next.color === saved.color) {
      return true;
    }

    setStatus('saving');
    setErrorText('');
    const result = await stickyNotesService.update({
      id: note.id,
      title: next.title,
      content: next.content,
      color: next.color,
      clientId,
    });
    if (!result.ok || !result.data) {
      setStatus('error');
      setErrorText(result.error || '保存失败，请重试');
      return false;
    }

    // 服务端会把空标题回填为正文首行，这里保留用户输入值用于去重比较
    savedRef.current = { title: next.title, content: next.content, color: next.color };
    setStatus('saved');
    setSavedAt(formatClock());
    onSaved(result.data);
    return true;
  }, [clientId, note.id, onSaved]);

  // 500ms 防抖自动保存
  useEffect(() => {
    const saved = savedRef.current;
    if (title === saved.title && content === saved.content && color === saved.color) return;
    setStatus('dirty');
    const timer = window.setTimeout(() => {
      void save({ title, content, color });
    }, SAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [title, content, color, save]);

  // 关闭/切换便签前兜底提交
  useEffect(() => () => {
    void save(latestRef.current);
  }, [save]);

  const flush = () => {
    void save({ title, content, color });
  };

  const handleContentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      flush();
    }
  };

  const statusText = () => {
    if (status === 'saving') return '保存中…';
    if (status === 'saved') return `已保存 ${savedAt}`;
    if (status === 'dirty') return '编辑中…';
    if (status === 'error') return errorText;
    return '自动保存';
  };

  return (
    <section className="sticky-editor">
      <header className="sticky-editor-head">
        <input
          className="sticky-title-input"
          value={title}
          maxLength={100}
          placeholder="标题（留空自动取首行）"
          onChange={(event) => setTitle(event.target.value)}
          onBlur={flush}
        />
        <div className="sticky-color-group" role="group" aria-label="便签颜色">
          {STICKY_NOTE_COLORS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`sticky-color-dot sticky-color-${option.value}${color === option.value ? ' active' : ''}`}
              title={option.label}
              aria-label={`使用${option.label}`}
              onClick={() => setColor(option.value)}
            />
          ))}
        </div>
      </header>

      <textarea
        className="sticky-editor-textarea"
        value={content}
        placeholder="写点什么…（自动保存）"
        onChange={(event) => setContent(event.target.value)}
        onBlur={flush}
        onKeyDown={handleContentKeyDown}
      />

      <footer className="sticky-editor-foot">
        <span className={`sticky-status${status === 'error' ? ' error' : ''}`}>{statusText()}</span>
      </footer>
    </section>
  );
};
