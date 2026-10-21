import React, { useCallback, useEffect, useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';

interface SortableCardProps {
  /** 卡片在 DndContext 中的唯一 id（同时作为拖拽源与投放目标） */
  id: string;
  /** 占据的列数（已按当前网格列数收敛） */
  colSpan: number;
  /** 占据的行数 */
  rowSpan: number;
  children: React.ReactNode;
}

/**
 * 首页统一网格里的可拖拽卡片壳：负责 span、拖拽状态与重排动画的图层。
 *
 * 拖拽时直接按预览顺序渲染（所见即所得），松手才提交顺序。重排的位移动画由外层
 * （Home）以 FLIP 方式写在这一层的 style 上 —— 网格单元自身始终保持无 transform，
 * 命中判定才能读到准确位置。
 */
const SortableCard: React.FC<SortableCardProps> = ({ id, colSpan, rowSpan, children }) => {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef } = useDroppable({ id });

  // 本次按下是否真的拖动过：拖拽结束后浏览器仍会补发 click，需要吞掉它，
  // 否则拖完工具卡片会立刻跳转到工具页
  const draggedRef = useRef(false);
  useEffect(() => {
    if (isDragging) draggedRef.current = true;
  }, [isDragging]);

  // dnd-kit 的两个 ref setter 均为稳定引用，合并后挂到同一个节点
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef]
  );

  // listeners 里带了 PointerSensor 的 onPointerDown，必须手动串联而不是覆盖
  const sensorPointerDown = listeners?.onPointerDown as ((event: React.PointerEvent) => void) | undefined;

  return (
    <div
      ref={setRefs}
      data-card-id={id}
      style={{ gridColumn: `span ${colSpan}`, gridRow: `span ${rowSpan}` }}
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
