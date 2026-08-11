import { z } from 'zod';
import {
  addSizingKeyLabelSchema,
  addSizingPhaseSchema,
  checkSizingKeyCompatibility,
  createCompatibleSizingKeySchema,
  createSizingKeySchema,
  duplicateSizingKeySchema,
  idSchema,
  renameSizingKeyLabelSchema,
  renameSizingPhaseSchema,
  setSizingDurationSchema,
  updateSizingKeySchema,
} from '@roadmap/shared';
import { publicProcedure, router, TRPCError } from '../trpc.js';
import { buildTwoPhaseReorderOps, reinsertAfter } from '../orderIndexHelpers.js';

export const sizingKeyRouter = router({
  list: publicProcedure.query(({ ctx }) => ctx.prisma.sizingKey.findMany({ orderBy: { createdAt: 'asc' } })),

  listWithCompatibility: publicProcedure
    .input(z.object({ projectId: idSchema }))
    .query(async ({ ctx, input }) => {
      const [projectLabels, keys] = await Promise.all([
        ctx.prisma.sizeLabel.findMany({ where: { projectId: input.projectId } }),
        ctx.prisma.sizingKey.findMany({ include: { labels: true }, orderBy: { createdAt: 'asc' } }),
      ]);
      const projectCodes = projectLabels.map((l) => l.code);
      return keys.map((key) => ({
        ...key,
        ...checkSizingKeyCompatibility(projectCodes, key.labels.map((l) => l.code)),
      }));
    }),

  getFull: publicProcedure.input(z.object({ id: idSchema })).query(async ({ ctx, input }) => {
    const key = await ctx.prisma.sizingKey.findUnique({
      where: { id: input.id },
      include: {
        labels: { orderBy: { orderIndex: 'asc' } },
        phases: { orderBy: { orderIndex: 'asc' }, include: { durations: true } },
      },
    });
    if (!key) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sizing key not found' });
    return key;
  }),

  create: publicProcedure.input(createSizingKeySchema).mutation(({ ctx, input }) => ctx.prisma.sizingKey.create({ data: input })),

  update: publicProcedure.input(updateSizingKeySchema).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.prisma.sizingKey.update({ where: { id }, data });
  }),

  duplicate: publicProcedure.input(duplicateSizingKeySchema).mutation(async ({ ctx, input }) => {
    const source = await ctx.prisma.sizingKey.findUnique({
      where: { id: input.id },
      include: { labels: true, phases: { include: { durations: true } } },
    });
    if (!source) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sizing key not found' });

    return ctx.prisma.sizingKey.create({
      data: {
        name: input.newName,
        description: source.description,
        maxOverlap: source.maxOverlap,
        labels: { create: source.labels.map((l) => ({ code: l.code, orderIndex: l.orderIndex })) },
        phases: {
          create: source.phases.map((p) => ({
            name: p.name,
            unit: p.unit,
            orderIndex: p.orderIndex,
            canOverlap: p.canOverlap,
            durations: { create: p.durations.map((d) => ({ labelCode: d.labelCode, durationValue: d.durationValue })) },
          })),
        },
      },
    });
  }),

  // Seeds the new key's own label list from the project's current labels so
  // it's compatible immediately — the whole point of the "create a
  // compatible key" shortcut is skipping the "add every label by hand" step.
  createCompatible: publicProcedure.input(createCompatibleSizingKeySchema).mutation(async ({ ctx, input }) => {
    const projectLabels = await ctx.prisma.sizeLabel.findMany({
      where: { projectId: input.projectId },
      orderBy: { orderIndex: 'asc' },
    });
    return ctx.prisma.sizingKey.create({
      data: {
        name: input.name,
        labels: { create: projectLabels.map((l) => ({ code: l.code, orderIndex: l.orderIndex })) },
      },
    });
  }),

  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    await ctx.prisma.sizingKey.delete({ where: { id: input.id } });
    return { success: true };
  }),

  addLabel: publicProcedure.input(addSizingKeyLabelSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.sizingKeyLabel.findMany({
      where: { sizingKeyId: input.sizingKeyId },
      orderBy: { orderIndex: 'asc' },
    });
    if (existing.some((l) => l.code === input.code)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `This key already has a size labeled "${input.code}".` });
    }
    const created = await ctx.prisma.sizingKeyLabel.create({
      data: { sizingKeyId: input.sizingKeyId, code: input.code, orderIndex: existing.length },
    });
    if (input.afterId) {
      const newOrder = reinsertAfter([...existing.map((l) => l.id), created.id], created.id, input.afterId);
      await ctx.prisma.$transaction(buildTwoPhaseReorderOps(ctx.prisma.sizingKeyLabel, newOrder) as any);
    }
    return ctx.prisma.sizingKeyLabel.findUniqueOrThrow({ where: { id: created.id } });
  }),

  reorderLabel: publicProcedure
    .input(z.object({ id: idSchema, afterId: idSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const label = await ctx.prisma.sizingKeyLabel.findUniqueOrThrow({ where: { id: input.id } });
      const siblings = await ctx.prisma.sizingKeyLabel.findMany({
        where: { sizingKeyId: label.sizingKeyId },
        orderBy: { orderIndex: 'asc' },
      });
      const newOrder = reinsertAfter(siblings.map((l) => l.id), input.id, input.afterId);
      await ctx.prisma.$transaction(buildTwoPhaseReorderOps(ctx.prisma.sizingKeyLabel, newOrder) as any);
      return { success: true };
    }),

  renameLabel: publicProcedure.input(renameSizingKeyLabelSchema).mutation(async ({ ctx, input }) => {
    try {
      return await ctx.prisma.sizingKeyLabel.update({ where: { id: input.id }, data: { code: input.code } });
    } catch {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Another size in this key is already labeled "${input.code}".` });
    }
  }),

  deleteLabel: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const label = await ctx.prisma.sizingKeyLabel.findUniqueOrThrow({ where: { id: input.id } });
    await ctx.prisma.$transaction([
      ctx.prisma.sizingDuration.deleteMany({
        where: { labelCode: label.code, sizingPhase: { sizingKeyId: label.sizingKeyId } },
      }),
      ctx.prisma.sizingKeyLabel.delete({ where: { id: input.id } }),
    ]);
    const remaining = await ctx.prisma.sizingKeyLabel.findMany({
      where: { sizingKeyId: label.sizingKeyId },
      orderBy: { orderIndex: 'asc' },
    });
    await ctx.prisma.$transaction(
      buildTwoPhaseReorderOps(ctx.prisma.sizingKeyLabel, remaining.map((l) => l.id)) as any
    );
    return { success: true };
  }),

  addPhase: publicProcedure.input(addSizingPhaseSchema).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.sizingPhase.findMany({
      where: { sizingKeyId: input.sizingKeyId },
      orderBy: { orderIndex: 'asc' },
    });
    const created = await ctx.prisma.sizingPhase.create({
      data: {
        sizingKeyId: input.sizingKeyId,
        name: input.name,
        unit: input.unit,
        orderIndex: existing.length,
        canOverlap: input.canOverlap,
      },
    });
    if (input.afterId) {
      const newOrder = reinsertAfter([...existing.map((p) => p.id), created.id], created.id, input.afterId);
      await ctx.prisma.$transaction(buildTwoPhaseReorderOps(ctx.prisma.sizingPhase, newOrder) as any);
    }
    return ctx.prisma.sizingPhase.findUniqueOrThrow({ where: { id: created.id } });
  }),

  reorderPhase: publicProcedure
    .input(z.object({ id: idSchema, afterId: idSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const phase = await ctx.prisma.sizingPhase.findUniqueOrThrow({ where: { id: input.id } });
      const siblings = await ctx.prisma.sizingPhase.findMany({
        where: { sizingKeyId: phase.sizingKeyId },
        orderBy: { orderIndex: 'asc' },
      });
      const newOrder = reinsertAfter(siblings.map((p) => p.id), input.id, input.afterId);
      await ctx.prisma.$transaction(buildTwoPhaseReorderOps(ctx.prisma.sizingPhase, newOrder) as any);
      return { success: true };
    }),

  renamePhase: publicProcedure.input(renameSizingPhaseSchema).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.prisma.sizingPhase.update({ where: { id }, data });
  }),

  deletePhase: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const phase = await ctx.prisma.sizingPhase.findUniqueOrThrow({ where: { id: input.id } });
    await ctx.prisma.sizingPhase.delete({ where: { id: input.id } });
    const remaining = await ctx.prisma.sizingPhase.findMany({
      where: { sizingKeyId: phase.sizingKeyId },
      orderBy: { orderIndex: 'asc' },
    });
    await ctx.prisma.$transaction(buildTwoPhaseReorderOps(ctx.prisma.sizingPhase, remaining.map((p) => p.id)) as any);
    return { success: true };
  }),

  setDuration: publicProcedure.input(setSizingDurationSchema).mutation(({ ctx, input }) =>
    ctx.prisma.sizingDuration.upsert({
      where: { sizingPhaseId_labelCode: { sizingPhaseId: input.sizingPhaseId, labelCode: input.labelCode } },
      create: input,
      update: { durationValue: input.durationValue },
    })
  ),
});
