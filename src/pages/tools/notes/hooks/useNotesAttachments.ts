// useNotesAttachments —— 图片附件上传：File → 主进程落盘 → 返回 markdown 相对引用路径。
// 约束：不用 FileReader（避免 base64 峰值）；upload 引用须恒定（否则 WMarkdownEditor 会重建 Vditor）。
// 不自己 insertValue：WMarkdownEditor 拿到 url 后会自行插入，否则会插图两次。

import { useCallback, useEffect, useRef, useState } from 'react';
import { useToastStore } from '@/store/toastStore';

const FALLBACK_IMAGE_EXT = '.png';

const IMAGE_MIME_PREFIX = 'image/';

export interface UseNotesAttachmentsReturn {
  upload: (file: File) => Promise<string>;
  uploading: boolean;
}

// 按 MIME 重新拼装文件名：主进程用 path.extname 校验图片类型，继承原 name 会误判（如 'x.2026.09.14' → '.14'）。
function resolveFileName(file: File): string {
  const subtype = ((file.type || '').split('/')[1] || '').split('+')[0];
  const ext = subtype === 'jpeg' ? '.jpg' : subtype ? `.${subtype}` : FALLBACK_IMAGE_EXT;
  const stem = (file.name || '').trim().replace(/\.[^.]{1,8}$/, '').trim();
  return `${stem || `clipboard-${Date.now()}`}${ext}`;
}

export function useNotesAttachments(
  notePath: string | null | undefined
): UseNotesAttachmentsReturn {
  const addToast = useToastStore((s) => s.addToast);
  const [uploading, setUploading] = useState(false);

  // notePath 走 ref：保证 upload 的 identity 恒定
  const notePathRef = useRef<string | null>(notePath ?? null);
  useEffect(() => {
    notePathRef.current = notePath ?? null;
  }, [notePath]);

  const upload = useCallback(
    async (file: File): Promise<string> => {
      // 已提示过的分支置 true，避免 catch 里重复弹 toast
      let toasted = false;
      const fail = (message: string, type: 'warning' | 'error'): never => {
        toasted = true;
        addToast({ message, type });
        throw new Error(message);
      };

      const currentPath = notePathRef.current;
      if (!currentPath) {
        return fail('请先保存笔记后再插入图片（新建笔记还没有落盘位置）', 'warning');
      }
      if (!file.type || !file.type.startsWith(IMAGE_MIME_PREFIX)) {
        return fail('只支持插入图片文件', 'warning');
      }

      setUploading(true);
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        const res = await window.electron?.notes?.saveAttachment?.(
          currentPath,
          resolveFileName(file),
          data
        );
        if (!res?.success || !res.relativePath) {
          return fail(res?.error || '图片保存失败', 'error');
        }
        return res.relativePath;
      } catch (error) {
        if (!toasted) {
          const message = error instanceof Error ? error.message : '图片保存失败';
          addToast({ message: `图片保存失败：${message}`, type: 'error' });
        }
        throw error;
      } finally {
        setUploading(false);
      }
    },
    [addToast]
  );

  return { upload, uploading };
}
