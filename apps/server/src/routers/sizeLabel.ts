import { z } from 'zod';
import { createSizeLabelSchema, idSchema, renameSizeLabelSchema } from '@roadmap/shared';
import { publicProcedure, router, TRPCError } from '../trpc.js';
import { buildTwoPhaseReorderOps, reinsertAfter } from '../orderIndexHelpers.js';

export const sizeLabelRouter = router({
  listForProject: publicProcedure.input(z.object({ projectId: idSchema })).query(async ({ ctx, input }) => {
    return ctx.prisma.sizeLabel.findMany({ where: { projectId: input.projectId }, orderBy: { orderIndex: 'asc' } });
  }),

  create: publicProcedure.input(createSizeLabelSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.sizeLabel.findMany({
      where: { projectId: input.projectId },
      orderBy: { orderIndex: 'asc' },
    });
    if (existing.some((l) => l.code === input.code)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `This project already has a size labeled "${input.code}".` });
    }

    const created = await ctx.prisma.sizeLabel.create({
      data: { projectId: input.projectId, code: input.code, orderIndex: existing.length },
    });

    if (input.afterId) {
      const newOrder = reinsertAfter([...existing.map((l) => l.id), created.id], created.id, input.afterId);
      await applyOrder(ctx.prisma, newOrder);
    }

    return ctx.prisma.sizeLabel.findUniqueOrThrow({ where: { id: created.id } });
  }),

  reorder: publicProcedure
    .input(z.object({ id: idSchema, afterId: idSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const label = await ctx.prisma.sizeLabel.findUniqueOrThrow({ where: { id: input.id } });
      const siblings = await ctx.prisma.sizeLabel.findMany({
        where: { projectId: label.projectId },
        orderBy: { orderIndex: 'asc' },
      });
      const newOrder = reinsertAfter(siblings.map((l) => l.id), input.id, input.afterId);
      await applyOrder(ctx.prisma, newOrder);
      return { success: true };
    }),

  rename: publicProcedure.input(renameSizeLabelSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.prisma.sizeLabel.update({ where: { id: input.id }, data: { code: input.code } });
    } catch {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Another size in this project is already labeled "${input.code}".` });
    }
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const referencing = await ctx.prisma.initiativeEstimateValue.findMany({
      where: { sizeLabelId: input.id },
      include: { initiative: { select: { name: true } } },
    });
    if (referencing.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Can't delete this size — it's used by: ${referencing.map((r) => r.initiative.name).join(', ')}.`,
      });
    }

    const label = await ctx.prisma.sizeLabel.findUniqueOrThrow({ where: { id: input.id } });
    await ctx.prisma.sizeLabel.delete({ where: { id: input.id } });

    const remaining = await ctx.prisma.sizeLabel.findMany({
      where: { projectId: label.projectId },
      orderBy: { orderIndex: 'asc' },
    });
    await applyOrder(ctx.prisma, remaining.map((l) => l.id));
    return { success: true };
  }),
});

async function applyOrder(prisma: import('@prisma/client').PrismaClient, orderedIds: string[]) {
  await prisma.$transaction(buildTwoPhaseReorderOps(prisma.sizeLabel, orderedIds) as any);
}
