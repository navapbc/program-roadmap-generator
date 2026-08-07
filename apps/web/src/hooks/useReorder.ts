import { arrayMove } from '@dnd-kit/sortable';
import { computeDroppedOrderKey } from '../lib/dnd.js';
import { trpc } from '../trpc.js';

/**
 * Reordering an Increment as a block only ever writes Increment.orderKey —
 * it never touches any Initiative row — so nested initiative order can't be
 * disturbed by this hook, by construction (see packages/shared/orderKey.ts).
 */
export function useReorder(projectId: string) {
  const utils = trpc.useUtils();
  const reorderIncrementMutation = trpc.increment.reorder.useMutation();
  const reorderInitiativeMutation = trpc.initiative.reorder.useMutation();

  function withRollback(mutate: () => void) {
    const snapshot = utils.project.getById.getData({ id: projectId });
    mutate();
    return () => {
      if (snapshot) utils.project.getById.setData({ id: projectId }, snapshot);
    };
  }

  function reorderIncrement(milestoneId: string, oldIndex: number, newIndex: number) {
    const data = utils.project.getById.getData({ id: projectId });
    const milestone = data?.milestones.find((m) => m.id === milestoneId);
    if (!milestone) return;

    const ids = milestone.increments.map((i) => i.id);
    const newOrderIds = arrayMove(ids, oldIndex, newIndex);
    const movedId = ids[oldIndex];
    const orderKeyById = new Map(milestone.increments.map((i) => [i.id, i.orderKey]));
    const newOrderKey = computeDroppedOrderKey(newOrderIds, movedId, orderKeyById);

    const rollback = withRollback(() => {
      utils.project.getById.setData({ id: projectId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          milestones: old.milestones.map((m) =>
            m.id !== milestoneId
              ? m
              : {
                  ...m,
                  increments: newOrderIds.map(
                    (id) => m.increments.find((i) => i.id === id)!
                  ).map((inc) => (inc.id === movedId ? { ...inc, orderKey: newOrderKey } : inc)),
                }
          ),
        };
      });
    });

    reorderIncrementMutation.mutate(
      { id: movedId, newOrderKey },
      { onError: rollback, onSettled: () => utils.project.getById.invalidate({ id: projectId }) }
    );
  }

  function reorderInitiative(incrementId: string, oldIndex: number, newIndex: number) {
    const data = utils.project.getById.getData({ id: projectId });
    let targetIncrement: { id: string; initiatives: { id: string; orderKey: string }[] } | undefined;
    for (const m of data?.milestones ?? []) {
      const found = m.increments.find((i) => i.id === incrementId);
      if (found) {
        targetIncrement = found;
        break;
      }
    }
    if (!targetIncrement) return;

    const ids = targetIncrement.initiatives.map((i) => i.id);
    const newOrderIds = arrayMove(ids, oldIndex, newIndex);
    const movedId = ids[oldIndex];
    const orderKeyById = new Map(targetIncrement.initiatives.map((i) => [i.id, i.orderKey]));
    const newOrderKey = computeDroppedOrderKey(newOrderIds, movedId, orderKeyById);

    const rollback = withRollback(() => {
      utils.project.getById.setData({ id: projectId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          milestones: old.milestones.map((m) => ({
            ...m,
            increments: m.increments.map((inc) =>
              inc.id !== incrementId
                ? inc
                : {
                    ...inc,
                    initiatives: newOrderIds
                      .map((id) => inc.initiatives.find((i) => i.id === id)!)
                      .map((init) => (init.id === movedId ? { ...init, orderKey: newOrderKey } : init)),
                  }
            ),
          })),
        };
      });
    });

    reorderInitiativeMutation.mutate(
      { id: movedId, newOrderKey },
      { onError: rollback, onSettled: () => utils.project.getById.invalidate({ id: projectId }) }
    );
  }

  return { reorderIncrement, reorderInitiative };
}
