import { useCallback, useState } from 'react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

const NOOP = () => {};

const INITIAL_STATE: ConfirmDialogState = {
  isOpen: false,
  title: '',
  message: '',
  onConfirm: NOOP,
};

/**
 * 通用「二次确认弹窗」状态。
 *
 * 过去 13 个页面各自声明一份 confirmDialog state + 开关回调，结构完全一致。
 * 此处返回的字段名与原有命名保持一致（handleOpenConfirmDialog / handleCloseConfirmDialog），
 * 调用方只需删掉本地定义、改为调用本 hook，JSX 与依赖数组无需改动。
 *
 * @param onOpen 打开弹窗时的附加副作用（多数页面会在此关闭右键菜单）。
 *               传入的回调请用 useCallback 包裹，否则 handleOpenConfirmDialog 会每次渲染换新引用。
 */
export const useConfirmDialog = (onOpen?: () => void) => {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>(INITIAL_STATE);

  const handleOpenConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
    onOpen?.();
  }, [onOpen]);

  const handleCloseConfirmDialog = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    confirmDialog,
    handleOpenConfirmDialog,
    handleCloseConfirmDialog,
  };
};
