import { z } from 'zod';
import { createTimelineMarkerSchema, idSchema, updateTimelineMarkerSchema } from '@roadmap/shared';
import { publicProcedure, router } from '../trpc.js';

export const markerRouter = router({
  listForProject: publicProcedure.input(z.object({ projectId: idSchema })).query(({ ctx, input }) =>
    ctx.prisma.timelineMarker.findMany({ where: { projectId: input.projectId }, orderBy: { date: 'asc' } })
  ),

  create: publicProcedure.input(createTimelineMarkerSchema).mutation(({ ctx, input }) => ctx.prisma.timelineMarker.create({ data: input })),

  update: publicProcedure.input(updateTimelineMarkerSchema).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.prisma.timelineMarker.update({ where: { id }, data });
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.timelineMarker.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
