import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { computeFinalSize, computeTimeline, type PhaseUnit, type ScaleUnit, type TimelineInitiativeInput } from '@roadmap/shared';
import { trpc } from '../trpc.js';
import SizingKeySelector from '../components/timeline/SizingKeySelector.js';
import ScaleToggleList from '../components/timeline/ScaleToggleList.js';
import GanttChart from '../components/timeline/GanttChart.js';

export default function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const utils = trpc.useUtils();
  const project = trpc.project.getById.useQuery({ id: projectId! }, { enabled: !!projectId });
  const updateProject = trpc.project.update.useMutation({ onSuccess: () => utils.project.getById.invalidate() });

  const [sizingKeyId, setSizingKeyId] = useState<string | null>(null);
  const [startDateOverride, setStartDateOverride] = useState<string>('');

  useEffect(() => {
    if (project.data?.defaultSizingKeyId && sizingKeyId === null) {
      setSizingKeyId(project.data.defaultSizingKeyId);
    }
    if (project.data?.startDate && startDateOverride === '') {
      setStartDateOverride(new Date(project.data.startDate).toISOString().slice(0, 10));
    }
  }, [project.data]);

  // Fetched once per sizing key and cached by react-query — switching back
  // to a key already visited this session costs zero network requests.
  // The actual schedule is computed with the shared computeTimeline() call
  // below, directly in the browser: swapping keys or the start date never
  // re-hits the server, it just re-runs the same pure function locally.
  const selectedKey = trpc.sizingKey.getFull.useQuery({ id: sizingKeyId! }, { enabled: !!sizingKeyId });

  const startDate = startDateOverride ? new Date(startDateOverride) : null;

  const timeline = useMemo(() => {
    if (!project.data || !selectedKey.data) return null;

    const sequence: TimelineInitiativeInput[] = project.data.milestones.flatMap((m) =>
      m.increments.flatMap((inc) =>
        inc.initiatives.map((init) => {
          const finalSize = computeFinalSize(project.data!.sizeLabels, init.policySizeLabelId, init.implementationSizeLabelId);
          return {
            initiativeId: init.id,
            name: init.name,
            finalSizeCode: finalSize?.code ?? null,
            timeEstimateWeeks: init.timeEstimateWeeks,
          };
        })
      )
    );

    const phases = selectedKey.data.phases.map((p) => ({ id: p.id, name: p.name, unit: p.unit as PhaseUnit, orderIndex: p.orderIndex }));
    const durations = selectedKey.data.phases.flatMap((p) =>
      p.durations.map((d) => ({ sizingPhaseId: p.id, labelCode: d.labelCode, durationValue: d.durationValue }))
    );

    const result = computeTimeline({ sequence, phases, durations, startDate });
    const milestoneBoundaries = project.data.milestones.map((m) => ({
      milestoneId: m.id,
      name: m.name,
      initiativeIds: m.increments.flatMap((inc) => inc.initiatives.map((i) => i.id)),
    }));

    return { result, milestoneBoundaries };
    // startDate is derived fresh from startDateOverride each render on purpose —
    // this whole block must re-run with zero network calls on every keystroke/toggle.
  }, [project.data, selectedKey.data, startDateOverride]);

  if (project.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!project.data) return <p className="text-red-500">Project not found.</p>;
  const data = project.data;

  const headerScales = data.timelineHeaderScales as ScaleUnit[];
  function toggleScale(scale: ScaleUnit) {
    const next = headerScales.includes(scale) ? headerScales.filter((s) => s !== scale) : [...headerScales, scale];
    updateProject.mutate({ id: data.id, timelineHeaderScales: next });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link to={`/projects/${data.id}`} className="text-sm text-slate-500 hover:text-slate-900">
            ← {data.name}
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">Timeline</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-6 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Sizing key</label>
          <SizingKeySelector projectId={data.id} value={sizingKeyId} onChange={setSizingKeyId} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Start date <span className="text-slate-400">(preview only, not saved)</span>
          </label>
          <input
            type="date"
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={startDateOverride}
            onChange={(e) => setStartDateOverride(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Header scales</label>
          <ScaleToggleList selected={headerScales} hasStartDate={!!startDate} onToggle={toggleScale} />
        </div>
      </div>

      {!sizingKeyId && <p className="text-slate-400">Choose a sizing key to generate the timeline.</p>}

      {timeline && (
        <GanttChart
          result={timeline.result}
          milestoneBoundaries={timeline.milestoneBoundaries}
          scales={headerScales}
          startDate={startDate}
        />
      )}
    </div>
  );
}
