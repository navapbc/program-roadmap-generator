import { z } from 'zod';
import { checkSizingKeyCompatibility, createProjectSchema, idSchema, updateProjectSchema } from '@roadmap/shared';
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
});
