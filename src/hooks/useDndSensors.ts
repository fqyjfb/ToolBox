import { useSensor, useSensors, PointerSensor, KeyboardSensor, type KeyboardCoordinateGetter } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/**
 * 统一的拖拽传感器。
 *
 * @param coordinateGetter 键盘拖拽的坐标换算：默认走 sortable 的「下一个投放目标」，
 *   适用于线性排序（侧边栏 / 分类条等）；传 `false` 关闭键盘拖拽。
 *   自由网格布局（首页）传自定义的按格步长版本。
 */
export const useDndSensors = (coordinateGetter?: KeyboardCoordinateGetter | false) => {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, coordinateGetter === false
      ? undefined
      : { coordinateGetter: coordinateGetter ?? sortableKeyboardCoordinates })
  );
};
