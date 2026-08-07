import type { TimelineResult } from '@roadmap/shared';

interface Increment {
  id: string;
  name: string;
  initiatives: { id: string; name: string }[];
}
interface Milestone {
  id: string;
  name: string;
  increments: Increment[];
}

export interface TimelineCsvRow {
  project: string;
  milestone: string;
  increment: string;
  initiative: string;
  phase: string;
  startDate: string;
  endDate: string;
}

export const TIMELINE_COLUMNS: (keyof TimelineCsvRow)[] = ['project', 'milestone', 'increment', 'initiative', 'phase', 'startDate', 'endDate'];

function formatDate(date: Date | undefined, offsetWeeks: number): string {
  return date ? date.toISOString().slice(0, 10) : `Week ${offsetWeeks.toFixed(2)}`;
}

// A segment's endDate is the exclusive boundary where the next segment
// begins (so bars sit flush with no gap). For display, that reads as an
// overlap — "ends 9/2, next starts 9/2" — so show the last day this segment
// actually covers instead: endDate minus one day. Zero-duration segments
// skip the subtraction so they don't render an end date before their start.
function formatEndDate(date: Date | undefined, offsetWeeks: number, durationWeeks: number): string {
  if (!date) return `Week ${offsetWeeks.toFixed(2)}`;
  if (durationWeeks <= 0) return date.toISOString().slice(0, 10);
  const inclusiveEnd = new Date(date);
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
  return inclusiveEnd.toISOString().slice(0, 10);
}

/** One row per phase segment (or one row for an unphased time-estimate/unresolved initiative), with real dates when the timeline is anchored, or a relative "Week N" fallback when it isn't. */
export function buildTimelineCsvRows(projectName: string, milestones: Milestone[], result: TimelineResult): TimelineCsvRow[] {
  const hierarchyByInitiativeId = new Map<string, { milestone: string; increment: string; initiative: string }>();
  for (const milestone of milestones) {
    for (const increment of milestone.increments) {
      for (const initiative of increment.initiatives) {
        hierarchyByInitiativeId.set(initiative.id, { milestone: milestone.name, increment: increment.name, initiative: initiative.name });
      }
    }
  }

  const rows: TimelineCsvRow[] = [];
  for (const row of result.rows) {
    const hierarchy = hierarchyByInitiativeId.get(row.initiativeId);
    if (!hierarchy) continue;

    if (row.segments.length === 0) {
      rows.push({
        project: projectName,
        ...hierarchy,
        phase: row.kind === 'unresolved' ? '(unsized)' : '',
        startDate: '',
        endDate: '',
      });
      continue;
    }

    for (const segment of row.segments) {
      rows.push({
        project: projectName,
        ...hierarchy,
        phase: segment.phaseName,
        startDate: formatDate(segment.startDate, segment.startOffsetWeeks),
        endDate: formatEndDate(segment.endDate, segment.startOffsetWeeks + segment.durationWeeks, segment.durationWeeks),
      });
    }
  }
  return rows;
}
