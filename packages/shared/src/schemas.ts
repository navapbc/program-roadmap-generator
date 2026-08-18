import { z } from 'zod';

export const idSchema = z.string().cuid();
export const phaseUnitSchema = z.enum(['day', 'week', 'month']);
export const scaleUnitSchema = z.enum(['day', 'week', 'month', 'sprint', 'quarter', 'year']);
/** 0=Sunday..6=Saturday, matching Date#getUTCDay(). */
export const weekdaySchema = z.number().int().min(0).max(6);
/** How an initiative's per-field estimate values combine into its Final size — see computeFinalSize(). */
export const finalSizeFormulaSchema = z.enum(['max', 'min']);

export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateProjectSchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  startDate: z.coerce.date().nullable().optional(),
  defaultSizingKeyId: idSchema.nullable().optional(),
  timelineHeaderScales: z.array(scaleUnitSchema).optional(),
  sprintLengthBusinessDays: z.number().int().positive().nullable().optional(),
  sprintStartWeekday: weekdaySchema.nullable().optional(),
  finalSizeFormula: finalSizeFormulaSchema.optional(),
});

export const reorderSchema = z.object({
  id: idSchema,
  newOrderKey: z.string().min(1),
});

export const createSizeLabelSchema = z.object({
  projectId: idSchema,
  code: z.string().min(1).max(20),
  afterId: idSchema.nullable().optional(),
});

export const renameSizeLabelSchema = z.object({
  id: idSchema,
  code: z.string().min(1).max(20),
});

export const createEstimateFieldSchema = z.object({
  projectId: idSchema,
  name: z.string().min(1).max(40),
  afterId: idSchema.nullable().optional(),
});

export const renameEstimateFieldSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(40),
});

export const createMilestoneSchema = z.object({
  projectId: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateMilestoneSchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const createIncrementSchema = z.object({
  milestoneId: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateIncrementSchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const createInitiativeSchema = z.object({
  incrementId: idSchema,
  name: z.string().min(1),
});

/** One estimate field's value for an initiative — `sizeLabelId: null` clears that field. */
export const initiativeEstimateValueInputSchema = z.object({
  estimateFieldId: idSchema,
  sizeLabelId: idSchema.nullable(),
});

/**
 * Mutual exclusivity: an Initiative is sized via its project's configured
 * estimate fields OR a raw time estimate, never both. `estimateValues` is a
 * partial update — only the fields included are touched, the rest are left
 * as they are (mirrors the UI, where each field's dropdown mutates only
 * itself). Setting any field's sizeLabelId to non-null clears
 * timeEstimateWeeks server-side, and setting timeEstimateWeeks clears every
 * estimate value — see initiative.update in apps/server.
 */
export const updateInitiativeSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).optional(),
    notes: z.string().nullable().optional(),
    estimateValues: z.array(initiativeEstimateValueInputSchema).optional(),
    timeEstimateWeeks: z.number().positive().nullable().optional(),
  })
  .refine(
    (input) => {
      const settingSize = input.estimateValues?.some((v) => v.sizeLabelId != null) ?? false;
      const settingEstimate = input.timeEstimateWeeks != null;
      return !(settingSize && settingEstimate);
    },
    {
      message: 'An initiative can use a size or a time estimate, not both.',
      path: ['timeEstimateWeeks'],
    }
  );

export const createSizingKeySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateSizingKeySchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  maxOverlap: z.number().int().min(1).optional(),
  // When true, timeline.compute gates any flat-estimate initiative named
  // "Usability Testing" on 50% completion of preceding same-increment
  // initiatives' Implementation phase, and caps how much a later
  // initiative's Discovery phase may overlap it — see computeTimeline().
  usabilityGateEnabled: z.boolean().optional(),
});

export const duplicateSizingKeySchema = z.object({
  id: idSchema,
  newName: z.string().min(1),
});

export const createCompatibleSizingKeySchema = z.object({
  projectId: idSchema,
  name: z.string().min(1),
});

export const addSizingKeyLabelSchema = z.object({
  sizingKeyId: idSchema,
  code: z.string().min(1).max(20),
  afterId: idSchema.nullable().optional(),
});

export const renameSizingKeyLabelSchema = z.object({
  id: idSchema,
  code: z.string().min(1).max(20),
});

export const addSizingPhaseSchema = z.object({
  sizingKeyId: idSchema,
  name: z.string().min(1),
  unit: phaseUnitSchema,
  afterId: idSchema.nullable().optional(),
  canOverlap: z.boolean().optional(),
});

export const renameSizingPhaseSchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  unit: phaseUnitSchema.optional(),
  canOverlap: z.boolean().optional(),
});

export const setSizingDurationSchema = z.object({
  sizingPhaseId: idSchema,
  labelCode: z.string().min(1),
  durationValue: z.number().nonnegative(),
});

export const computeTimelineInputSchema = z.object({
  projectId: idSchema,
  sizingKeyId: idSchema,
  milestoneId: idSchema.optional(),
  startDateOverride: z.coerce.date().nullable().optional(),
});

/**
 * Column names reserved by the fixed part of a roadmap row — everything else
 * in an imported row's columns is treated as an estimate-field value, keyed
 * by its own header text (see importRoadmap's row grouping in apps/server).
 * `project` and `finalSize` are round-tripped from RoadmapRow's own export
 * columns but never read on import: `project` is a separate top-level field
 * (import always creates a fresh project rather than reading it per-row),
 * and `finalSize` is always recomputed, never imported.
 */
export const RESERVED_ROADMAP_ROW_COLUMNS = ['project', 'milestone', 'increment', 'initiative', 'finalSize', 'timeEstimateWeeks', 'notes'] as const;

/**
 * One row per initiative. The fixed columns below are required/typed;
 * anything else is one project-defined estimate field's value, keyed by its
 * column header — there's no fixed list of them since fields are
 * project-configurable. Every field arrives as a string, matching how both
 * the CSV and JSON roadmap export always encode it — numbers-as-strings for
 * timeEstimateWeeks included.
 */
export const importRoadmapRowSchema = z
  .object({
    milestone: z.string().min(1),
    increment: z.string().min(1),
    initiative: z.string().min(1),
    timeEstimateWeeks: z.string().optional(),
    notes: z.string().optional(),
  })
  .catchall(z.string().optional());

export const importRoadmapSchema = z.object({
  name: z.string().min(1),
  rows: z.array(importRoadmapRowSchema).min(1),
});

export const createTimelineMarkerSchema = z.object({
  projectId: idSchema,
  label: z.string().min(1),
  date: z.coerce.date(),
});

export const updateTimelineMarkerSchema = z.object({
  id: idSchema,
  label: z.string().min(1).optional(),
  date: z.coerce.date().optional(),
});

/**
 * One row of a saved Combined View. milestoneId/incrementId null means
 * "whole project" / "whole milestone" respectively — incrementId is only
 * meaningful once milestoneId narrows to one specific milestone.
 * startDateOverride is a view-only "modeling" date, never written to the
 * Project — it exists purely so an unanchored project can be plotted
 * alongside an anchored one within this saved view.
 */
export const combinedViewScopeInputSchema = z.object({
  projectId: idSchema,
  milestoneId: idSchema.nullable(),
  incrementId: idSchema.nullable(),
  sizingKeyId: idSchema,
  startDateOverride: z.coerce.date().nullable().optional(),
});

export const createCombinedViewSchema = z.object({
  name: z.string().min(1),
  timelineHeaderScales: z.array(scaleUnitSchema).optional(),
  dateRangeStart: z.coerce.date().nullable().optional(),
  dateRangeEnd: z.coerce.date().nullable().optional(),
  scopes: z.array(combinedViewScopeInputSchema),
});

// scopes, when present, wholesale-replaces the saved set — a Combined View's
// scopes aren't edited piecemeal from the UI, they're re-saved as a whole
// each time, so there's no per-scope id to diff against on update.
export const updateCombinedViewSchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  timelineHeaderScales: z.array(scaleUnitSchema).optional(),
  dateRangeStart: z.coerce.date().nullable().optional(),
  dateRangeEnd: z.coerce.date().nullable().optional(),
  scopes: z.array(combinedViewScopeInputSchema).optional(),
});
