/** NotesEditor 专用工具函数与常量（从 NotesEditor.tsx 提取，保持行为完全一致） */

// canPlayType 必须带 codecs，否则恒为 "maybe"
export const VIDEO_CODEC_PROBES: Record<string, string> = {
  mp4: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
  m4v: 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"',
  mov: 'video/mp4; codecs="avc1.42E01E"',
  webm: 'video/webm; codecs="vp8,vorbis"',
  ogv: 'video/ogg; codecs="theora,vorbis"',
  mkv: 'video/x-matroska; codecs="avc1.42E01E"',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
};

export function canPlayVideoInApp(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1).toLowerCase();
  const probe = VIDEO_CODEC_PROBES[ext];
  if (!probe) return false;
  try {
    return document.createElement('video').canPlayType(probe) !== '';
  } catch {
    return false;
  }
}

// 超限文件不进 <video>，交给系统播放器
export const MAX_INLINE_VIDEO_BYTES = 500 * 1024 * 1024;

// 文件名拆分为「主名 + 后缀」：重命名时只编辑主名，后缀单独固定展示并提交，
// 避免双击编辑时误删 .md 之类后缀（删掉会改变文件类型、图标与解析方式）。
// 无后缀或点开头的文件（.gitignore 等）整体视为主名，不给空主名。
export function splitFileName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot) };
}

// 保存时间：同一天只显示 HH:mm，跨天补上日期；不显示"相对时间"（否则需要常驻定时器刷新）
export function formatSavedAt(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return new Date().toDateString() === d.toDateString()
    ? ` · ${hm}`
    : ` · ${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

export type VideoPlayback = { mode: 'checking' } | { mode: 'play' } | { mode: 'external'; notice: string };
