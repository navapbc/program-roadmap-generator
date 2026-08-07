/**
 * Plain integer resequencing for short, rarely-reordered lists (SizeLabel,
 * SizingKeyLabel, SizingPhase orderIndex) — unlike Increment/Initiative
 * orderKey (fractional-indexing), these lists are small enough that a full
 * resequence on every reorder is simpler and cheap.
 */
export function resequenceIds(orderedIds: string[]): Map<string, number> {
  const result = new Map<string, number>();
  orderedIds.forEach((id, index) => result.set(id, index));
  return result;
}

/** Insert `movedId` immediately after `afterId` (or at the start if afterId is null/undefined). */
export function reinsertAfter(existingIdsInOrder: string[], movedId: string, afterId: string | null | undefined): string[] {
  const withoutMoved = existingIdsInOrder.filter((id) => id !== movedId);
  if (afterId == null) {
    return [movedId, ...withoutMoved];
  }
  const afterIndex = withoutMoved.indexOf(afterId);
  if (afterIndex === -1) {
    return [...withoutMoved, movedId];
  }
  const result = [...withoutMoved];
  result.splice(afterIndex + 1, 0, movedId);
  return result;
}

/**
 * Builds the list of Prisma update() calls for a two-phase orderIndex
 * resequence: a (scopeId, orderIndex) unique constraint would transiently
 * collide if final positions were written in one pass while two rows swap
 * places, so every row is first stashed at a negative placeholder, then
 * given its final position once nothing still holds a target index. Pass
 * the resulting array straight to `prisma.$transaction(...)`.
 */
export function buildTwoPhaseReorderOps<Delegate extends { update: (args: { where: { id: string }; data: { orderIndex: number } }) => unknown }>(
  delegate: Delegate,
  orderedIds: string[]
): unknown[] {
  const indexById = resequenceIds(orderedIds);
  const entries = [...indexById.entries()];
  return [
    ...entries.map(([id], i) => delegate.update({ where: { id }, data: { orderIndex: -(i + 1) } })),
    ...entries.map(([id, orderIndex]) => delegate.update({ where: { id }, data: { orderIndex } })),
  ];
}
