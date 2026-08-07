import { z } from 'zod';
import {
  checkSizingKeyCompatibility,
  createProjectSchema,
  idSchema,
  importRoadmapSchema,
  initialOrderKeys,
  updateProjectSchema,
} from '@roadmap/shared';
import { publicProcedure, router, TRPCError } from '../trpc.js';

function parseHeaderScales(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ['month', 'week'];
  } catch {
    return ['month', 'week'];
  }
}

function toProjectDTO<T extends { timelineHeaderScales: string }>(project: T) {
  return { ...project, timelineHeaderScales: parseHeaderScales(project.timelineHeaderScales) };
}

export const projectRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const projects = await ctx.prisma.project.findMany({ orderBy: { createdAt: 'asc' } });
    return projects.map(toProjectDTO);
  }),

  getById: publicProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const project = await ctx.prisma.project.findUnique({
      where: { id: input.id },
      include: {
        sizeLabels: { orderBy: { orderIndex: 'asc' } },
        milestones: {
          orderBy: { orderKey: 'asc' },
          include: {
            increments: {
              orderBy: { orderKey: 'asc' },
              include: { initiatives: { orderBy: { orderKey: 'asc' } } },
            },
          },
        },
      },
    });
    if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    return toProjectDTO(project);
  }),

  create: publicProcedure.input(createProjectSchema).mutation(async ({ ctx, input }) => {
    const project = await ctx.prisma.project.create({ data: input });
    return toProjectDTO(project);
  }),

  update: publicProcedure.input(updateProjectSchema).mutation(async ({ ctx, input }) => {
    const { id, timelineHeaderScales, defaultSizingKeyId, sprintLengthBusinessDays, sprintStartWeekday, ...rest } = input;

    if (sprintLengthBusinessDays !== undefined || sprintStartWeekday !== undefined) {
      const current = await ctx.prisma.project.findUniqueOrThrow({
        where: { id },
        select: { sprintLengthBusinessDays: true, sprintStartWeekday: true },
      });
      const mergedLength = sprintLengthBusinessDays !== undefined ? sprintLengthBusinessDays : current.sprintLengthBusinessDays;
      const mergedWeekday = sprintStartWeekday !== undefined ? sprintStartWeekday : current.sprintStartWeekday;
      if ((mergedLength == null) !== (mergedWeekday == null)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Set both a sprint length and a start weekday, or clear both.',
        });
      }
    }

    if (defaultSizingKeyId) {
      const [projectLabels, key] = await Promise.all([
        ctx.prisma.sizeLabel.findMany({ where: { projectId: id } }),
        ctx.prisma.sizingKey.findUnique({ where: { id: defaultSizingKeyId }, include: { labels: true } }),
      ]);
      if (!key) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sizing key not found' });
      const result = checkSizingKeyCompatibility(
        projectLabels.map((l) => l.code),
        key.labels.map((l) => l.code)
      );
      if (!result.compatible) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Sizing key "${key.name}" has no data for size(s): ${result.missingCodes.join(', ')}. Add those labels to the key before selecting it here.`,
        });
      }
    }

    const project = await ctx.prisma.project.update({
      where: { id },
      data: {
        ...rest,
        ...(defaultSizingKeyId !== undefined ? { defaultSizingKeyId } : {}),
        ...(timelineHeaderScales ? { timelineHeaderScales: JSON.stringify(timelineHeaderScales) } : {}),
        ...(sprintLengthBusinessDays !== undefined ? { sprintLengthBusinessDays } : {}),
        ...(sprintStartWeekday !== undefined ? { sprintStartWeekday } : {}),
      },
    });
    return toProjectDTO(project);
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.project.delete({ where: { id: input.id } });
    return { success: true };
  }),

  // Always creates a brand-new project from a previously-exported roadmap
  // file — never updates or merges into an existing one, and never
  // tolerates a name collision (the caller must supply a name that isn't
  // already taken; the client is expected to prompt for a different one on
  // BAD_REQUEST rather than this endpoint silently renaming anything).
  importRoadmap: publicProcedure.input(importRoadmapSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.project.findFirst({ where: { name: input.name } });
    if (existing) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `A project named "${input.name}" already exists. Choose a different name.`,
      });
    }

    interface GroupedInitiative {
      name: string;
      policyCode: string | null;
      implementationCode: string | null;
      timeEstimateWeeks: number | null;
      notes: string | null;
    }
    interface GroupedIncrement {
      name: string;
      initiatives: GroupedInitiative[];
    }
    interface GroupedMilestone {
      name: string;
      increments: Map<string, GroupedIncrement>;
    }

    // Groups rows into Milestone -> Increment -> Initiative[], preserving
    // each name's first-appearance order. Since the project is always new,
    // there's never an existing row to match against — "first time we see
    // this milestone/increment name" is the only lookup this needs.
    const milestones = new Map<string, GroupedMilestone>();
    const sizeCodes: string[] = [];
    const warnings: string[] = [];

    for (const row of input.rows) {
      const policyCode = row.policySize?.trim() || null;
      const implementationCode = row.implementationSize?.trim() || null;
      for (const code of [policyCode, implementationCode]) {
        if (code && !sizeCodes.includes(code)) sizeCodes.push(code);
      }

      let timeEstimateWeeks: number | null = null;
      const rawEstimate = row.timeEstimateWeeks?.trim();
      if (rawEstimate) {
        const parsed = Number(rawEstimate);
        if (Number.isFinite(parsed) && parsed > 0) timeEstimateWeeks = parsed;
      }
      if ((policyCode || implementationCode) && timeEstimateWeeks != null) {
        warnings.push(`"${row.initiative}" had both a size and a time estimate — kept the size, ignored the time estimate.`);
        timeEstimateWeeks = null;
      }

      let milestone = milestones.get(row.milestone);
      if (!milestone) {
        milestone = { name: row.milestone, increments: new Map() };
        milestones.set(row.milestone, milestone);
      }
      let increment = milestone.increments.get(row.increment);
      if (!increment) {
        increment = { name: row.increment, initiatives: [] };
        milestone.increments.set(row.increment, increment);
      }
      increment.initiatives.push({
        name: row.initiative,
        policyCode,
        implementationCode,
        timeEstimateWeeks,
        notes: row.notes?.trim() ? row.notes.trim() : null,
      });
    }

    const projectId = await ctx.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data: { name: input.name } });

      const labelIdByCode = new Map<string, string>();
      for (let i = 0; i < sizeCodes.length; i++) {
        const label = await tx.sizeLabel.create({ data: { projectId: project.id, code: sizeCodes[i], orderIndex: i } });
        labelIdByCode.set(sizeCodes[i], label.id);
      }

      const milestoneList = [...milestones.values()];
      const milestoneKeys = initialOrderKeys(milestoneList.length);
      for (let m = 0; m < milestoneList.length; m++) {
        const milestone = await tx.milestone.create({
          data: { projectId: project.id, name: milestoneList[m].name, orderKey: milestoneKeys[m] },
        });

        const incrementList = [...milestoneList[m].increments.values()];
        const incrementKeys = initialOrderKeys(incrementList.length);
        for (let inc = 0; inc < incrementList.length; inc++) {
          const increment = await tx.increment.create({
            data: { milestoneId: milestone.id, name: incrementList[inc].name, orderKey: incrementKeys[inc] },
          });

          const initiatives = incrementList[inc].initiatives;
          const initiativeKeys = initialOrderKeys(initiatives.length);
          for (let n = 0; n < initiatives.length; n++) {
            const initiative = initiatives[n];
            await tx.initiative.create({
              data: {
                incrementId: increment.id,
                name: initiative.name,
                orderKey: initiativeKeys[n],
                policySizeLabelId: initiative.policyCode ? labelIdByCode.get(initiative.policyCode) : null,
                implementationSizeLabelId: initiative.implementationCode
                  ? labelIdByCode.get(initiative.implementationCode)
                  : null,
                timeEstimateWeeks: initiative.timeEstimateWeeks,
                notes: initiative.notes,
              },
            });
          }
        }
      }

      return project.id;
    });

    return { projectId, warnings };
  }),
});
