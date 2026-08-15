import type { SizeLabelInput } from './types.js';

export type FinalSizeFormula = 'max' | 'min';

/**
 * Combined/Final size = MAX or MIN (per the project's configured formula) of
 * however many estimate-field values are set, using the Project's own label
 * ordering. Never persisted — always recomputed on read.
 *
 * Only max/min are offered: a project's size scale is ordinal (XS/S/M/L/XL),
 * not numeric, so arithmetic combinations like sum/average have no
 * well-defined meaning across sizes — max/min are the only combinators that
 * always resolve to one of the actual values entered, with no invented
 * in-between size.
 */
export function computeFinalSize(
  projectLabels: SizeLabelInput[],
  valueLabelIds: (string | null | undefined)[],
  formula: FinalSizeFormula = 'max'
): SizeLabelInput | null {
  const byId = new Map(projectLabels.map((l) => [l.id, l]));
  const resolved = valueLabelIds
    .map((id) => (id ? byId.get(id) ?? null : null))
    .filter((label): label is SizeLabelInput => label != null);

  if (resolved.length === 0) return null;
  return resolved.reduce((winner, candidate) =>
    formula === 'min'
      ? (candidate.orderIndex < winner.orderIndex ? candidate : winner)
      : (candidate.orderIndex > winner.orderIndex ? candidate : winner)
  );
}

export interface SizingKeyCompatibilityResult {
  compatible: boolean;
  missingCodes: string[];
}

/**
 * A SizingKey is usable by a Project iff every one of the project's label
 * codes also appears in the key's own label list (the key may have extra
 * codes the project doesn't use — that's fine, it just needs to be a
 * superset). Pure string-set comparison — codes, never row IDs, so a single
 * key can be validated against any number of independently-labeled projects.
 */
export function checkSizingKeyCompatibility(
  projectLabelCodes: string[],
  keyLabelCodes: string[]
): SizingKeyCompatibilityResult {
  const keyCodes = new Set(keyLabelCodes);
  const missingCodes = projectLabelCodes.filter((code) => !keyCodes.has(code));
  return { compatible: missingCodes.length === 0, missingCodes };
}
