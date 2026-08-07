import type { SizeLabelInput } from './types.js';

/**
 * Combined/Final size = MAX(policy, implementation) using the Project's own
 * label ordering. Never persisted — always recomputed on read.
 */
export function computeFinalSize(
  projectLabels: SizeLabelInput[],
  policyLabelId: string | null | undefined,
  implementationLabelId: string | null | undefined
): SizeLabelInput | null {
  const byId = new Map(projectLabels.map((l) => [l.id, l]));
  const policy = policyLabelId ? byId.get(policyLabelId) ?? null : null;
  const impl = implementationLabelId ? byId.get(implementationLabelId) ?? null : null;

  if (policy && impl) {
    return policy.orderIndex >= impl.orderIndex ? policy : impl;
  }
  return policy ?? impl ?? null;
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
