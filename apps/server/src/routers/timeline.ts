import {
  checkSizingKeyCompatibility,
  computeFinalSize,
  computeTimeline,
  computeTimelineInputSchema,
  type PhaseUnit,
  type TimelineDurationInput,
  type TimelineInitiativeInput,
  type TimelinePhaseInput,
} from '@roadmap/shared';
import { publicProcedure, router, TRPCError } from '../trpc.js';

export const timelineRouter = router({
  compute: publicProcedure.input(computeTimelineInputSchema).query(async ({ ctx, input }) => {
    const [project, sizingKey] = await Promise.all([
      ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        include: {
          sizeLabels: true,
          milestones: {
            orderBy: { orderKey: 'asc' },
            where: input.milestoneId ? { id: input.milestoneId } : undefined,
            include: {
              increments: {
                orderBy: { orderKey: 'asc' },
                include: { initiatives: { orderBy: { orderKey: 'asc' } } },
              },
            },
          },
        },
      }),
      ctx.prisma.sizingKey.findUnique({
        where: { id: input.sizingKeyId },
        include: { labels: true, phases: { orderBy: { orderIndex: 'asc' }, include: { durations: true } } },
      }),
    ]);

    if (!project) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    if (!sizingKey) throw new TRPCError({ code: 'NOT_FOUND', message: 'Sizing key not found' });

    const compatibility = checkSizingKeyCompatibility(
      project.sizeLabels.map((l) => l.code),
      sizingKey.labels.map((l) => l.code)
    );
    if (!compatibility.compatible) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Sizing key "${sizingKey.name}" has no data for size(s): ${compatibility.missingCodes.join(', ')}.`,
      });
    }

    const sequence: TimelineInitiativeInput[] = project.milestones.flatMap((milestone) =>
      milestone.increments.flatMap((increment) =>
        increment.initiatives.map((initiative) => {
          const finalSize = computeFinalSize(
            project.sizeLabels,
            initiative.policySizeLabelId,
            initiative.implementationSizeLabelId
          );
          return {
            initiativeId: initiative.id,
            name: initiative.name,
            finalSizeCode: finalSize?.code ?? null,
            timeEstimateWeeks: initiative.timeEstimateWeeks,
          };
        })
      )
    );

    const phases: TimelinePhaseInput[] = sizingKey.phases.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit as PhaseUnit,
      orderIndex: p.orderIndex,
    }));
    const durations: TimelineDurationInput[] = sizingKey.phases.flatMap((p) =>
      p.durations.map((d) => ({ sizingPhaseId: p.id, labelCode: d.labelCode, durationValue: d.durationValue }))
    );

    const startDate = input.startDateOverride !== undefined ? input.startDateOverride : project.startDate;

    const result = computeTimeline({ sequence, phases, durations, startDate });

    return {
      result,
      milestoneBoundaries: project.milestones.map((m) => ({
        milestoneId: m.id,
        name: m.name,
        initiativeIds: m.increments.flatMap((inc) => inc.initiatives.map((i) => i.id)),
      })),
    };
  }),
});
