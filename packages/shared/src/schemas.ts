import { z } from 'zod';

export const idSchema = z.string().cuid();
export const phaseUnitSchema = z.enum(['day', 'week', 'month']);
export const scaleUnitSchema = z.enum(['day', 'week', 'month', 'sprint', 'quarter', 'year']);
/** 0=Sunday..6=Saturday, matching Date#getUTCDay(). */
export const weekdaySchema = z.number().int().min(0).max(6);

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

/**
 * Mutual exclusivity: an Initiative is sized via Policy/Implementation size
 * labels OR a raw time estimate, never both. `null` explicitly clears a
 * field; `undefined` leaves it untouched.
 */
export const updateInitiativeSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1).optional(),
    notes: z.string().nullable().optional(),
    policySizeLabelId: idSchema.nullable().optional(),
    implementationSizeLabelId: idSchema.nullable().optional(),
    timeEstimateWeeks: z.number().positive().nullable().optional(),
  })
  .refine(
    (input) => {
      const settingSize = input.policySizeLabelId != null || input.implementationSizeLabelId != null;
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
});

export const renameSizingPhaseSchema = z.object({
  id: idSchema,
  name: z.string().min(1).optional(),
  unit: phaseUnitSchema.optional(),
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
