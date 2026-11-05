// useNotesAutoSave —— NotesEditor 保存链路（从 NotesEditor.tsx 原样提取，行为完全一致）
// 职责：唯一落盘入口 persist、自动保存（防抖 + 最长等待）、切文件落盘/草稿兜底、Ctrl+S、保存过程态。
// 编辑态内容变更（handleContentChange）与草稿调度仍留在组件，避免把 UI 镜像逻辑一并卷入。

import { useState, useEffect, useCallback, useRef } from 'react';
import { FileTreeNode } from '@/hooks/useNotes';
import { useToastStore } from '@/store/toastStore';
import type { UseNotesDraftsReturn } from './useNotesDrafts';
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS } from '../constants/limits';
import { useNotesTabsStore } from '../../../../store/notesTabsStore';

interface UseNotesAutoSaveParams {
  selectedFile: FileTreeNode | null;
  content: string;
  /** 磁盘基线：脏态 = content !== savedContent（派生，组件内不再维护 isDirty state） */
  savedContent: string;
  onSave: (content: string, path?: string) => Promise<boolean>;
  /** 草稿写入器：页面级唯一实例，避免多个实例各持一套定时器 */
  drafts: UseNotesDraftsReturn;
  /** 自动保存暂停（冲突裁决 / 草稿恢复期间）：只停写文件，草稿照写 */
  autoSavePaused: boolean;
}

interface UseNotesAutoSaveReturn {
  /** 手动保存（按钮 / Ctrl+S / 编辑器 onSave）：clean 态只提示、不写盘 */
  handleSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  /** 当前文件最近一次成功落盘时间（按文件记录，切走再切回仍可见） */
  savedAt: number | null;
  /** 脏态 = content !== savedContent（唯一来源，组件内直接复用） */
  isDirty: boolean;
}

export function useNotesAutoSave({
  selectedFile,
  content,
  savedContent,
  onSave,
  drafts,
  autoSavePaused,
}: UseNotesAutoSaveParams): UseNotesAutoSaveReturn {
  const addToast = useToastStore((state) => state.addToast);
  // 脏态只由"读盘 / 落盘成功"推进，组件内不允许再写
  const isDirty = content !== savedContent;
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // 保存时间按文件记录：切走再切回仍能看到"上次保存于"，且不受异步保存完成时机影响
  const [savedAtByPath, setSavedAtByPath] = useState<Record<string, number>>({});
  const savedAt = selectedFile?.path ? savedAtByPath[selectedFile.path] ?? null : null;

  // 保存链路（唯一入口 persist）的过程态与守卫
  const contentRef = useRef(content);
  contentRef.current = content; // 异步回调始终读最新内容，不用闭包旧值
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentFilePathRef = useRef<string | null>(null);
  const savingRef = useRef(false); // 互斥：state 有提交延迟，判重入必须用 ref
  const savingPathRef = useRef<string | null>(null); // 正在保存哪个文件（切文件时判断"内容是否即将落盘"）
  const pendingRef = useRef(false); // 合流：保存期间又来的请求，完成后再补一次
  // 仅用于"同一文件同一内容不重复写盘"，不参与脏态判定（脏态仍是 content !== savedContent）
  const lastSavedRef = useRef<{ path: string; payload: string } | null>(null);
  const dirtySinceRef = useRef<number | null>(null); // 变脏起点，用于最长等待

  // 切走文件的兜底快照：本 effect 晚于"切文件 effect 的 cleanup"重跑，
  // 所以 cleanup 里读到的仍是旧文件最后一次渲染的内容（contentRef 已在 render 期被新值覆盖，不能用）。
  const flushSnapshotRef = useRef<{ content: string; dirty: boolean }>({ content, dirty: isDirty });
  useEffect(() => {
    flushSnapshotRef.current = { content, dirty: isDirty };
  }, [content, isDirty]);

  /**
   * 唯一落盘入口：自动保存 / 按钮 / Ctrl+S / 切文件 / 冲突 keep-mine 全部走这里。
   *
   * - 互斥 + 合流：保存期间的新输入不丢，完成后立刻补写一次
   * - 路径守卫：目标路径显式传入，父级只回灌"当前打开文件"的内容
   * - 基线快照：落盘的是发起时的 payload，不是完成时的 content（否则保存期间的输入会被误标为已保存）
   * - finally：任何异常都不会把 UI 卡在"保存中"
   */
  const persist = useCallback(
    async (
      reason: 'manual' | 'auto' | 'switch' | 'conflict',
      targetPath?: string,
      payloadOverride?: string
    ): Promise<boolean> => {
      const path = targetPath ?? selectedFile?.path;
      if (!path) return false;
      if (savingRef.current) {
        pendingRef.current = true;
        return false;
      }

      savingRef.current = true;
      savingPathRef.current = path;
      setIsSaving(true);
      setSaveError(null);

      // 显式指定内容的保存（切文件 / 冲突）只写一次，绝不在循环里补写
      const singleShot = payloadOverride !== undefined;
      let nextPayload = payloadOverride;
      try {
        let ok = true;
        do {
          pendingRef.current = false;
          // 补写只允许"目标文件仍是当前打开文件"：否则会把新文件的内容写进旧文件
          const payload =
            nextPayload ?? (path === currentFilePathRef.current ? contentRef.current : null);
          nextPayload = undefined; // 只对第一次生效：循环补写必须取最新内容
          if (payload === null) break;
          // 同一文件同一内容不重复写盘（clean 态点击 / Ctrl+S 连按），mtime 不抖动
          if (lastSavedRef.current?.path === path && lastSavedRef.current.payload === payload) break;

          ok = await onSave(payload, path);
          if (!ok) {
            setSaveError('保存失败');
            return false;
          }
          lastSavedRef.current = { path, payload };
          // 收尾都是 path 级别的：即使期间切走了，也该清理该文件的草稿与脏点
          setSavedAtByPath((m) => ({ ...m, [path]: Date.now() }));
          void drafts.deleteDraftNow(path).catch(() => undefined);
          useNotesTabsStore.getState().setDirty(path, false);
        } while (!singleShot && pendingRef.current);
        return ok;
      } catch (err) {
        console.error('[NotesEditor] 保存失败', reason, err);
        setSaveError('保存失败');
        return false;
      } finally {
        savingRef.current = false;
        savingPathRef.current = null;
        setIsSaving(false);
      }
    },
    [drafts, onSave, selectedFile?.path]
  );

  // 切文件：先尝试落盘（比草稿可靠），失败才退回草稿兜底
  useEffect(() => {
    const prevPath = currentFilePathRef.current;
    const nextPath = selectedFile?.path ?? null;
    currentFilePathRef.current = nextPath;
    setSaveError(null); // 错误态属于上一个文件，切走后不能继续挂在标题栏上

    return () => {
      if (!prevPath || prevPath === nextPath) return;
      const snap = flushSnapshotRef.current;
      if (!snap.dirty) return;
      // 该文件正在保存：内容即将落盘，不必再写一份草稿（否则会留下与磁盘一致的冗余草稿）
      if (savingPathRef.current === prevPath) return;
      void persist('switch', prevPath, snap.content).then((ok) => {
        if (!ok) void drafts.flushNow(prevPath, snap.content).catch(() => undefined);
      });
    };
  }, [selectedFile?.path, persist, drafts]);

  // 自动保存：2s 防抖 + 30s 最长等待；冲突 / 恢复弹窗期间暂停写文件（草稿照写）
  useEffect(() => {
    if (!isDirty || !selectedFile || autoSavePaused) {
      if (!isDirty) dirtySinceRef.current = null;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    const now = Date.now();
    if (dirtySinceRef.current === null) dirtySinceRef.current = now;
    const elapsed = now - dirtySinceRef.current;
    // 连续输入时防抖会被无限重置，必须有上限，否则一次崩溃丢整段
    const delay = Math.max(0, Math.min(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS - elapsed));

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      void persist('auto');
    }, delay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [autoSavePaused, isDirty, persist, selectedFile]);

  // 手动保存（按钮 / Ctrl+S）：clean 态只提示、不写盘（避免 mtime 抖动与同步盘噪音）
  const handleSave = useCallback(() => {
    if (!selectedFile) return;
    if (!isDirty) {
      addToast({ type: 'info', message: '内容已是最新' });
      return;
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    void persist('manual');
  }, [addToast, isDirty, persist, selectedFile]);

  // Ctrl+S 统一注册一次：编辑器内部不再各自挂监听，避免一次按键触发两次保存
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      const type = selectedFile?.fileType;
      if (type !== 'md' && type !== 'txt' && type !== 'html' && type !== 'json') return;
      event.preventDefault();
      handleSave();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave, selectedFile?.fileType]);

  return { handleSave, isSaving, saveError, savedAt, isDirty };
}
