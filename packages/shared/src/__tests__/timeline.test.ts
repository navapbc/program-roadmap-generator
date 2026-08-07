import { describe, expect, it } from 'vitest';
import { computeTimeline, type TimelineDurationInput, type TimelinePhaseInput } from '../timeline.js';

const phases: TimelinePhaseInput[] = [
  { id: 'discovery', name: 'Discovery', unit: 'week', orderIndex: 0 },
  { id: 'impl', name: 'Implementation', unit: 'week', orderIndex: 1 },
  { id: 'testing', name: 'Testing', unit: 'week', orderIndex: 2 },
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

  describe('month-unit phases use real calendar lengths, not an average', () => {
    const monthPhases: TimelinePhaseInput[] = [{ id: 'build', name: 'Build', unit: 'month', orderIndex: 0 }];
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
