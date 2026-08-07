import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Wraps fractional-indexing so drag-and-drop order keys can be regenerated
 * between any two siblings without ever resequencing the rest of the list.
 * Used identically for Increment.orderKey (siblings = same milestoneId) and
 * Initiative.orderKey (siblings = same incrementId) — reordering an
 * Increment as a block only ever touches Increment.orderKey, so it can never
 * disturb the orderKey of the Initiatives nested inside it.
 */
export function nextOrderKey(prevKey: string | null, nextKey: string | null): string {
  return generateKeyBetween(prevKey, nextKey);
}

export function initialOrderKeys(count: number): string[] {
  return generateNKeysBetween(null, null, count);
}
