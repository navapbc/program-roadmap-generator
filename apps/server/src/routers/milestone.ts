import { z } from 'zod';
import { createMilestoneSchema, idSchema, nextOrderKey, reorderSchema, updateMilestoneSchema } from '@roadmap/shared';
import { publicProcedure, router } from '../trpc.js';

export const milestoneRouter = router({
  create: publicProcedure.input(createMilestoneSchema).mutation(async ({ ctx, input }) => {
    const last = await ctx.prisma.milestone.findFirst({
      where: { projectId: input.projectId },
      orderBy: { orderKey: 'desc' },
    });
    const orderKey = nextOrderKey(last?.orderKey ?? null, null);
    return ctx.prisma.milestone.create({
      data: { projectId: input.projectId, name: input.name, description: input.description, orderKey },
    });
  }),

  update: publicProcedure.input(updateMilestoneSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.prisma.milestone.update({ where: { id }, data });
  }),

  reorder: publicProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.milestone.update({ where: { id: input.id }, data: { orderKey: input.newOrderKey } });
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.milestone.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
