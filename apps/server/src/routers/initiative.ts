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
    const { id, estimateValues, timeEstimateWeeks, ...rest } = input;

    const settingSize = estimateValues?.some((v) => v.sizeLabelId != null) ?? false;
    const settingEstimate = timeEstimateWeeks != null;

    if (settingSize || settingEstimate) {
      const initiative = await ctx.prisma.initiative.findUniqueOrThrow({
        where: { id },
        include: { increment: { include: { milestone: true } } },
      });
      const projectId = initiative.increment.milestone.projectId;

      if (settingSize && estimateValues) {
        const labelIds = [...new Set(estimateValues.map((v) => v.sizeLabelId).filter((x): x is string => x != null))];
        const fieldIds = [...new Set(estimateValues.map((v) => v.estimateFieldId))];
        const [labels, fields] = await Promise.all([
          ctx.prisma.sizeLabel.findMany({ where: { id: { in: labelIds } } }),
          ctx.prisma.estimateField.findMany({ where: { id: { in: fieldIds } } }),
        ]);
        const foreignLabel = labels.some((l) => l.projectId !== projectId) || labels.length !== labelIds.length;
        const foreignField = fields.some((f) => f.projectId !== projectId) || fields.length !== fieldIds.length;
        if (foreignLabel || foreignField) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: "That size or estimate field doesn't belong to this initiative's project." });
        }
      }
    }

    const data: Record<string, unknown> = { ...rest };
    if (timeEstimateWeeks !== undefined) data.timeEstimateWeeks = timeEstimateWeeks;
    // Mutual exclusivity holds regardless of what the previous row state
    // was — setting one group always clears the other, since fields not
    // present in this call are otherwise left untouched (PATCH semantics).
    if (settingSize) data.timeEstimateWeeks = null;

    await ctx.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.initiative.update({ where: { id }, data });
      }
      if (settingEstimate) {
        await tx.initiativeEstimateValue.deleteMany({ where: { initiativeId: id } });
      }
      if (estimateValues) {
        for (const v of estimateValues) {
          if (v.sizeLabelId == null) {
            await tx.initiativeEstimateValue.deleteMany({ where: { initiativeId: id, estimateFieldId: v.estimateFieldId } });
          } else {
            await tx.initiativeEstimateValue.upsert({
              where: { initiativeId_estimateFieldId: { initiativeId: id, estimateFieldId: v.estimateFieldId } },
              create: { initiativeId: id, estimateFieldId: v.estimateFieldId, sizeLabelId: v.sizeLabelId },
              update: { sizeLabelId: v.sizeLabelId },
            });
          }
        }
      }
    });

    return ctx.prisma.initiative.findUniqueOrThrow({ where: { id }, include: { estimateValues: true } });
  }),

  reorder: publicProcedure.input(reorderSchema).mutation(async ({ ctx, input }) => {
    return ctx.prisma.initiative.update({ where: { id: input.id }, data: { orderKey: input.newOrderKey } });
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.initiative.delete({ where: { id: input.id } });
    return { success: true };
  }),
});
