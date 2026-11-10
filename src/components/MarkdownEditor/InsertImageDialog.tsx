import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Link2, Upload } from 'lucide-react';
import Modal from '@/components/ui/Modal';

/** 图片来源页签 */
type ImageSourceTab = 'local' | 'url';

export interface InsertImageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 选中本地图片（可多选）后回调；对话框自行关闭 */
  onPickFiles: (files: File[]) => void;
  /** 确认网络图片地址后回调；对话框自行关闭 */
  onSubmitUrl: (url: string) => void;
}

const TAB_CLASS =
  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md border border-solid transition-colors';

/**
 * 插入图片弹窗：本地文件 / 网络地址两个入口。
 *
 * 只负责收集**输入**，落盘与写块由调用方处理（上传由宿主注入的 `onUpload` 完成），
 * 避免编辑器内出现第二套存储路径（G15）。
 */
export function InsertImageDialog({
  isOpen,
  onClose,
  onPickFiles,
  onSubmitUrl,
}: InsertImageDialogProps) {
  const [tab, setTab] = useState<ImageSourceTab>('local');
  const [url, setUrl] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  // 每次打开都回到「本地文件」并清空上次地址，避免残留草稿被误提交
  useEffect(() => {
    if (!isOpen) return;
    setTab('local');
    setUrl('');
  }, [isOpen]);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      const files = Array.from(list ?? []).filter((file) =>
        file.type.startsWith('image/'),
      );
      if (files.length === 0) return;
      onPickFiles(files);
      onClose();
    },
    [onClose, onPickFiles],
  );

  const handleConfirm = useCallback(() => {
    const value = url.trim();
    if (!value) return;
    onSubmitUrl(value);
    onClose();
  }, [onClose, onSubmitUrl, url]);

  const localActive = tab === 'local';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="插入图片"
      size="sm"
      confirmText="插入"
      cancelText="取消"
      onConfirm={handleConfirm}
      showConfirm={!localActive}
      confirmDisabled={localActive || !url.trim()}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="图片来源">
          <button
            type="button"
            role="tab"
            aria-selected={localActive}
            className={`${TAB_CLASS} ${
              localActive
                ? 'border-[var(--color-accent)] text-content-primary'
                : 'border-[var(--color-border)] text-content-secondary hover:text-content-primary'
            }`}
            onClick={() => setTab('local')}
          >
            <Upload size={16} />
            本地文件
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!localActive}
            className={`${TAB_CLASS} ${
              localActive
                ? 'border-[var(--color-border)] text-content-secondary hover:text-content-primary'
                : 'border-[var(--color-accent)] text-content-primary'
            }`}
            onClick={() => setTab('url')}
          >
            <Link2 size={16} />
            网络地址
          </button>
        </div>

        {localActive ? (
          <div>
            <button
              type="button"
              className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-md border border-dashed border-[var(--color-border)] text-content-secondary transition-colors hover:border-[var(--color-accent)] hover:text-content-primary"
              onClick={() => fileRef.current?.click()}
            >
              <ImageIcon size={20} />
              <span className="text-sm">选择本地图片</span>
              <span className="text-xs">支持 PNG / JPG / GIF / WebP，可多选</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                handleFiles(event.target.files);
                // 清空后再次选择同一文件才会重新触发 change
                event.target.value = '';
              }}
            />
          </div>
        ) : (
          <div>
            <label
              className="block text-xs text-content-secondary mb-1"
              htmlFor="mde-image-url"
            >
              图片地址
            </label>
            <input
              id="mde-image-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/picture.png"
              className="w-full px-3 py-1.5 text-sm rounded-md border border-solid border-[var(--color-border)] bg-[var(--ct-bg-primary,var(--color-bg-primary))] text-[var(--mde-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

export default InsertImageDialog;
