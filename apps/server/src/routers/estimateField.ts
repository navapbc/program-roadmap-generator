import { z } from 'zod';
import { createEstimateFieldSchema, idSchema, RESERVED_ROADMAP_ROW_COLUMNS, renameEstimateFieldSchema } from '@roadmap/shared';
import { publicProcedure, router, TRPCError } from '../trpc.js';
import { buildTwoPhaseReorderOps, reinsertAfter } from '../orderIndexHelpers.js';

// Estimate field names become CSV/JSON export column headers — a field
// named e.g. "notes" or "project" would collide with a fixed roadmap-row
// column and corrupt that round trip, so those names are off-limits here.
const RESERVED_NAMES = new Set(RESERVED_ROADMAP_ROW_COLUMNS.map((c) => c.toLowerCase()));

function assertNotReserved(name: string) {
  if (RESERVED_NAMES.has(name.toLowerCase())) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `"${name}" is a reserved column name and can't be used for an estimate field.` });
  }
}

export const estimateFieldRouter = router({
  listForProject: publicProcedure.input(z.object({ projectId: idSchema })).query(async ({ ctx, input }) => {
    return ctx.prisma.estimateField.findMany({ where: { projectId: input.projectId }, orderBy: { orderIndex: 'asc' } });
  }),

  create: publicProcedure.input(createEstimateFieldSchema).mutation(async ({ ctx, input }) => {
    assertNotReserved(input.name);
    const existing = await ctx.prisma.estimateField.findMany({
      where: { projectId: input.projectId },
      orderBy: { orderIndex: 'asc' },
    });
    if (existing.some((f) => f.name === input.name)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `This project already has an estimate field named "${input.name}".` });
    }

    const created = await ctx.prisma.estimateField.create({
      data: { projectId: input.projectId, name: input.name, orderIndex: existing.length },
    });

    if (input.afterId) {
      const newOrder = reinsertAfter([...existing.map((f) => f.id), created.id], created.id, input.afterId);
      await applyOrder(ctx.prisma, newOrder);
    }

    return ctx.prisma.estimateField.findUniqueOrThrow({ where: { id: created.id } });
  }),

  reorder: publicProcedure
    .input(z.object({ id: idSchema, afterId: idSchema.nullable() }))
    .mutation(async ({ ctx, input }) => {
      const field = await ctx.prisma.estimateField.findUniqueOrThrow({ where: { id: input.id } });
      const siblings = await ctx.prisma.estimateField.findMany({
        where: { projectId: field.projectId },
        orderBy: { orderIndex: 'asc' },
      });
      const newOrder = reinsertAfter(siblings.map((f) => f.id), input.id, input.afterId);
      await applyOrder(ctx.prisma, newOrder);
      return { success: true };
    }),

  rename: publicProcedure.input(renameEstimateFieldSchema).mutation(async ({ ctx, input }) => {
    assertNotReserved(input.name);
    try {
      return await ctx.prisma.estimateField.update({ where: { id: input.id }, data: { name: input.name } });
    } catch {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Another estimate field in this project is already named "${input.name}".` });
    }
  }),

  // No in-use guard, unlike SizeLabel's delete: a field is a whole "column"
  // (e.g. "Policy") — removing it and every initiative's value for it is the
  // expected, spreadsheet-like behavior, not a destructive surprise the way
  // deleting a specific size value (e.g. "M") while initiatives are still
  // set to it would be. InitiativeEstimateValue cascades on delete.
  delete: publicProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => {
    const field = await ctx.prisma.estimateField.findUniqueOrThrow({ where: { id: input.id } });
    await ctx.prisma.estimateField.delete({ where: { id: input.id } });

    const remaining = await ctx.prisma.estimateField.findMany({
      where: { projectId: field.projectId },
      orderBy: { orderIndex: 'asc' },
    });
    await applyOrder(ctx.prisma, remaining.map((f) => f.id));
    return { success: true };
  }),
});

async function applyOrder(prisma: import('@prisma/client').PrismaClient, orderedIds: string[]) {
  await prisma.$transaction(buildTwoPhaseReorderOps(prisma.estimateField, orderedIds) as any);
}
