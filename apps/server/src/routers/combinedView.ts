import { z } from 'zod';
import { createCombinedViewSchema, idSchema, initialOrderKeys, updateCombinedViewSchema } from '@roadmap/shared';
import { publicProcedure, router, TRPCError } from '../trpc.js';

function parseHeaderScales(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ['month', 'week'];
  } catch {
    return ['month', 'week'];
  }
}

function toCombinedViewDTO<T extends { timelineHeaderScales: string }>(view: T) {
  return { ...view, timelineHeaderScales: parseHeaderScales(view.timelineHeaderScales) };
}

const scopeInclude = { scopes: { orderBy: { orderKey: 'asc' as const } } };

export const combinedViewRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const views = await ctx.prisma.combinedView.findMany({ orderBy: { createdAt: 'asc' } });
    return views.map(toCombinedViewDTO);
  }),

  getById: publicProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const view = await ctx.prisma.combinedView.findUnique({ where: { id: input.id }, include: scopeInclude });
    if (!view) throw new TRPCError({ code: 'NOT_FOUND', message: 'Combined view not found' });
    return toCombinedViewDTO(view);
  }),

  create: publicProcedure.input(createCombinedViewSchema).mutation(async ({ ctx, input }) => {
    const orderKeys = initialOrderKeys(input.scopes.length);
    const view = await ctx.prisma.combinedView.create({
      data: {
        name: input.name,
        timelineHeaderScales: JSON.stringify(input.timelineHeaderScales ?? ['month', 'week']),
        dateRangeStart: input.dateRangeStart ?? null,
        dateRangeEnd: input.dateRangeEnd ?? null,
        scopes: {
          create: input.scopes.map((s, i) => ({
            projectId: s.projectId,
            milestoneId: s.milestoneId,
            incrementId: s.incrementId,
            sizingKeyId: s.sizingKeyId,
            startDateOverride: s.startDateOverride ?? null,
            orderKey: orderKeys[i],
          })),
        },
      },
      include: scopeInclude,
    });
    return toCombinedViewDTO(view);
  }),

  update: publicProcedure.input(updateCombinedViewSchema).mutation(async ({ ctx, input }) => {
    const { id, scopes, timelineHeaderScales, dateRangeStart, dateRangeEnd, ...rest } = input;

    const view = await ctx.prisma.$transaction(async (tx) => {
      if (scopes) {
        await tx.combinedViewScope.deleteMany({ where: { combinedViewId: id } });
      }
      return tx.combinedView.update({
        where: { id },
        data: {
          ...rest,
          ...(timelineHeaderScales ? { timelineHeaderScales: JSON.stringify(timelineHeaderScales) } : {}),
          ...(dateRangeStart !== undefined ? { dateRangeStart } : {}),
          ...(dateRangeEnd !== undefined ? { dateRangeEnd } : {}),
          ...(scopes
            ? {
                scopes: {
                  create: scopes.map((s, i) => ({
                    projectId: s.projectId,
                    milestoneId: s.milestoneId,
                    incrementId: s.incrementId,
                    sizingKeyId: s.sizingKeyId,
                    startDateOverride: s.startDateOverride ?? null,
                    orderKey: initialOrderKeys(scopes.length)[i],
                  })),
                },
              }
            : {}),
        },
        include: scopeInclude,
      });
    });
    return toCombinedViewDTO(view);
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.combinedView.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
