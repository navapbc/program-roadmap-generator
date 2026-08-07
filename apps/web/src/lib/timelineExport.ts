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
        endDate: formatDate(segment.endDate, segment.startOffsetWeeks + segment.durationWeeks),
      });
    }
  }
  return rows;
}
