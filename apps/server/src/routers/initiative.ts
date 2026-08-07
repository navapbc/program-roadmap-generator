import { z } from 'zod';
import { createInitiativeSchema, idSchema, nextOrderKey, reorderSchema, updateInitiativeSchema } from '@roadmap/shared';
import { publicProcedure, router, TRPCError } from '../trpc.js';

export const initiativeRouter = router({
  create: publicProcedure.input(createInitiativeSchema).mutation(async ({ ctx, input }) => {
    const last = await ctx.prisma.initiative.findFirst({
      where: { incrementId: input.incrementId },
      orderBy: { orderKey: 'desc' },
    });
    const orderKey = nextOrderKey(last?.orderKey ?? null, null);
    return ctx.prisma.initiative.create({
      data: { incrementId: input.incrementId, name: input.name, orderKey },
    });
  }),

  update: publicProcedure.input(updateInitiativeSchema).mutation(async ({ ctx, input }) => {
    const { id, policySizeLabelId, implementationSizeLabelId, timeEstimateWeeks, ...rest } = input;

    const settingSize = policySizeLabelId != null || implementationSizeLabelId != null;
    const settingEstimate = timeEstimateWeeks != null;

    if (settingSize || settingEstimate) {
      const initiative = await ctx.prisma.initiative.findUniqueOrThrow({
        where: { id },
        include: { increment: { include: { milestone: true } } },
      });
      const projectId = initiative.increment.milestone.projectId;

      if (settingSize) {
        // Policy and implementation are often set to the same label — dedupe
        // before comparing counts, since findMany naturally returns one row
        // per matching id regardless of how many times it appears in `in`.
        const idsToCheck = [...new Set([policySizeLabelId, implementationSizeLabelId].filter((x): x is string => x != null))];
        const labels = await ctx.prisma.sizeLabel.findMany({ where: { id: { in: idsToCheck } } });
        const foreign = labels.filter((l) => l.projectId !== projectId);
        if (foreign.length > 0 || labels.length !== idsToCheck.length) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: "That size doesn't belong to this initiative's project." });
        }
      }
    }

    const data: Record<string, unknown> = { ...rest };
    if (policySizeLabelId !== undefined) data.policySizeLabelId = policySizeLabelId;
    if (implementationSizeLabelId !== undefined) data.implementationSizeLabelId = implementationSizeLabelId;
    if (timeEstimateWeeks !== undefined) data.timeEstimateWeeks = timeEstimateWeeks;

    // Mutual exclusivity holds regardless of what the previous row state
    // was — setting one group always clears the other, since fields not
    // present in this call are otherwise left untouched (PATCH semantics).
    if (settingSize) {
      data.timeEstimateWeeks = null;
    }
    if (settingEstimate) {
      data.policySizeLabelId = null;
      data.implementationSizeLabelId = null;
    }

    return ctx.prisma.initiative.update({ where: { id }, data });
  }),

  reorder: publicProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.initiative.update({ where: { id: input.id }, data: { orderKey: input.newOrderKey } });
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.initiative.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
