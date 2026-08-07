const DAYS_PER_WEEK = 7;
const DAY_TICK_WIDTH_WEEKS = 1 / DAYS_PER_WEEK;
const WEEK_TICK_WIDTH_WEEKS = 1;
// Real months vary 28-31 days; an average is precise enough for a coarse
// "would this tick be legible" gate (the tick's own rendered width is
// still computed from the real calendar boundary, never this average).
const AVERAGE_MONTH_WEEKS = 30.44 / DAYS_PER_WEEK;
// Below this a tick renders narrower than its own 2-digit label needs —
// not just tight, the number gets truncated. Chosen for the 10px tick font.
const MIN_TICK_PX = 14;

export type ScaleUnit = 'day' | 'week' | 'month' | 'sprint' | 'quarter' | 'year';

/** Coarsest to finest — stacking/list order should always follow this, regardless of toggle history. */
export const SCALE_DISPLAY_ORDER: ScaleUnit[] = ['year', 'quarter', 'month', 'sprint', 'week', 'day'];

export interface ScaleTick {
  label: string;
  startOffsetWeeks: number;
  widthWeeks: number;
}

export interface SprintCadence {
  /** How many business days (Mon–Fri) make up one sprint. */
  lengthBusinessDays: number;
  /** 0=Sunday..6=Saturday, matching Date#getUTCDay(). */
  startWeekday: number;
}

export interface ComputeScaleTicksOptions {
  startDate: Date | null;
  totalDurationWeeks: number;
  sprintCadence?: SprintCadence | null;
  /** Every scale row currently shown, not just this one — lets a coarser row (e.g. Year) let a finer one (e.g. Quarter) drop redundant context from its own label. */
  activeScales?: ScaleUnit[];
}

/** Calendar-anchored scales need a real start date to snap boundaries to. */
export function scaleRequiresStartDate(scale: ScaleUnit): boolean {
  return scale === 'month' || scale === 'quarter' || scale === 'year' || scale === 'sprint';
}

/**
 * Scales usable right now — hides (not just disables) calendar scales with
 * no anchor to snap to, and Sprint specifically until the project has a
 * sprint cadence configured (length + start weekday).
 */
export function availableScales(hasStartDate: boolean, hasSprintCadence: boolean = false): ScaleUnit[] {
  return SCALE_DISPLAY_ORDER.filter((scale) => {
    if (scale === 'sprint') return hasStartDate && hasSprintCadence;
    return hasStartDate || !scaleRequiresStartDate(scale);
  });
}

/** Whether a day tick, at this zoom level, is wide enough to fit its own label. */
export function isDayScaleReadable(pixelsPerWeek: number): boolean {
  return pixelsPerWeek * DAY_TICK_WIDTH_WEEKS >= MIN_TICK_PX;
}

/** Whether a week tick, at this zoom level, is wide enough to fit its own label. */
export function isWeekScaleReadable(pixelsPerWeek: number): boolean {
  return pixelsPerWeek * WEEK_TICK_WIDTH_WEEKS >= MIN_TICK_PX;
}

/** Whether a month tick, at this zoom level, is wide enough to fit its own label (using an average month width — real ticks vary, this is just the coarse gate). */
export function isMonthScaleReadable(pixelsPerWeek: number): boolean {
  return pixelsPerWeek * AVERAGE_MONTH_WEEKS >= MIN_TICK_PX;
}

/** Dispatches to the right readability check for whichever scales have one (day/week/month); scales with no fixed tick width (quarter/year/sprint) are always considered readable. */
export function isScaleReadable(scale: ScaleUnit, pixelsPerWeek: number): boolean {
  switch (scale) {
    case 'day':
      return isDayScaleReadable(pixelsPerWeek);
    case 'week':
      return isWeekScaleReadable(pixelsPerWeek);
    case 'month':
      return isMonthScaleReadable(pixelsPerWeek);
    default:
      return true;
  }
}

// UTC-based throughout — a plain "2026-02-01" date-only value parses as UTC
// midnight per spec, and this app treats dates as calendar values, not
// precise instants. Local-time setters/getters (setMonth, getDate, ...)
// would make these boundaries depend on the machine's timezone offset and
// silently drift by up to a day. See the same note in timeline.ts.
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + Math.round(days));
  return result;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function weeksBetween(a: Date, b: Date): number {
  return daysBetween(a, b) / DAYS_PER_WEEK;
}

function startOfNextMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function startOfNextQuarter(d: Date): Date {
  const quarterStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), quarterStartMonth + 3, 1));
}

function startOfNextYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear() + 1, 0, 1));
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function calendarTicks(
  startDate: Date,
  totalDurationWeeks: number,
  nextBoundary: (d: Date) => Date,
  label: (d: Date) => string
): ScaleTick[] {
  const endDate = addDays(startDate, totalDurationWeeks * DAYS_PER_WEEK);

  const ticks: ScaleTick[] = [];
  let current = startDate;
  let offset = 0;
  while (current < endDate) {
    const boundary = nextBoundary(current);
    const tickEnd = boundary < endDate ? boundary : endDate;
    const widthWeeks = weeksBetween(current, tickEnd);
    ticks.push({ label: label(current), startOffsetWeeks: offset, widthWeeks });
    offset += widthWeeks;
    current = boundary;
  }
  return ticks;
}

// Zero-padded to 2 digits (D01, W01, ...) to keep the label short enough to
// fit a narrow tick column; counts past 99 just grow wider rather than wrap.
function countTicks(totalDurationWeeks: number, tickWidthWeeks: number, labelPrefix: string): ScaleTick[] {
  const count = Math.ceil(totalDurationWeeks / tickWidthWeeks);
  const ticks: ScaleTick[] = [];
  for (let i = 0; i < count; i++) {
    const startOffsetWeeks = i * tickWidthWeeks;
    const widthWeeks = Math.min(tickWidthWeeks, totalDurationWeeks - startOffsetWeeks);
    ticks.push({ label: `${labelPrefix}${String(i + 1).padStart(2, '0')}`, startOffsetWeeks, widthWeeks });
  }
  return ticks;
}

function nextOccurrenceOfWeekday(date: Date, weekday: number): Date {
  const diff = (weekday - date.getUTCDay() + 7) % 7;
  return addDays(date, diff);
}

/** The last calendar day of a sprint that starts at `start` and runs `businessDays` business days (inclusive of `start` if it's a weekday). */
function lastDayOfSprint(start: Date, businessDays: number): Date {
  let count = 0;
  let current = start;
  while (true) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    if (count >= businessDays) return current;
    current = addDays(current, 1);
  }
}

/**
 * Sprints are a custom repeating cadence (business days, not calendar
 * days), so — unlike month/quarter/year — they don't snap to a fixed
 * calendar grid. The first sprint starts on the configured weekday on or
 * after `startDate`; every following sprint starts the day after the
 * previous one's last business day. A "10 business day" sprint starting
 * Monday spans 12 calendar days (two 5-day work weeks either side of one
 * weekend) — not a flat 14-day guess.
 */
function sprintTicks(startDate: Date, totalDurationWeeks: number, cadence: SprintCadence): ScaleTick[] {
  const endDate = addDays(startDate, totalDurationWeeks * DAYS_PER_WEEK);

  let cursor = nextOccurrenceOfWeekday(startDate, cadence.startWeekday);
  let offset = weeksBetween(startDate, cursor);
  const ticks: ScaleTick[] = [];
  let n = 1;
  while (cursor < endDate) {
    const lastDay = lastDayOfSprint(cursor, cadence.lengthBusinessDays);
    // Every sprint starts on the configured weekday, not just the first —
    // for a length that's a whole number of work-weeks this lands the very
    // next day (no gap); otherwise it waits for that weekday to come back
    // around, which also means sprints can't overlap even if the
    // business-day count doesn't divide evenly into calendar weeks.
    const nextStart = nextOccurrenceOfWeekday(addDays(lastDay, 1), cadence.startWeekday);
    const tickEnd = nextStart < endDate ? nextStart : endDate;
    const widthWeeks = weeksBetween(cursor, tickEnd);
    ticks.push({ label: `Sprint ${n}`, startOffsetWeeks: offset, widthWeeks });
    offset += widthWeeks;
    cursor = nextStart;
    n++;
  }
  return ticks;
}

/**
 * Pure header-ruler computation, entirely separate from computeTimeline's
 * scheduling math — bars always live in continuous week-space; toggling
 * which scale rows are shown never re-triggers scheduling. Month/quarter/
 * year snap to real calendar boundaries, so a week tick or a month tick
 * will regularly not line up — a month boundary can fall mid-week, and
 * that's intentional: it's what "real time, not averages" looks like.
 */
export function computeScaleTicks(scale: ScaleUnit, opts: ComputeScaleTicksOptions): ScaleTick[] {
  const { startDate, totalDurationWeeks, sprintCadence, activeScales } = opts;

  if (scaleRequiresStartDate(scale) && !startDate) {
    return [];
  }
  if (scale === 'sprint' && !sprintCadence) {
    return [];
  }

  switch (scale) {
    case 'day':
      return countTicks(totalDurationWeeks, DAY_TICK_WIDTH_WEEKS, 'D');
    case 'week':
      return countTicks(totalDurationWeeks, 1, 'W');
    case 'sprint':
      return sprintTicks(startDate!, totalDurationWeeks, sprintCadence!);
    case 'month':
      // Month is calendar-anchored by definition (scaleRequiresStartDate),
      // so a real date is always available here — no numeric fallback like
      // Day/Week ever needed, and the Year row (when shown) already
      // supplies the year, so the name alone stays unambiguous either way.
      return calendarTicks(startDate!, totalDurationWeeks, startOfNextMonth, (d) => MONTH_NAMES[d.getUTCMonth()]);
    case 'quarter': {
      const includeYear = !activeScales?.includes('year');
      return calendarTicks(
        startDate!,
        totalDurationWeeks,
        startOfNextQuarter,
        (d) => `Q${Math.floor(d.getUTCMonth() / 3) + 1}${includeYear ? ` ${d.getUTCFullYear()}` : ''}`
      );
    }
    case 'year':
      return calendarTicks(startDate!, totalDurationWeeks, startOfNextYear, (d) => `${d.getUTCFullYear()}`);
  }
}
