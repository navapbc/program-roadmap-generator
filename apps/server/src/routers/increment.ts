import { z } from 'zod';
import { createIncrementSchema, idSchema, nextOrderKey, reorderSchema, updateIncrementSchema } from '@roadmap/shared';
import { publicProcedure, router } from '../trpc.js';

export const incrementRouter = router({
  create: publicProcedure.input(createIncrementSchema).mutation(async ({ ctx, input }) => {
    const last = await ctx.prisma.increment.findFirst({
      where: { milestoneId: input.milestoneId },
      orderBy: { orderKey: 'desc' },
    });
    const orderKey = nextOrderKey(last?.orderKey ?? null, null);
    return ctx.prisma.increment.create({
      data: { milestoneId: input.milestoneId, name: input.name, description: input.description, orderKey },
    });
  }),

  update: publicProcedure.input(updateIncrementSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.prisma.increment.update({ where: { id }, data });
  }),

  // Reordering an Increment as a block only ever writes Increment.orderKey —
  // it never touches any Initiative row, so nested initiative order can't
  // be disturbed by this call.
  reorder: publicProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.increment.update({ where: { id: input.id }, data: { orderKey: input.newOrderKey } });
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.increment.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
