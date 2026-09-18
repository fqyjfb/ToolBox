// NotesImageViewer —— 图片预览

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface NotesImageViewerProps {
  src: string;
  alt?: string;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const ZOOM_STEP = 1.12;

function clampScale(v: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}

const NotesImageViewer: React.FC<NotesImageViewerProps> = ({ src, alt }) => {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // 拖拽起点：鼠标屏幕坐标 + 当时的偏移量
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // 同时写 ref 与 state（ref 供高频事件读最新值）
  const apply = useCallback((nextScale: number, nextOffset: { x: number; y: number }) => {
    scaleRef.current = nextScale;
    offsetRef.current = nextOffset;
    setScale(nextScale);
    setOffset(nextOffset);
  }, []);

  const reset = useCallback(() => apply(1, { x: 0, y: 0 }), [apply]);

  // 切图复位（否则上一张图的缩放/偏移会带到新图上）
  useEffect(() => {
    reset();
  }, [src, reset]);

  // 原生 wheel（passive: false）。锚点数学：原点在容器中心，保持光标下的图片坐标不变 → o1 = p - (s1/s0)*(p - o0)。
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left - rect.width / 2;
      const py = e.clientY - rect.top - rect.height / 2;
      const s0 = scaleRef.current;
      const s1 = clampScale(s0 * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
      if (s1 === s0) return;
      const k = s1 / s0;
      const o0 = offsetRef.current;
      apply(s1, { x: px - k * (px - o0.x), y: py - k * (py - o0.y) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [apply]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      px: e.clientX,
      py: e.clientY,
      ox: offsetRef.current.x,
      oy: offsetRef.current.y,
    };
    setDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      apply(scaleRef.current, {
        x: drag.ox + (e.clientX - drag.px),
        y: drag.oy + (e.clientY - drag.py),
      });
    },
    [apply]
  );

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-1 min-h-0 select-none overflow-hidden bg-gray-50 dark:bg-gray-900"
      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
      title="滚轮缩放 · 按住拖拽移动 · 双击复位"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onDoubleClick={reset}
    >
      <img
        src={src}
        alt={alt || ''}
        draggable={false}
        decoding="async"
        className="m-auto max-h-full max-w-full object-contain"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          // 拖拽时去掉过渡，否则手感发飘
          transition: dragging ? 'none' : 'transform 0.05s linear',
        }}
      />
      {scale !== 1 && (
        <button
          type="button"
          onClick={reset}
          className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-1 text-[11px] text-white hover:bg-black/70 transition-colors"
          title="复位到原始大小"
        >
          {Math.round(scale * 100)}% · 复位
        </button>
      )}
    </div>
  );
};

export default NotesImageViewer;
