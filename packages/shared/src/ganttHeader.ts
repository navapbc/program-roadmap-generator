const DAYS_PER_WEEK = 7;

export type ScaleUnit = 'day' | 'week' | 'month' | 'quarter' | 'year';

/** Coarsest to finest — stacking/list order should always follow this, regardless of toggle history. */
export const SCALE_DISPLAY_ORDER: ScaleUnit[] = ['year', 'quarter', 'month', 'week', 'day'];

export interface ScaleTick {
  label: string;
  startOffsetWeeks: number;
  widthWeeks: number;
}

export interface ComputeScaleTicksOptions {
  startDate: Date | null;
  totalDurationWeeks: number;
}

/** Calendar scales (month/quarter/year) need a real anchor date to snap to boundaries. */
export function scaleRequiresStartDate(scale: ScaleUnit): boolean {
  return scale === 'month' || scale === 'quarter' || scale === 'year';
}

/** Scales usable right now — hides (not just disables) calendar scales that have no anchor to snap to. */
export function availableScales(hasStartDate: boolean): ScaleUnit[] {
  return SCALE_DISPLAY_ORDER.filter((scale) => hasStartDate || !scaleRequiresStartDate(scale));
}

function weeksBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * DAYS_PER_WEEK);
}

// UTC-based throughout, to match packages/shared/timeline.ts — see the note
// there on why local-time setters/getters would silently corrupt calendar
// boundaries depending on the machine's timezone offset.
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

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function calendarTicks(
  startDate: Date,
  totalDurationWeeks: number,
  nextBoundary: (d: Date) => Date,
  label: (d: Date) => string
): ScaleTick[] {
  const endDate = new Date(startDate.getTime());
  endDate.setDate(endDate.getDate() + Math.round(totalDurationWeeks * DAYS_PER_WEEK));

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

function countTicks(totalDurationWeeks: number, tickWidthWeeks: number, labelPrefix: string): ScaleTick[] {
  const count = Math.ceil(totalDurationWeeks / tickWidthWeeks);
  const ticks: ScaleTick[] = [];
  for (let i = 0; i < count; i++) {
    const startOffsetWeeks = i * tickWidthWeeks;
    const widthWeeks = Math.min(tickWidthWeeks, totalDurationWeeks - startOffsetWeeks);
    ticks.push({ label: `${labelPrefix} ${i + 1}`, startOffsetWeeks, widthWeeks });
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
  const { startDate, totalDurationWeeks } = opts;

  if (scaleRequiresStartDate(scale) && !startDate) {
    return [];
  }

  switch (scale) {
    case 'day':
      return countTicks(totalDurationWeeks, 1 / DAYS_PER_WEEK, 'Day');
    case 'week':
      return countTicks(totalDurationWeeks, 1, 'Week');
    case 'month':
      return calendarTicks(
        startDate!,
        totalDurationWeeks,
        startOfNextMonth,
        (d) => `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
      );
    case 'quarter':
      return calendarTicks(
        startDate!,
        totalDurationWeeks,
        startOfNextQuarter,
        (d) => `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
      );
    case 'year':
      return calendarTicks(startDate!, totalDurationWeeks, startOfNextYear, (d) => `${d.getUTCFullYear()}`);
  }
}
