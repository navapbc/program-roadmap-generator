import { describe, expect, it } from 'vitest';
import { buildMilestoneBoundaries } from '../hierarchy.js';

describe('buildMilestoneBoundaries', () => {
  it('nests increments and initiative ids under each milestone', () => {
    const boundaries = buildMilestoneBoundaries([
      {
        id: 'm1',
        name: 'Milestone 1',
        increments: [
          { id: 'inc1', name: 'Increment 1.1', initiatives: [{ id: 'i1' }, { id: 'i2' }] },
          { id: 'inc2', name: 'Increment 1.2', initiatives: [{ id: 'i3' }] },
        ],
      },
      {
        id: 'm2',
        name: 'Milestone 2',
        increments: [{ id: 'inc3', name: 'Increment 2.1', initiatives: [] }],
      },
    ]);

    expect(boundaries).toEqual([
      {
        milestoneId: 'm1',
        name: 'Milestone 1',
        increments: [
          { incrementId: 'inc1', name: 'Increment 1.1', initiativeIds: ['i1', 'i2'] },
          { incrementId: 'inc2', name: 'Increment 1.2', initiativeIds: ['i3'] },
        ],
      },
      {
        milestoneId: 'm2',
        name: 'Milestone 2',
        increments: [{ incrementId: 'inc3', name: 'Increment 2.1', initiativeIds: [] }],
      },
    ]);
  });

  it('returns an empty array for an empty project', () => {
    expect(buildMilestoneBoundaries([])).toEqual([]);
  });
});
