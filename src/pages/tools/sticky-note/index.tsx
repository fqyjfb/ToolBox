import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../../hooks/useConfirmDialog';
import { useToastStore } from '../../../store/toastStore';
import { createStickyClientId, stickyNotesService } from '../../../services/stickyNotesService';
import type { StickyNote } from '../../../types/stickyNote';
import { StickyNoteList } from './StickyNoteList';
import { StickyNoteEditor } from './StickyNoteEditor';
import './StickyNote.css';

type FilterMode = 'all' | 'pinned';

const StickyNotePage = () => {
  const addToast = useToastStore((state) => state.addToast);
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [captureSignal, setCaptureSignal] = useState(0);

  const clientIdRef = useRef(createStickyClientId());
  const focusRef = useRef<string | null>(focusId);
  const handledFocusRef = useRef<string | null>(null);
  focusRef.current = focusId;

  const { confirmDialog, handleOpenConfirmDialog, handleCloseConfirmDialog } = useConfirmDialog();

  const loadNotes = useCallback(async (preferredId?: string) => {
    const result = await stickyNotesService.list();
    setLoading(false);
    if (!result.ok || !result.data) {
      addToast({ type: 'error', message: result.error || '读取便签失败' });
      return;
    }
    const list = result.data;
    setNotes(list);
    setSelectedId((previous) => {
      const target = preferredId || previous || focusRef.current;
      if (target && list.some((note) => note.id === target)) return target;
      return list[0]?.id ?? null;
    });
  }, [addToast]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // 其他窗口（钉桌面窗口）读写后同步列表
  useEffect(() => stickyNotesService.onChanged(() => {
    void loadNotes();
  }), [loadNotes]);

  // 托盘「新建便签」：聚焦快速录入框
  useEffect(() => {
    const register = window.electron?.onOpenAddSticky;
    if (!register) return;
    register(() => setCaptureSignal((value) => value + 1));
    return () => register(() => {});
  }, []);

  // 「在应用中打开」带 focus 参数：只在参数变化时切换选中，避免刷新列表时抢回选择
  useEffect(() => {
    if (!focusId || focusId === handledFocusRef.current) return;
    if (!notes.some((note) => note.id === focusId)) return;
    handledFocusRef.current = focusId;
    setSelectedId(focusId);
  }, [focusId, notes]);

  const visibleNotes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return notes.filter((note) => {
      if (filter === 'pinned' && !note.pinned) return false;
      if (!keyword) return true;
      return note.title.toLowerCase().includes(keyword)
        || note.content.toLowerCase().includes(keyword);
    });
  }, [notes, query, filter]);

  const pinnedCount = useMemo(() => notes.filter((note) => note.pinned).length, [notes]);
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) || null,
    [notes, selectedId],
  );

  const handleQuickCreate = async (content: string) => {
    setCreating(true);
    const result = await stickyNotesService.create({ content });
    setCreating(false);
    if (!result.ok || !result.data) {
      addToast({ type: 'error', message: result.error || '创建便签失败' });
      return false;
    }
    addToast({ type: 'success', message: '已存为便签' });
    setFilter('all');
    setQuery('');
    await loadNotes(result.data.id);
    return true;
  };

  const handleUpdated = useCallback((updated: StickyNote) => {
    setNotes((previous) => previous.map((note) => (note.id === updated.id ? updated : note)));
  }, []);

  const handleTogglePin = async (note: StickyNote) => {
    const result = await stickyNotesService.setPinned(note.id, !note.pinned);
    if (!result.ok || !result.data) {
      addToast({ type: 'error', message: result.error || '更新钉住状态失败' });
      return;
    }
    handleUpdated(result.data);
    addToast({ type: 'success', message: note.pinned ? '已取消钉住' : '已钉在桌面' });
  };

  const handleDelete = (note: StickyNote) => {
    handleOpenConfirmDialog(
      '删除便签',
      `确定删除「${note.title}」吗？删除后无法恢复。`,
      () => {
        void (async () => {
          // 先取消选中，让编辑器卸载并完成兜底保存（此时便签仍存在）
          setSelectedId(null);
          // 延迟一帧确保编辑器卸载完成
          await new Promise((resolve) => setTimeout(resolve, 0));
          const result = await stickyNotesService.remove(note.id);
          if (!result.ok) {
            addToast({ type: 'error', message: result.error || '删除便签失败' });
            return;
          }
          addToast({ type: 'success', message: '便签已删除' });
          await loadNotes();
        })();
      },
    );
  };

  const handleCopy = async (note: StickyNote) => {
    try {
      await navigator.clipboard.writeText(note.content);
      addToast({ type: 'success', message: '内容已复制' });
    } catch {
      addToast({ type: 'error', message: '复制失败，请手动选择文本' });
    }
  };

  return (
    <div className="sticky-page">
      <header className="sticky-toolbar">
        <h2 className="sticky-title">便签</h2>
        <span className="sticky-count">共 {notes.length} 条</span>
      </header>

      <div className="sticky-layout">
        <StickyNoteList
          notes={visibleNotes}
          totalCount={notes.length}
          pinnedCount={pinnedCount}
          selectedId={selectedId}
          query={query}
          filter={filter}
          captureSignal={captureSignal}
          creating={creating}
          onQueryChange={setQuery}
          onFilterChange={setFilter}
          onSelect={setSelectedId}
          onQuickCreate={handleQuickCreate}
          onTogglePin={(note) => void handleTogglePin(note)}
          onCopy={(note) => void handleCopy(note)}
          onDelete={handleDelete}
        />

        {selectedNote ? (
          <StickyNoteEditor
            key={selectedNote.id}
            note={selectedNote}
            clientId={clientIdRef.current}
            onSaved={handleUpdated}
          />
        ) : (
          <div className="sticky-editor">
            <div className="sticky-empty">
              {loading ? '正在读取便签…' : '选择左侧便签查看内容'}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant="danger"
        confirmText="删除"
        onConfirm={confirmDialog.onConfirm}
        onClose={handleCloseConfirmDialog}
      />
    </div>
  );
};

export default StickyNotePage;
