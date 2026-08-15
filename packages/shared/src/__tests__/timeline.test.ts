import { describe, expect, it } from 'vitest';
import { computeTimeline, type TimelineDurationInput, type TimelinePhaseInput } from '../timeline.js';

const phases: TimelinePhaseInput[] = [
  { id: 'discovery', name: 'Discovery', unit: 'week', orderIndex: 0, canOverlap: false },
  { id: 'impl', name: 'Implementation', unit: 'week', orderIndex: 1, canOverlap: false },
  { id: 'testing', name: 'Testing', unit: 'week', orderIndex: 2, canOverlap: false },
];

const durations: TimelineDurationInput[] = [
  { sizingPhaseId: 'discovery', labelCode: 'S', durationValue: 2 },
  { sizingPhaseId: 'impl', labelCode: 'S', durationValue: 4 },
  { sizingPhaseId: 'testing', labelCode: 'S', durationValue: 2 },
];

describe('computeTimeline', () => {
  it('schedules sized initiatives sequentially, converting each phase to weeks', () => {
    const result = computeTimeline({
      sequence: [{ initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null }],
      phases,
      durations,
    });

    expect(result.totalDurationWeeks).toBe(8); // 2 + 4 + 2
    expect(result.rows[0].segments.map((s) => s.durationWeeks)).toEqual([2, 4, 2]);
    expect(result.rows[0].warning).toBeUndefined();
  });

  it('does not overlap consecutive initiatives', () => {
    const result = computeTimeline({
      sequence: [
        { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null },
        { initiativeId: 'i2', name: 'Second', finalSizeCode: 'S', timeEstimateWeeks: null },
      ],
      phases,
      durations,
    });

    expect(result.rows[0].startOffsetWeeks).toBe(0);
    expect(result.rows[1].startOffsetWeeks).toBe(8);
    expect(result.totalDurationWeeks).toBe(16);
  });

  it('renders a time-estimate initiative as a single unphased block', () => {
    const result = computeTimeline({
      sequence: [{ initiativeId: 'i1', name: 'Estimate only', finalSizeCode: null, timeEstimateWeeks: 3 }],
      phases,
      durations,
    });

    expect(result.rows[0].kind).toBe('time-estimate');
    expect(result.rows[0].segments).toHaveLength(1);
    expect(result.rows[0].segments[0].phaseId).toBeNull();
    expect(result.rows[0].totalDurationWeeks).toBe(3);
  });

  it('flags an unresolved initiative without pushing the cursor', () => {
    const result = computeTimeline({
      sequence: [
        { initiativeId: 'i1', name: 'Unsized', finalSizeCode: null, timeEstimateWeeks: null },
        { initiativeId: 'i2', name: 'Sized', finalSizeCode: 'S', timeEstimateWeeks: null },
      ],
      phases,
      durations,
    });

    expect(result.rows[0].warning).toBe('missing-size');
    expect(result.rows[0].totalDurationWeeks).toBe(0);
    expect(result.rows[1].startOffsetWeeks).toBe(0);
  });

  it('flags missing-duration when a size has no data for a phase, without crashing', () => {
    const result = computeTimeline({
      sequence: [{ initiativeId: 'i1', name: 'No XL data', finalSizeCode: 'XL', timeEstimateWeeks: null }],
      phases,
      durations,
    });

    expect(result.rows[0].warning).toBe('missing-duration');
    expect(result.rows[0].segments.every((s) => s.durationWeeks === 0)).toBe(true);
  });

  it('anchors to real calendar dates when startDate is set', () => {
    const startDate = new Date('2026-01-05T00:00:00Z');
    const result = computeTimeline({
      sequence: [{ initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null }],
      phases,
      durations,
      startDate,
    });

    expect(result.rows[0].startDate?.toISOString().slice(0, 10)).toBe('2026-01-05');
    // 8 weeks later = 56 days
    expect(result.rows[0].endDate?.toISOString().slice(0, 10)).toBe('2026-03-02');
    expect(result.endDate).toBeDefined();
  });

  it('leaves dates undefined when unanchored', () => {
    const result = computeTimeline({
      sequence: [{ initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null }],
      phases,
      durations,
      startDate: null,
    });

    expect(result.rows[0].startDate).toBeUndefined();
    expect(result.endDate).toBeUndefined();
  });

  describe('phase overlap and max overlap', () => {
    it('shifts the whole block later rather than leaving a gap when a later phase must wait', () => {
      const overlapPhases: TimelinePhaseInput[] = [
        { id: 'discovery', name: 'Discovery', unit: 'week', orderIndex: 0, canOverlap: true },
        { id: 'impl', name: 'Implementation', unit: 'week', orderIndex: 1, canOverlap: false },
      ];
      const overlapDurations: TimelineDurationInput[] = [
        { sizingPhaseId: 'discovery', labelCode: 'S', durationValue: 2 },
        { sizingPhaseId: 'impl', labelCode: 'S', durationValue: 4 },
      ];
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null },
          { initiativeId: 'i2', name: 'Second', finalSizeCode: 'S', timeEstimateWeeks: null },
        ],
        phases: overlapPhases,
        durations: overlapDurations,
        maxOverlap: 2,
      });

      // Second's Implementation can't start before week 6 (First's holds the
      // Implementation resource until then), so Second's whole block —
      // including its overlap-capable Discovery — is anchored so Discovery
      // ends exactly where Implementation begins. No gap between them.
      expect(result.rows[0].startOffsetWeeks).toBe(0);
      expect(result.rows[1].startOffsetWeeks).toBe(4);
      expect(result.rows[1].segments[0].startOffsetWeeks).toBe(4); // Discovery
      expect(result.rows[1].segments[1].startOffsetWeeks).toBe(6); // Implementation
    });

    it('different-named non-overlap phases are independent resources and do not block each other', () => {
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null },
          { initiativeId: 'i2', name: 'Second', finalSizeCode: 'S', timeEstimateWeeks: null },
        ],
        phases,
        durations,
        maxOverlap: 10,
      });

      // First occupies Discovery/Implementation/Testing weeks 0-8. With
      // maxOverlap raised, Second is only blocked from starting Discovery
      // until First's own Discovery frees at week 2 — a different initiative
      // occupying Implementation or Testing doesn't hold Second back.
      expect(result.rows[0].startOffsetWeeks).toBe(0);
      expect(result.rows[1].startOffsetWeeks).toBe(4);
      expect(result.rows[1].segments[0].startOffsetWeeks).toBe(4); // Discovery
      expect(result.rows[1].segments[1].startOffsetWeeks).toBe(6); // Implementation
      expect(result.rows[1].segments[2].startOffsetWeeks).toBe(10); // Testing
    });

    it('never leaves a gap between an initiative\'s own consecutive phases', () => {
      // Regression test: an initiative whose early phase can overlap but
      // whose later phase is exclusive must not show a gap between them —
      // the whole block shifts together instead.
      const overlapPhases: TimelinePhaseInput[] = [
        { id: 'dev', name: 'Development', unit: 'week', orderIndex: 0, canOverlap: true },
        { id: 'impl', name: 'Implementation', unit: 'week', orderIndex: 1, canOverlap: false },
      ];
      const overlapDurations: TimelineDurationInput[] = [
        { sizingPhaseId: 'dev', labelCode: 'S', durationValue: 3 },
        { sizingPhaseId: 'impl', labelCode: 'S', durationValue: 5 },
      ];
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'blocker', name: 'Blocker', finalSizeCode: 'S', timeEstimateWeeks: null },
          { initiativeId: 'renewals', name: 'Renewals', finalSizeCode: 'S', timeEstimateWeeks: null },
        ],
        phases: overlapPhases,
        durations: overlapDurations,
        maxOverlap: 5,
      });

      const renewals = result.rows[1];
      const [dev, impl] = renewals.segments;
      expect(dev.startOffsetWeeks + dev.durationWeeks).toBe(impl.startOffsetWeeks);
    });

    it('maxOverlap caps concurrency even when phases are overlap-capable', () => {
      const allOverlapPhases: TimelinePhaseInput[] = [{ id: 'build', name: 'Build', unit: 'week', orderIndex: 0, canOverlap: true }];
      const allOverlapDurations: TimelineDurationInput[] = [{ sizingPhaseId: 'build', labelCode: 'S', durationValue: 4 }];
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null },
          { initiativeId: 'i2', name: 'Second', finalSizeCode: 'S', timeEstimateWeeks: null },
          { initiativeId: 'i3', name: 'Third', finalSizeCode: 'S', timeEstimateWeeks: null },
        ],
        phases: allOverlapPhases,
        durations: allOverlapDurations,
        maxOverlap: 2,
      });

      expect(result.rows[0].startOffsetWeeks).toBe(0);
      expect(result.rows[1].startOffsetWeeks).toBe(0);
      // Third must wait for a slot to free — First and Second both end at week 4.
      expect(result.rows[2].startOffsetWeeks).toBe(4);
    });
  });

  describe('usability gate (isUsabilityCheckpoint / incrementId)', () => {
    // Discovery(2) + Implementation(4) + Testing(2) per S, same as the
    // top-level `phases`/`durations` fixtures, all overlap-capable so
    // multiple initiatives can be in flight while we isolate the gate rules.
    const gatePhases: TimelinePhaseInput[] = [
      { id: 'discovery', name: 'Discovery', unit: 'week', orderIndex: 0, canOverlap: true },
      { id: 'impl', name: 'Implementation', unit: 'week', orderIndex: 1, canOverlap: true },
      { id: 'testing', name: 'Testing', unit: 'week', orderIndex: 2, canOverlap: true },
    ];

    it("delays a checkpoint until every earlier same-increment initiative's Implementation is 50% complete", () => {
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null, incrementId: 'inc1' },
          { initiativeId: 'gate', name: 'Usability Testing', finalSizeCode: null, timeEstimateWeeks: 3, incrementId: 'inc1', isUsabilityCheckpoint: true },
        ],
        phases: gatePhases,
        durations,
        maxOverlap: 5,
      });

      // i1: Discovery 0-2, Implementation 2-6, Testing 6-8. 50% of
      // Implementation (4 weeks) complete = day (2+2)=4 weeks in.
      expect(result.rows[1].startOffsetWeeks).toBe(4);
    });

    it('does not gate a non-checkpoint flat-estimate initiative even when the name matches loosely', () => {
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null, incrementId: 'inc1' },
          { initiativeId: 'plain', name: 'Usability Testing', finalSizeCode: null, timeEstimateWeeks: 3, incrementId: 'inc1' },
        ],
        phases: gatePhases,
        durations,
        maxOverlap: 5,
      });

      // isUsabilityCheckpoint left unset — starts as soon as capacity allows.
      expect(result.rows[1].startOffsetWeeks).toBe(0);
    });

    it('ignores preceding initiatives from a different increment', () => {
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null, incrementId: 'inc1' },
          { initiativeId: 'gate', name: 'Usability Testing', finalSizeCode: null, timeEstimateWeeks: 3, incrementId: 'inc2', isUsabilityCheckpoint: true },
        ],
        phases: gatePhases,
        durations,
        maxOverlap: 5,
      });

      expect(result.rows[1].startOffsetWeeks).toBe(0);
    });

    it("caps a later initiative's Discovery overlap with a prior checkpoint at half its own duration", () => {
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'gate', name: 'Usability Testing', finalSizeCode: null, timeEstimateWeeks: 4, incrementId: 'inc1', isUsabilityCheckpoint: true },
          { initiativeId: 'next', name: 'Second', finalSizeCode: 'S', timeEstimateWeeks: null, incrementId: 'inc1' },
        ],
        phases: gatePhases,
        durations,
        maxOverlap: 5,
      });

      // Checkpoint spans [0, 4). Second's Discovery is 2 weeks long, so at
      // most 1 week may overlap the checkpoint — Discovery must start no
      // earlier than week 3 (checkpoint end 4 − half of 2).
      expect(result.rows[1].segments[0].startOffsetWeeks).toBe(3);
    });

    it('is fully inert when no row sets isUsabilityCheckpoint (existing sizing keys unaffected)', () => {
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'First', finalSizeCode: 'S', timeEstimateWeeks: null },
          { initiativeId: 'i2', name: 'Second', finalSizeCode: 'S', timeEstimateWeeks: null },
        ],
        phases: gatePhases,
        durations,
        maxOverlap: 5,
      });

      expect(result.rows[0].startOffsetWeeks).toBe(0);
      expect(result.rows[1].startOffsetWeeks).toBe(0);
    });
  });

  describe('month-unit phases use real calendar lengths, not an average', () => {
    const monthPhases: TimelinePhaseInput[] = [{ id: 'build', name: 'Build', unit: 'month', orderIndex: 0, canOverlap: false }];
    const monthDurations: TimelineDurationInput[] = [{ sizingPhaseId: 'build', labelCode: 'M', durationValue: 1 }];

    it('a 1-month phase starting Jan 1 spans exactly January (31 days)', () => {
      const result = computeTimeline({
        sequence: [{ initiativeId: 'i1', name: 'Jan build', finalSizeCode: 'M', timeEstimateWeeks: null }],
        phases: monthPhases,
        durations: monthDurations,
        startDate: new Date('2026-01-01T00:00:00Z'),
      });

      expect(result.rows[0].endDate?.toISOString().slice(0, 10)).toBe('2026-02-01');
      expect(result.rows[0].totalDurationWeeks).toBeCloseTo(31 / 7, 5);
    });

    it('a 1-month phase starting Feb 1 in a non-leap year spans exactly 28 days — a different length than January', () => {
      const result = computeTimeline({
        sequence: [{ initiativeId: 'i1', name: 'Feb build', finalSizeCode: 'M', timeEstimateWeeks: null }],
        phases: monthPhases,
        durations: monthDurations,
        startDate: new Date('2026-02-01T00:00:00Z'),
      });

      expect(result.rows[0].endDate?.toISOString().slice(0, 10)).toBe('2026-03-01');
      expect(result.rows[0].totalDurationWeeks).toBeCloseTo(28 / 7, 5);
    });

    it('two consecutive 1-month initiatives each get their own real month length back-to-back', () => {
      const result = computeTimeline({
        sequence: [
          { initiativeId: 'i1', name: 'Jan build', finalSizeCode: 'M', timeEstimateWeeks: null },
          { initiativeId: 'i2', name: 'Feb build', finalSizeCode: 'M', timeEstimateWeeks: null },
        ],
        phases: monthPhases,
        durations: monthDurations,
        startDate: new Date('2026-01-01T00:00:00Z'),
      });

      expect(result.rows[0].endDate?.toISOString().slice(0, 10)).toBe('2026-02-01');
      expect(result.rows[1].endDate?.toISOString().slice(0, 10)).toBe('2026-03-01');
    });

    it('falls back to a labeled average only when there is no start date to anchor real months to', () => {
      const result = computeTimeline({
        sequence: [{ initiativeId: 'i1', name: 'Unanchored build', finalSizeCode: 'M', timeEstimateWeeks: null }],
        phases: monthPhases,
        durations: monthDurations,
        startDate: null,
      });

      expect(result.rows[0].totalDurationWeeks).toBeCloseTo(365.25 / 12 / 7, 5);
    });
  });
});
