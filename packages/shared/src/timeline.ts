const DAYS_PER_WEEK = 7;
const AVERAGE_DAYS_PER_MONTH = 365.25 / 12; // ~30.44 days — used only when unanchored; see computeMonthDurationDays.

export type PhaseUnit = 'day' | 'week' | 'month';

export interface TimelineInitiativeInput {
  initiativeId: string;
  name: string;
  finalSizeCode: string | null;
  timeEstimateWeeks: number | null;
}

export interface TimelinePhaseInput {
  id: string;
  name: string;
  unit: PhaseUnit;
  orderIndex: number;
  canOverlap: boolean;
}

export interface TimelineDurationInput {
  sizingPhaseId: string;
  labelCode: string;
  durationValue: number;
}

export interface TimelineInput {
  sequence: TimelineInitiativeInput[];
  phases: TimelinePhaseInput[];
  durations: TimelineDurationInput[];
  // Max number of initiatives that may be active at once, regardless of
  // phase. Defaults to 1 (fully sequential) when omitted — not load-bearing
  // for real data since the server always supplies the sizing key's value.
  maxOverlap?: number;
  startDate?: Date | null;
}

export interface TimelineSegment {
  phaseId: string | null;
  phaseName: string;
  unitName: string;
  displayDuration: number;
  startOffsetWeeks: number;
  durationWeeks: number;
  startDate?: Date;
  endDate?: Date;
}

export type TimelineRowKind = 'sized' | 'time-estimate' | 'unresolved';
export type TimelineRowWarning = 'missing-size' | 'missing-duration';

export interface TimelineRow {
  initiativeId: string;
  name: string;
  kind: TimelineRowKind;
  startOffsetWeeks: number;
  totalDurationWeeks: number;
  startDate?: Date;
  endDate?: Date;
  segments: TimelineSegment[];
  warning?: TimelineRowWarning;
}

export interface TimelineResult {
  rows: TimelineRow[];
  totalDurationWeeks: number;
  endDate?: Date;
}

// All date arithmetic here is UTC-based, deliberately: a plain "2026-02-01"
// date-only value parses as UTC midnight per spec, and the whole app treats
// dates as calendar values, not precise instants — using local-time
// setters/getters (setMonth, getDate, ...) instead would make month/day
// boundaries depend on the machine's timezone offset relative to UTC and
// silently shift real month lengths by a few hours (enough to roll onto
// the wrong day) whenever that offset is nonzero.
function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + Math.round(days));
  return result;
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

function addCalendarMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/**
 * "1 month" from a given date is only well-defined against a real calendar
 * — Jan is 31 days, Feb is 28 or 29, and it depends which specific month
 * you're currently sitting in, not a flat average. When the schedule is
 * anchored (a real `from` date is known), this walks actual month
 * boundaries via native Date month arithmetic, including a same-proportion
 * treatment of the fractional part in whatever month it lands in (e.g. "0.5
 * months" from a date in a 30-day month is 15 days, from one in a 31-day
 * month is 15.5 days) — so a month-duration phase is never silently
 * shrunk or padded by an average. When unanchored, there is no calendar to
 * consult at all, so this falls back to a clearly-labeled average
 * (365.25/12 days) purely to keep the relative/unanchored view usable.
 */
function computeMonthDurationDays(from: Date | null, monthsValue: number): number {
  if (!from) return monthsValue * AVERAGE_DAYS_PER_MONTH;

  const wholeMonths = Math.trunc(monthsValue);
  const fraction = monthsValue - wholeMonths;
  const afterWhole = addCalendarMonths(from, wholeMonths);
  if (fraction === 0) return daysBetween(from, afterWhole);

  const nextMonthStart = addCalendarMonths(afterWhole, 1);
  const daysInThisMonth = daysBetween(afterWhole, nextMonthStart);
  return daysBetween(from, afterWhole) + fraction * daysInThisMonth;
}

function unitDurationDays(unit: PhaseUnit, displayDuration: number, currentDate: Date | null): number {
  switch (unit) {
    case 'day':
      return displayDuration;
    case 'week':
      return displayDuration * DAYS_PER_WEEK;
    case 'month':
      return computeMonthDurationDays(currentDate, displayDuration);
  }
}

interface DayInterval {
  start: number;
  end: number;
}

// Half-open interval overlap test: [aStart, aEnd) vs [bStart, bEnd).
function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// Latest end-day among intervals in `busy` that overlap [start, end), or null
// if none conflict. Taking the latest (not first) conflict's end means a
// single pass resolves every overlapping booking at once.
function latestConflictEnd(busy: DayInterval[], start: number, end: number): number | null {
  let result: number | null = null;
  for (const iv of busy) {
    if (intervalsOverlap(start, end, iv.start, iv.end) && (result === null || iv.end > result)) {
      result = iv.end;
    }
  }
  return result;
}

interface PendingSegment {
  phase: TimelinePhaseInput;
  displayDuration: number;
  startDays: number;
  durationDays: number;
  startDate: Date | null;
}

/**
 * Schedules a flattened, already-ordered sequence of initiatives, splitting
 * each sized initiative's bar into one segment per phase per the selected
 * sizing key's durations. Pure function — safe to call identically on the
 * server (initial load) and in the browser (instant recompute when the
 * sizing key or start date changes).
 *
 * Concurrency model: each non-overlap-capable phase is its own exclusive
 * resource, tracked independently by phase id — only one initiative may be
 * inside a *given* phase at a time, but two initiatives may be in two
 * different non-overlap phases simultaneously (they're different teams/
 * resources). An overlap-capable phase holds no lock at all. `maxOverlap` is
 * an additional hard ceiling on how many initiatives may be active at once,
 * independent of phase.
 *
 * Within a single initiative, phases are always scheduled back-to-back with
 * no internal gaps: the whole phase block is placed as one contiguous unit,
 * at the earliest start day where every non-overlap phase in it clears its
 * own resource's existing bookings. This can push overlap-capable phases
 * later than their resource alone would require, so that a later phase's
 * exclusivity constraint is never satisfied by leaving a gap earlier in the
 * same initiative's bar.
 *
 * Internally tracks elapsed time in days (the only unit day/week/month can
 * all convert to without an average standing in for "month"), converting to
 * weeks only at the output boundary so callers keep working in the same
 * "weeks" terms as before.
 */
export function computeTimeline(input: TimelineInput): TimelineResult {
  const { sequence, phases, durations, startDate } = input;
  const maxOverlap = Math.max(1, input.maxOverlap ?? 1);

  const orderedPhases = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);
  const durationByKey = new Map(durations.map((d) => [`${d.sizingPhaseId}::${d.labelCode}`, d.durationValue]));

  // Booked intervals per non-overlap phase id — each phase is an independent
  // exclusive resource.
  const resourceBusyByPhase = new Map<string, DayInterval[]>();
  // Booked intervals for initiatives with no phase data at all: since we
  // don't know which specific phase(s) they'd occupy, they're checked and
  // booked against every non-overlap phase's resource (conservative default:
  // "unknown means don't assume it's safe to run alongside anything else").
  const globalBusy: DayInterval[] = [];
  // End day of every already-scheduled initiative, used to enforce maxOverlap.
  const activeEnds: number[] = [];
  // Floor for the next initiative's start, so starts stay in backlog order.
  let minNextStart = 0;
  let overallEndDays = 0;
  const rows: TimelineRow[] = [];

  // Earliest day >= minNextStart at which fewer than maxOverlap
  // already-scheduled initiatives are still active.
  function capacityGatedStart(): number {
    if (activeEnds.length < maxOverlap) return minNextStart;
    const sorted = [...activeEnds].sort((a, b) => a - b);
    const threshold = sorted[sorted.length - maxOverlap];
    return Math.max(minNextStart, threshold);
  }

  // Lays out orderedPhases back-to-back starting at `blockStart`, with no
  // gaps between them — durations (month-unit ones especially) are computed
  // fresh since they depend on the actual calendar date each phase lands on.
  function computeSegmentsAt(initiative: TimelineInitiativeInput, blockStart: number) {
    let cursor = blockStart;
    let missingDuration = false;
    const segments: PendingSegment[] = [];
    for (const phase of orderedPhases) {
      const key = `${phase.id}::${initiative.finalSizeCode}`;
      const rawDuration = durationByKey.get(key);
      if (rawDuration === undefined) missingDuration = true;
      const displayDuration = rawDuration ?? 0;
      const segmentStartDate = startDate ? addDays(startDate, cursor) : null;
      const durationDays = unitDurationDays(phase.unit, displayDuration, segmentStartDate);
      segments.push({ phase, displayDuration, startDays: cursor, durationDays, startDate: segmentStartDate });
      cursor += durationDays;
    }
    return { segments, cursor, missingDuration };
  }

  // Finds the earliest blockStart >= floor at which every non-overlap phase
  // in the (contiguous) block clears its own resource's existing bookings.
  // Each pass computes the block at the current candidate, finds the latest
  // conflict end across all its non-overlap phases, and re-anchors the whole
  // block there — never leaving a gap between phases to dodge a conflict.
  function findEarliestBlockStart(initiative: TimelineInitiativeInput, floor: number) {
    let blockStart = floor;
    for (;;) {
      const attempt = computeSegmentsAt(initiative, blockStart);
      let bump = blockStart;
      for (const seg of attempt.segments) {
        if (seg.phase.canOverlap || seg.durationDays <= 0) continue;
        const busy = resourceBusyByPhase.get(seg.phase.id) ?? [];
        const conflictEnd = latestConflictEnd([...busy, ...globalBusy], seg.startDays, seg.startDays + seg.durationDays);
        if (conflictEnd !== null) {
          const requiredStart = blockStart + (conflictEnd - seg.startDays);
          if (requiredStart > bump) bump = requiredStart;
        }
      }
      if (bump === blockStart) return attempt;
      blockStart = bump;
    }
  }

  for (const initiative of sequence) {
    if (initiative.finalSizeCode) {
      const capacityStart = capacityGatedStart();
      const { segments: pending, cursor, missingDuration } = findEarliestBlockStart(initiative, capacityStart);
      const rowStartDays = pending.length > 0 ? pending[0].startDays : capacityStart;

      for (const seg of pending) {
        if (seg.phase.canOverlap || seg.durationDays <= 0) continue;
        const list = resourceBusyByPhase.get(seg.phase.id) ?? [];
        list.push({ start: seg.startDays, end: seg.startDays + seg.durationDays });
        resourceBusyByPhase.set(seg.phase.id, list);
      }

      const segments: TimelineSegment[] = pending.map((seg) => ({
        phaseId: seg.phase.id,
        phaseName: seg.phase.name,
        unitName: seg.phase.unit,
        displayDuration: seg.displayDuration,
        startOffsetWeeks: seg.startDays / DAYS_PER_WEEK,
        durationWeeks: seg.durationDays / DAYS_PER_WEEK,
        startDate: seg.startDate ?? undefined,
        endDate: seg.startDate ? addDays(seg.startDate, seg.durationDays) : undefined,
      }));

      rows.push({
        initiativeId: initiative.initiativeId,
        name: initiative.name,
        kind: 'sized',
        startOffsetWeeks: rowStartDays / DAYS_PER_WEEK,
        totalDurationWeeks: (cursor - rowStartDays) / DAYS_PER_WEEK,
        startDate: startDate ? addDays(startDate, rowStartDays) : undefined,
        endDate: startDate ? addDays(startDate, cursor) : undefined,
        segments,
        warning: missingDuration ? 'missing-duration' : undefined,
      });

      minNextStart = rowStartDays;
      activeEnds.push(cursor);
      overallEndDays = Math.max(overallEndDays, cursor);
    } else if (initiative.timeEstimateWeeks != null) {
      // No phase data to consult, so treat this as a single block checked
      // against every non-overlap phase's resource — conservative default,
      // consistent with "unknown means don't assume it's safe to run
      // alongside anything else."
      const capacityStart = capacityGatedStart();
      const durationDays = initiative.timeEstimateWeeks * DAYS_PER_WEEK;
      let rowStartDays = capacityStart;
      for (;;) {
        const allBusy = [...Array.from(resourceBusyByPhase.values()).flat(), ...globalBusy];
        const conflictEnd = latestConflictEnd(allBusy, rowStartDays, rowStartDays + durationDays);
        if (conflictEnd === null) break;
        rowStartDays = conflictEnd;
      }
      const rowEndDays = rowStartDays + durationDays;
      globalBusy.push({ start: rowStartDays, end: rowEndDays });

      const segmentStartDate = startDate ? addDays(startDate, rowStartDays) : undefined;
      const segments: TimelineSegment[] = [
        {
          phaseId: null,
          phaseName: 'Estimate',
          unitName: 'week',
          displayDuration: initiative.timeEstimateWeeks,
          startOffsetWeeks: rowStartDays / DAYS_PER_WEEK,
          durationWeeks: initiative.timeEstimateWeeks,
          startDate: segmentStartDate,
          endDate: segmentStartDate ? addDays(segmentStartDate, durationDays) : undefined,
        },
      ];
      rows.push({
        initiativeId: initiative.initiativeId,
        name: initiative.name,
        kind: 'time-estimate',
        startOffsetWeeks: rowStartDays / DAYS_PER_WEEK,
        totalDurationWeeks: initiative.timeEstimateWeeks,
        startDate: segmentStartDate,
        endDate: startDate ? addDays(startDate, rowEndDays) : undefined,
        segments,
      });

      minNextStart = rowStartDays;
      activeEnds.push(rowEndDays);
      overallEndDays = Math.max(overallEndDays, rowEndDays);
    } else {
      // Unresolved: no size, no estimate. Flag it but don't push later
      // initiatives off the schedule for one unsized row.
      rows.push({
        initiativeId: initiative.initiativeId,
        name: initiative.name,
        kind: 'unresolved',
        startOffsetWeeks: minNextStart / DAYS_PER_WEEK,
        totalDurationWeeks: 0,
        segments: [],
        warning: 'missing-size',
      });
    }
  }

  return {
    rows,
    totalDurationWeeks: overallEndDays / DAYS_PER_WEEK,
    endDate: startDate ? addDays(startDate, overallEndDays) : undefined,
  };
}
