import { useEffect, useMemo, useRef } from 'react';
import {
  buildMilestoneBoundaries,
  computeFinalSize,
  computeTimeline,
  type PhaseUnit,
  type ScaleUnit,
  type TimelineInitiativeInput,
} from '@roadmap/shared';
import { trpc } from '../../trpc.js';
import GanttChart, { LABEL_COL_WIDTH } from '../timeline/GanttChart.js';
import { captureElementAsPng } from '../../lib/timelineScreenshot.js';
import { useZoom } from '../../hooks/useZoom.js';

interface SizeLabel {
  id: string;
  code: string;
  orderIndex: number;
}
interface Initiative {
  id: string;
  name: string;
  policySizeLabelId: string | null;
  implementationSizeLabelId: string | null;
  timeEstimateWeeks: number | null;
}
interface Increment {
  id: string;
  name: string;
  initiatives: Initiative[];
}
interface Milestone {
  id: string;
  name: string;
  increments: Increment[];
}
interface ProjectData {
  sizeLabels: SizeLabel[];
  milestones: Milestone[];
  startDate: string | Date | null;
  timelineHeaderScales: string[];
  sprintLengthBusinessDays: number | null;
  sprintStartWeekday: number | null;
}

/**
 * Renders one sizing key's Timeline off-screen (using the project's own
 * saved start date / header scales — this is a project-level export, not
 * tied to any interactive Timeline session) and reports back a captured
 * PNG once painted. Mounted one at a time by ExportWorkbookButton's queue.
 */
interface CapturedSnapshot {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
  description: string | null;
  labels: { code: string; orderIndex: number }[];
  phases: { name: string; unit: string; orderIndex: number; durations: { labelCode: string; durationValue: number }[] }[];
}

export default function ExportSizingKeySnapshot({
  project,
  sizingKeyId,
  onCaptured,
}: {
  project: ProjectData;
  sizingKeyId: string;
  onCaptured: (result: CapturedSnapshot) => void;
}) {
  const key = trpc.sizingKey.getFull.useQuery({ id: sizingKeyId });
  const captureRef = useRef<HTMLDivElement>(null);
  const hasCaptured = useRef(false);

  const startDate = project.startDate ? new Date(project.startDate) : null;

  const timeline = useMemo(() => {
    if (!key.data) return null;

    const sequence: TimelineInitiativeInput[] = project.milestones.flatMap((m) =>
      m.increments.flatMap((inc) =>
        inc.initiatives.map((init) => {
          const finalSize = computeFinalSize(project.sizeLabels, init.policySizeLabelId, init.implementationSizeLabelId);
          return {
            initiativeId: init.id,
            name: init.name,
            finalSizeCode: finalSize?.code ?? null,
            timeEstimateWeeks: init.timeEstimateWeeks,
          };
        })
      )
    );
    const phases = key.data.phases.map((p) => ({ id: p.id, name: p.name, unit: p.unit as PhaseUnit, orderIndex: p.orderIndex }));
    const durations = key.data.phases.flatMap((p) => p.durations.map((d) => ({ sizingPhaseId: p.id, labelCode: d.labelCode, durationValue: d.durationValue })));
    const result = computeTimeline({ sequence, phases, durations, startDate });
    const milestoneBoundaries = buildMilestoneBoundaries(project.milestones);
    return { result, milestoneBoundaries };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key.data]);

  const zoom = useZoom(timeline?.result.totalDurationWeeks || 1, LABEL_COL_WIDTH);

  useEffect(() => {
    if (!timeline || !captureRef.current || hasCaptured.current || !key.data) return;
    hasCaptured.current = true;
    requestAnimationFrame(() => {
      setTimeout(async () => {
        const png = await captureElementAsPng(captureRef.current!);
        onCaptured({
          ...png,
          name: key.data!.name,
          description: key.data!.description,
          labels: key.data!.labels,
          phases: key.data!.phases,
        });
      }, 50);
    });
  }, [timeline, onCaptured, key.data]);

  if (!timeline) return null;

  const sprintCadence =
    project.sprintLengthBusinessDays != null && project.sprintStartWeekday != null
      ? { lengthBusinessDays: project.sprintLengthBusinessDays, startWeekday: project.sprintStartWeekday }
      : null;

  return (
    <div ref={captureRef} style={{ width: 1100 }}>
      <GanttChart
        result={timeline.result}
        milestoneBoundaries={timeline.milestoneBoundaries}
        scales={project.timelineHeaderScales as ScaleUnit[]}
        startDate={startDate}
        sprintCadence={sprintCadence}
        zoom={zoom}
      />
    </div>
  );
}
