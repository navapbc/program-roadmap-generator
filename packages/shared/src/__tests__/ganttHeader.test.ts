import { describe, expect, it } from 'vitest';
import {
  availableScales,
  computeScaleTicks,
  isDayScaleReadable,
  isMonthScaleReadable,
  isWeekScaleReadable,
  SCALE_DISPLAY_ORDER,
} from '../ganttHeader.js';

describe('computeScaleTicks', () => {
  it('month ticks snap to real calendar boundaries, not a flat average, and use real month names', () => {
    const ticks = computeScaleTicks('month', {
      startDate: new Date('2026-01-01T00:00:00Z'),
      totalDurationWeeks: 12,
    });

    expect(ticks[0].label).toBe('Jan');
    expect(ticks[0].widthWeeks).toBeCloseTo(31 / 7, 5);
    expect(ticks[1].label).toBe('Feb');
    expect(ticks[1].widthWeeks).toBeCloseTo(28 / 7, 5); // 2026 is not a leap year
  });

  it('quarter ticks include the year unless Year is also shown', () => {
    const opts = { startDate: new Date('2026-01-01T00:00:00Z'), totalDurationWeeks: 12 };
    expect(computeScaleTicks('quarter', opts)[0].label).toBe('Q1 2026');
    expect(computeScaleTicks('quarter', { ...opts, activeScales: ['week'] })[0].label).toBe('Q1 2026');
    expect(computeScaleTicks('quarter', { ...opts, activeScales: ['year', 'quarter'] })[0].label).toBe('Q1');
  });

  it('returns no ticks for calendar scales when unanchored', () => {
    expect(computeScaleTicks('month', { startDate: null, totalDurationWeeks: 12 })).toEqual([]);
    expect(computeScaleTicks('quarter', { startDate: null, totalDurationWeeks: 12 })).toEqual([]);
    expect(computeScaleTicks('year', { startDate: null, totalDurationWeeks: 12 })).toEqual([]);
  });

  it('day/week ticks work with no start date at all', () => {
    const days = computeScaleTicks('day', { startDate: null, totalDurationWeeks: 1 });
    expect(days).toHaveLength(7);
    expect(days[0].label).toBe('D01');

    const weeks = computeScaleTicks('week', { startDate: null, totalDurationWeeks: 2 });
    expect(weeks.map((t) => t.label)).toEqual(['W01', 'W02']);
  });

  describe('sprint ticks', () => {
    const cadence = { lengthBusinessDays: 10, startWeekday: 1 }; // Monday

    it('returns no ticks without a sprint cadence, even when anchored', () => {
      expect(
        computeScaleTicks('sprint', { startDate: new Date('2026-01-05T00:00:00Z'), totalDurationWeeks: 4 })
      ).toEqual([]);
    });

    it('a 10-business-day sprint starting Monday spans exactly 2 calendar weeks', () => {
      // 2026-01-05 is a Monday.
      const ticks = computeScaleTicks('sprint', {
        startDate: new Date('2026-01-05T00:00:00Z'),
        totalDurationWeeks: 6,
        sprintCadence: cadence,
      });

      expect(ticks[0].label).toBe('Sprint 1');
      expect(ticks[0].startOffsetWeeks).toBeCloseTo(0, 5);
      expect(ticks[0].widthWeeks).toBeCloseTo(2, 5); // Mon through the Friday two weeks later, next sprint starts the following Monday
      expect(ticks[1].label).toBe('Sprint 2');
      expect(ticks[1].startOffsetWeeks).toBeCloseTo(2, 5);
    });

    it('shifts sprint 1 forward to the configured weekday when the project start date falls earlier in the week', () => {
      // 2026-01-01 is a Thursday; first Monday on/after it is 2026-01-05.
      const ticks = computeScaleTicks('sprint', {
        startDate: new Date('2026-01-01T00:00:00Z'),
        totalDurationWeeks: 4,
        sprintCadence: cadence,
      });

      expect(ticks[0].startOffsetWeeks).toBeCloseTo(4 / 7, 5); // Thu -> Mon is 4 days
    });
  });
});

describe('isDayScaleReadable', () => {
  it('is false everywhere in the zoom range — a day tick never gets enough of its 1/7-week share to fit "D01"', () => {
    expect(isDayScaleReadable(4)).toBe(false); // zoom min
    expect(isDayScaleReadable(24)).toBe(false); // zoom default
    expect(isDayScaleReadable(200)).toBe(false); // zoom max
  });
});

describe('isWeekScaleReadable', () => {
  it('is false until a week tick is wide enough for its "W01"-style label, not just once it has some room', () => {
    expect(isWeekScaleReadable(4)).toBe(false); // zoom min
    expect(isWeekScaleReadable(24)).toBe(false); // zoom default — was wrongly "readable" before the threshold fix, rendering a clipped "W"
  });

  it('is true once a week tick has room for its full "W01"-style label', () => {
    expect(isWeekScaleReadable(200)).toBe(true); // zoom max
  });
});

describe('isMonthScaleReadable', () => {
  it('is false at the very bottom of the zoom range — even an average month tick is too narrow there', () => {
    expect(isMonthScaleReadable(4)).toBe(false); // zoom min
  });

  it('is true once zoomed in past the zoom default', () => {
    expect(isMonthScaleReadable(24)).toBe(true); // zoom default
  });
});

describe('availableScales', () => {
  it('hides calendar scales and sprint when unanchored', () => {
    expect(availableScales(false)).toEqual(['week', 'day']);
  });

  it('shows calendar scales but not sprint when anchored without a sprint cadence', () => {
    expect(availableScales(true, false)).toEqual(['year', 'quarter', 'month', 'week', 'day']);
  });

  it('shows sprint only when anchored AND a sprint cadence is configured', () => {
    expect(availableScales(true, true)).toEqual(SCALE_DISPLAY_ORDER);
  });
});
