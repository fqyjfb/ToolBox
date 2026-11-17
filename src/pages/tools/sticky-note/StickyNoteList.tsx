import { useEffect, useRef, useState } from 'react';
import { Copy, Pin, PinOff, Search, Trash2 } from 'lucide-react';
import type { StickyNote } from '../../../types/stickyNote';
import ContextMenu from '../../../components/ui/ContextMenu';

type FilterMode = 'all' | 'pinned';

interface StickyNoteListProps {
  notes: StickyNote[];
  totalCount: number;
  pinnedCount: number;
  selectedId: string | null;
  query: string;
  filter: FilterMode;
  captureSignal: number;
  creating: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: FilterMode) => void;
  onSelect: (id: string) => void;
  onQuickCreate: (content: string) => Promise<boolean>;
  onTogglePin: (note: StickyNote) => void;
  onCopy: (note: StickyNote) => void;
  onDelete: (note: StickyNote) => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const StickyNoteList = ({
  notes,
  totalCount,
  pinnedCount,
  selectedId,
  query,
  filter,
  captureSignal,
  creating,
  onQueryChange,
  onFilterChange,
  onSelect,
  onQuickCreate,
  onTogglePin,
  onCopy,
  onDelete,
}: StickyNoteListProps) => {
  const [draft, setDraft] = useState('');
  const captureRef = useRef<HTMLTextAreaElement>(null);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    note: StickyNote | null;
  }>({ isOpen: false, x: 0, y: 0, note: null });

  const closeContextMenu = () => {
    setContextMenu({ isOpen: false, x: 0, y: 0, note: null });
  };

  useEffect(() => {
    if (captureSignal <= 0) return;
    captureRef.current?.focus();
  }, [captureSignal]);

  const submit = async () => {
    const content = draft.trim();
    if (!content || creating) return;
    const ok = await onQuickCreate(content);
    if (ok) {
      setDraft('');
      captureRef.current?.focus();
    }
  };

  return (
    <aside className="sticky-sidebar">
      <div className="sticky-capture">
        <textarea
          ref={captureRef}
          value={draft}
          rows={3}
          placeholder="随手记一条…（Ctrl+Enter 保存）"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <div className="sticky-capture-footer">
          <span className="sticky-hint">自动保存到本地</span>
          <button
            type="button"
            className="sticky-primary-btn"
            disabled={creating || !draft.trim()}
            onClick={() => void submit()}
          >
            {creating ? '保存中…' : '存便签'}
          </button>
        </div>
      </div>

      <div className="sticky-search">
        <Search className="sticky-search-icon" size={16} />
        <input
          value={query}
          type="search"
          placeholder="搜索标题或内容"
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="sticky-filter-group">
        <button
          type="button"
          className={`sticky-filter${filter === 'all' ? ' active' : ''}`}
          onClick={() => onFilterChange('all')}
        >
          全部 {totalCount}
        </button>
        <button
          type="button"
          className={`sticky-filter${filter === 'pinned' ? ' active' : ''}`}
          onClick={() => onFilterChange('pinned')}
        >
          已钉住 {pinnedCount}
        </button>
      </div>

      <div className="sticky-list">
        {notes.length === 0 ? (
          <div className="sticky-empty">
            {totalCount === 0 ? '还没有便签，先写下第一条吧' : '没有匹配的便签'}
          </div>
        ) : (
          notes.map((note) => (
            <button
              key={note.id}
              type="button"
              className={`sticky-card${note.id === selectedId ? ' active' : ''}`}
              onClick={() => onSelect(note.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelect(note.id);
                setContextMenu({
                  isOpen: true,
                  x: event.clientX,
                  y: event.clientY,
                  note,
                });
              }}
            >
              <span className="sticky-card-head">
                <span className="sticky-card-title">{note.title}</span>
                {note.pinned && <Pin size={14} className="sticky-pin-mark" />}
              </span>
              <span className="sticky-card-preview">{note.content}</span>
              <span className="sticky-card-meta">{formatTime(note.updatedAt)}</span>
            </button>
          ))
        )}
      </div>

      {/* 便签右键菜单 */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        items={[
          {
            id: 'pin',
            label: contextMenu.note?.pinned ? '取消钉住' : '钉在桌面',
            icon: contextMenu.note?.pinned ? <PinOff size={16} /> : <Pin size={16} />,
            onClick: () => {
              if (contextMenu.note) onTogglePin(contextMenu.note);
            },
          },
          {
            id: 'copy',
            label: '复制内容',
            icon: <Copy size={16} />,
            onClick: () => {
              if (contextMenu.note) onCopy(contextMenu.note);
            },
          },
          { id: 'divider', divider: true },
          {
            id: 'delete',
            label: '删除便签',
            icon: <Trash2 size={16} />,
            className: 'danger',
            onClick: () => {
              if (contextMenu.note) onDelete(contextMenu.note);
            },
          },
        ]}
        onClose={closeContextMenu}
      />
    </aside>
  );
};
