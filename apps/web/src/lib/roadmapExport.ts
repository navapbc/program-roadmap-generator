import { computeFinalSize } from '@roadmap/shared';

interface SizeLabel {
  id: string;
  code: string;
  orderIndex: number;
}
interface EstimateField {
  id: string;
  name: string;
  orderIndex: number;
}
interface InitiativeEstimateValue {
  estimateFieldId: string;
  sizeLabelId: string;
}
interface Initiative {
  id: string;
  name: string;
  estimateValues: InitiativeEstimateValue[];
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
  estimateFields: EstimateField[];
  finalSizeFormula: string;
  milestones: Milestone[];
}

/** One row per initiative — a plain string-keyed record, since the column set beyond the fixed ones depends on the project's own configured estimate fields. */
export type RoadmapRow = Record<string, string>;

const FIXED_PREFIX = ['project', 'milestone', 'increment', 'initiative'];
const FIXED_SUFFIX = ['finalSize', 'timeEstimateWeeks', 'notes'];

/** Column order for a given project: fixed columns, one column per its configured estimate field (by name), then the fixed trailing columns. */
export function buildRoadmapColumns(project: Pick<ProjectData, 'estimateFields'>): string[] {
  return [...FIXED_PREFIX, ...project.estimateFields.map((f) => f.name), ...FIXED_SUFFIX];
}

/** Flattens the Project -> Milestone -> Increment -> Initiative hierarchy into one row per initiative, resolving size codes (one column per configured estimate field) and the computed final size. */
export function buildRoadmapRows(project: ProjectData): RoadmapRow[] {
  const labelById = new Map(project.sizeLabels.map((l) => [l.id, l]));
  const sortedFields = [...project.estimateFields].sort((a, b) => a.orderIndex - b.orderIndex);
  const rows: RoadmapRow[] = [];

  for (const milestone of project.milestones) {
    for (const increment of milestone.increments) {
      for (const initiative of increment.initiatives) {
        const valueByField = new Map(initiative.estimateValues.map((v) => [v.estimateFieldId, v.sizeLabelId]));
        const finalSize = computeFinalSize(
          project.sizeLabels,
          initiative.estimateValues.map((v) => v.sizeLabelId),
          project.finalSizeFormula as 'max' | 'min'
        );

        const row: RoadmapRow = {
          project: project.name,
          milestone: milestone.name,
          increment: increment.name,
          initiative: initiative.name,
        };
        for (const field of sortedFields) {
          const sizeLabelId = valueByField.get(field.id);
          row[field.name] = sizeLabelId ? labelById.get(sizeLabelId)?.code ?? '' : '';
        }
        row.finalSize = finalSize?.code ?? '';
        row.timeEstimateWeeks = initiative.timeEstimateWeeks != null ? String(initiative.timeEstimateWeeks) : '';
        row.notes = initiative.notes ?? '';
        rows.push(row);
      }
    }
  }
  return rows;
}
