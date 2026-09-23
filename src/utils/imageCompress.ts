/**
 * 背景图处理：FileReader + canvas 压缩成 data URI。
 *
 * 纯渲染层实现，跨端（Web / Electron）通用，无需新增 IPC。
 * 压缩后写入 localStorage，因此需要控制在单键容量内。
 */

// localStorage 单键建议上限：origin 总配额约 5MB，需给其它业务键留空间
export const MAX_BG_IMAGE_BYTES = 3 * 1024 * 1024;

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
/** 逐级降质：先保画质，超限后自动再压，最后仍超限才判定失败 */
const QUALITY_STEPS = [0.85, 0.7, 0.55];

export type CompressFailure = 'not-image' | 'decode-failed' | 'oversize';

export interface CompressResult {
  /** 压缩成功后的 data URI；null 表示失败（见 reason） */
  dataUrl: string | null;
  /** 原始文件大小（字节） */
  rawSize: number;
  /** 最佳压缩结果的 data URI 字节数 */
  compressedSize: number;
  reason?: CompressFailure;
}

const failed = (file: File, reason: CompressFailure, compressedSize = 0): CompressResult => ({
  dataUrl: null,
  rawSize: file.size,
  compressedSize,
  reason,
});

/**
 * 把用户选择的图片压缩为 JPEG data URI：
 * 长边等比缩放到 1920×1080 以内，再按 QUALITY_STEPS 逐级降质，
 * 取第一个满足容量上限的结果；全部超限则返回 null（调用方提示用户换图）。
 */
export const compressImageToDataUrl = (file: File): Promise<CompressResult> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve(failed(file, 'not-image'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => resolve(failed(file, 'decode-failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(failed(file, 'decode-failed'));
      img.onload = () => {
        let { naturalWidth: width, naturalHeight: height } = img;
        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(failed(file, 'decode-failed'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let best = '';
        for (const quality of QUALITY_STEPS) {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          if (!best || dataUrl.length < best.length) best = dataUrl;
          if (dataUrl.length <= MAX_BG_IMAGE_BYTES) {
            resolve({ dataUrl, rawSize: file.size, compressedSize: dataUrl.length });
            return;
          }
        }
        resolve(failed(file, 'oversize', best.length));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

/** data URI 是否仍在安全容量范围内（导入配置 / 回写 store 前校验） */
export const isBgImageSizeSafe = (dataUrl: string): boolean => dataUrl.length <= MAX_BG_IMAGE_BYTES;

/** 字节数格式化为 MB 文本，用于容量提示 */
export const formatBytesToMB = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
