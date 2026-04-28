import { useState, useCallback } from 'react';

export interface ContextMenuItem<T> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: (item: T) => void;
}

export interface ContextMenuState<T> {
  isOpen: boolean;
  x: number;
  y: number;
  targetItem: T | null;
  items: ContextMenuItem<T>[];
}

export const useContextMenu = <T>() => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetItem: T;
    items: ContextMenuItem<T>[];
  } | null>(null);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    targetItem: T,
    items: ContextMenuItem<T>[]
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetItem,
      items,
    });
  }, []);

  const handleClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleItemClick = useCallback((onClick: (item: T) => void) => {
    if (contextMenu) {
      onClick(contextMenu.targetItem);
    }
    setContextMenu(null);
  }, [contextMenu]);

  return {
    contextMenu,
    handleContextMenu,
    handleClose,
    handleItemClick,
  };
};