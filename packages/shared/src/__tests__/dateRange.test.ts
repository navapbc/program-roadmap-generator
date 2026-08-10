import { describe, expect, it } from 'vitest';
import { checkRowAgainstWindow, dateRangeToWindow } from '../dateRange.js';

describe('dateRangeToWindow', () => {
  it('returns an unbounded window when there is no origin to convert against', () => {
    const window = dateRangeToWindow(null, new Date('2026-01-01T00:00:00Z'), new Date('2026-12-31T00:00:00Z'));
    expect(window).toEqual({ startOffsetWeeks: null, endOffsetWeeks: null });
  });

  it('converts real dates into week-offsets relative to the origin', () => {
    const origin = new Date('2026-01-01T00:00:00Z');
    const window = dateRangeToWindow(origin, new Date('2026-01-08T00:00:00Z'), new Date('2026-01-22T00:00:00Z'));
    expect(window.startOffsetWeeks).toBeCloseTo(1, 5);
    expect(window.endOffsetWeeks).toBeCloseTo(3, 5);
  });

  it('leaves a boundary unbounded when that end of the range is not set', () => {
    const origin = new Date('2026-01-01T00:00:00Z');
    const window = dateRangeToWindow(origin, null, new Date('2026-01-15T00:00:00Z'));
    expect(window.startOffsetWeeks).toBeNull();
    expect(window.endOffsetWeeks).toBeCloseTo(2, 5);
  });
});

describe('checkRowAgainstWindow', () => {
  const window = { startOffsetWeeks: 2, endOffsetWeeks: 10 };

  it('flags neither direction when the row is fully inside the window', () => {
    expect(checkRowAgainstWindow(3, 8, window)).toEqual({ extendsBefore: false, extendsBeyond: false });
  });

  it('flags extendsBeyond when the row runs past the window end', () => {
    expect(checkRowAgainstWindow(3, 12, window)).toEqual({ extendsBefore: false, extendsBeyond: true });
  });

  it('flags extendsBefore when the row starts before the window start', () => {
    expect(checkRowAgainstWindow(0, 8, window)).toEqual({ extendsBefore: true, extendsBeyond: false });
  });

  it('flags both directions when the row spans the whole window and beyond', () => {
    expect(checkRowAgainstWindow(0, 12, window)).toEqual({ extendsBefore: true, extendsBeyond: true });
  });

  it('never flags anything against an unbounded window', () => {
    expect(checkRowAgainstWindow(-100, 1000, { startOffsetWeeks: null, endOffsetWeeks: null })).toEqual({
      extendsBefore: false,
      extendsBeyond: false,
    });
  });
});
