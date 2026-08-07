import { describe, expect, it } from 'vitest';
import { checkSizingKeyCompatibility, computeFinalSize } from '../sizing.js';

const labels = [
  { id: 'xs', code: 'XS', orderIndex: 0 },
  { id: 's', code: 'S', orderIndex: 1 },
  { id: 'm', code: 'M', orderIndex: 2 },
  { id: 'l', code: 'L', orderIndex: 3 },
  { id: 'xl', code: 'XL', orderIndex: 4 },
];

describe('computeFinalSize', () => {
  it('returns the larger of policy and implementation by orderIndex', () => {
    expect(computeFinalSize(labels, 's', 'l')?.code).toBe('L');
    expect(computeFinalSize(labels, 'xl', 'xs')?.code).toBe('XL');
  });

  it('returns whichever single field is set', () => {
    expect(computeFinalSize(labels, 'm', null)?.code).toBe('M');
    expect(computeFinalSize(labels, null, 's')?.code).toBe('S');
  });

  it('returns null when neither is set', () => {
    expect(computeFinalSize(labels, null, null)).toBeNull();
  });

  it('ties resolve to either label of the same rank', () => {
    expect(computeFinalSize(labels, 'm', 'm')?.code).toBe('M');
  });
});

describe('checkSizingKeyCompatibility', () => {
  it('is compatible when the key is a superset of the project labels', () => {
    const result = checkSizingKeyCompatibility(['XS', 'S', 'M'], ['XS', 'S', 'M', 'L', 'XL']);
    expect(result.compatible).toBe(true);
    expect(result.missingCodes).toEqual([]);
  });

  it('is incompatible and lists missing codes when the key lacks a project label', () => {
    const result = checkSizingKeyCompatibility(['XS', 'S', 'M', 'L', 'XL'], ['XS', 'S', 'M']);
    expect(result.compatible).toBe(false);
    expect(result.missingCodes).toEqual(['L', 'XL']);
  });
});
