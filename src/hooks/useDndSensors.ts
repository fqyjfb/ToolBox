import { useSensor, useSensors, PointerSensor, KeyboardSensor } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export const useDndSensors = (withKeyboardCoords: boolean = true) => {
  return useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, withKeyboardCoords ? {
      coordinateGetter: sortableKeyboardCoordinates,
    } : undefined)
  );
};