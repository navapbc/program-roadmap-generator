import { computeFinalSize } from '@roadmap/shared';

interface SizeLabel {
  id: string;
  code: string;
  orderIndex: number;
}
interface Initiative {
  id: string;
  name: string;
  policySizeLabelId: string | null;
  implementationSizeLabelId: string | null;
  timeEstimateWeeks: number | null;
  notes: string | null;
}
interface Increment {
  id: string;
  name: string;
  initiatives: Initiative[];
}
interface Milestone {
  id: string;
  name: string;
  increments: Increment[];
}
interface ProjectData {
  name: string;
  sizeLabels: SizeLabel[];
  milestones: Milestone[];
}

export interface RoadmapRow {
  project: string;
  milestone: string;
  increment: string;
  initiative: string;
  policySize: string;
  implementationSize: string;
  finalSize: string;
  timeEstimateWeeks: string;
  notes: string;
}

export const ROADMAP_COLUMNS: (keyof RoadmapRow)[] = [
  'project',
  'milestone',
  'increment',
  'initiative',
  'policySize',
  'implementationSize',
  'finalSize',
  'timeEstimateWeeks',
  'notes',
];

/** Flattens the Project -> Milestone -> Increment -> Initiative hierarchy into one row per initiative, resolving size codes and the computed final size. */
export function buildRoadmapRows(project: ProjectData): RoadmapRow[] {
  const labelById = new Map(project.sizeLabels.map((l) => [l.id, l]));
  const rows: RoadmapRow[] = [];

  for (const milestone of project.milestones) {
    for (const increment of milestone.increments) {
      for (const initiative of increment.initiatives) {
        const finalSize = computeFinalSize(project.sizeLabels, initiative.policySizeLabelId, initiative.implementationSizeLabelId);
        rows.push({
          project: project.name,
          milestone: milestone.name,
          increment: increment.name,
          initiative: initiative.name,
          policySize: initiative.policySizeLabelId ? labelById.get(initiative.policySizeLabelId)?.code ?? '' : '',
          implementationSize: initiative.implementationSizeLabelId ? labelById.get(initiative.implementationSizeLabelId)?.code ?? '' : '',
          finalSize: finalSize?.code ?? '',
          timeEstimateWeeks: initiative.timeEstimateWeeks != null ? String(initiative.timeEstimateWeeks) : '',
          notes: initiative.notes ?? '',
        });
      }
    }
  }
  return rows;
}
