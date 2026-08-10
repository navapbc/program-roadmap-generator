const DAYS_PER_WEEK = 7;

function weeksBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * DAYS_PER_WEEK);
}

export interface DateRangeWindow {
  /** Week-offset (relative to whatever origin the rows themselves were computed against) of the window's start; null = unbounded. */
  startOffsetWeeks: number | null;
  /** Week-offset of the window's end; null = unbounded. */
  endOffsetWeeks: number | null;
}

/**
 * Converts a real start/end date-range selection into a week-offset window
 * relative to `origin` — the same calendar origin the rows being filtered
 * were computed against (a project's own start date, or a Combined
 * Timeline's shared origin). Returns an unbounded window if there's no
 * origin to convert against — an unanchored scope has no calendar to select
 * a date range from in the first place.
 */
export function dateRangeToWindow(origin: Date | null, start: Date | null, end: Date | null): DateRangeWindow {
  if (!origin) return { startOffsetWeeks: null, endOffsetWeeks: null };
  return {
    startOffsetWeeks: start ? weeksBetween(origin, start) : null,
    endOffsetWeeks: end ? weeksBetween(origin, end) : null,
  };
}

export interface RowRangeStatus {
  /** Some of this row's work falls before the window's start. */
  extendsBefore: boolean;
  /** Some of this row's work falls after the window's end. */
  extendsBeyond: boolean;
}

/** Whether a row (given its own start/end week-offsets) falls outside the selected window, and in which direction — used to grey out a row and explain why. */
export function checkRowAgainstWindow(
  rowStartOffsetWeeks: number,
  rowEndOffsetWeeks: number,
  window: DateRangeWindow
): RowRangeStatus {
  return {
    extendsBefore: window.startOffsetWeeks != null && rowStartOffsetWeeks < window.startOffsetWeeks,
    extendsBeyond: window.endOffsetWeeks != null && rowEndOffsetWeeks > window.endOffsetWeeks,
  };
}
