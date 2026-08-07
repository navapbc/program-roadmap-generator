import { closestCenter, type CollisionDetection } from '@dnd-kit/core';
import { nextOrderKey } from '@roadmap/shared';

/**
 * Given the current full sibling order (ids) and where an item was dropped
 * (via dnd-kit's arrayMove), returns the new orderKey for the moved item —
 * a fractional key between its new neighbors, so only the moved row's
 * orderKey ever changes.
 */
export function computeDroppedOrderKey(
  newIdOrder: string[],
  movedId: string,
  orderKeyById: Map<string, string>
): string {
  const index = newIdOrder.indexOf(movedId);
  const prevId = index > 0 ? newIdOrder[index - 1] : null;
  const nextId = index < newIdOrder.length - 1 ? newIdOrder[index + 1] : null;
  const prevKey = prevId ? orderKeyById.get(prevId) ?? null : null;
  const nextKey = nextId ? orderKeyById.get(nextId) ?? null : null;
  return nextOrderKey(prevKey, nextKey);
}

export type DragItemType = 'increment' | 'initiative';

export interface DragItemData {
  type: DragItemType;
  incrementId?: string;
}

/**
 * A Milestone's DndContext holds two nested levels of sortable items
 * (Increment blocks, and the Initiative rows inside each one) so they share
 * one collision-detection pass. Increment blocks are tall — they contain
 * every one of their initiatives — so plain closestCenter often measures a
 * dragged Increment as nearer to some nested Initiative row's small center
 * than to a sibling Increment's own (much larger, so further-off-center)
 * bounding box, and the drop silently resolves to the wrong type and no-ops.
 * Filtering candidates to the active item's own type before delegating to
 * closestCenter keeps Increment-vs-Increment and Initiative-vs-Initiative
 * comparisons from crossing levels.
 */
export const typeAwareClosestCenter: CollisionDetection = (args) => {
  const activeType = (args.active.data.current as DragItemData | undefined)?.type;
  const sameTypeContainers = args.droppableContainers.filter(
    (container) => (container.data.current as DragItemData | undefined)?.type === activeType
  );
  return closestCenter({ ...args, droppableContainers: sameTypeContainers });
};
