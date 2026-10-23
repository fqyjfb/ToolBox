import React, { useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';

interface SortableCardProps {
  /** 卡片在 DndContext 中的唯一 id */
  id: string;
  /** 左上角所在列（0-based 网格单元） */
  col: number;
  /** 左上角所在行（0-based 网格单元） */
  row: number;
  /** 占据的列数（已按当前网格列数收敛） */
  colSpan: number;
  /** 占据的行数 */
  rowSpan: number;
  children: React.ReactNode;
}

/**
 * 首页统一网格里的可拖拽卡片壳：负责所在网格单元、拖拽状态与重排动画的图层。
 *
 * 卡片位置由显式的网格坐标决定（坐标来自 homeCardLayout），因此可以自由排布并
 * 保留空洞。拖拽时直接按预览布局渲染（所见即所得），松手才提交坐标。重排的位移
 * 动画由外层（Home）以 FLIP 方式写在这一层的 style 上 —— 网格单元自身始终保持
 * 无 transform，位置读取才是准确的。
 */
const SortableCard: React.FC<SortableCardProps> = ({ id, col, row, colSpan, rowSpan, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

  // 本次按下是否真的拖动过：拖拽结束后浏览器仍会补发 click，需要吞掉它，
  // 否则拖完工具卡片会立刻跳转到工具页
  const draggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) draggedRef.current = true;
  }, [isDragging]);

  // listeners 里带了 PointerSensor 的 onPointerDown，必须手动串联而不是覆盖
  const sensorPointerDown = listeners?.onPointerDown as ((event: React.PointerEvent) => void) | undefined;

  return (
    <div
      ref={setNodeRef}
      data-card-id={id}
      style={{ gridColumn: `${col + 1} / span ${colSpan}`, gridRow: `${row + 1} / span ${rowSpan}` }}
      className={isDragging ? 'home-sortable home-sortable--dragging' : 'home-sortable'}
      {...attributes}
      {...listeners}
      onPointerDown={(event) => {
        draggedRef.current = false;
        sensorPointerDown?.(event);
      }}
      onClickCapture={(event) => {
        if (!draggedRef.current) return;
        draggedRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div className="home-sortable__inner">{children}</div>
    </div>
  );
};

export default SortableCard;
