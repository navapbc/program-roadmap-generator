import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  buildMilestoneBoundaries,
  computeFinalSize,
  computeTimeline,
  dateRangeToWindow,
  isUsabilityCheckpointInitiative,
  type PhaseUnit,
  type ScaleUnit,
  type TimelineInitiativeInput,
} from '@roadmap/shared';
import { trpc } from '../trpc.js';
import SizingKeySelector from '../components/timeline/SizingKeySelector.js';
import ScaleToggleList from '../components/timeline/ScaleToggleList.js';
import GanttChart, { LABEL_COL_WIDTH } from '../components/timeline/GanttChart.js';
import { toCSV } from '../lib/csv.js';
import { downloadText } from '../lib/download.js';
import { buildTimelineCsvRows, TIMELINE_COLUMNS } from '../lib/timelineExport.js';
import { exportElementAsPdf } from '../lib/timelineScreenshot.js';
import { useZoom } from '../hooks/useZoom.js';

export default function TimelinePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const utils = trpc.useUtils();
  const project = trpc.project.getById.useQuery({ id: projectId! }, { enabled: !!projectId });
  const markerList = trpc.marker.listForProject.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const updateProject = trpc.project.update.useMutation({ onSuccess: () => utils.project.getById.invalidate() });

  const [sizingKeyId, setSizingKeyId] = useState<string | null>(null);
  const [startDateOverride, setStartDateOverride] = useState<string>('');
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

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
          const finalSize = computeFinalSize(
            project.data!.sizeLabels,
            init.estimateValues.map((v) => v.sizeLabelId),
            project.data!.finalSizeFormula as 'max' | 'min'
          );
          return {
            initiativeId: init.id,
            name: init.name,
            finalSizeCode: finalSize?.code ?? null,
            timeEstimateWeeks: init.timeEstimateWeeks,
            incrementId: inc.id,
            isUsabilityCheckpoint: selectedKey.data!.usabilityGateEnabled
              ? isUsabilityCheckpointInitiative(init.name, init.timeEstimateWeeks)
              : false,
          };
        })
      )
    );

    const phases = selectedKey.data.phases.map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit as PhaseUnit,
      orderIndex: p.orderIndex,
      canOverlap: p.canOverlap,
    }));
    const durations = selectedKey.data.phases.flatMap((p) =>
      p.durations.map((d) => ({ sizingPhaseId: p.id, labelCode: d.labelCode, durationValue: d.durationValue }))
    );

    const result = computeTimeline({ sequence, phases, durations, startDate, maxOverlap: selectedKey.data.maxOverlap });
    const milestoneBoundaries = buildMilestoneBoundaries(project.data.milestones);

    return { result, milestoneBoundaries };
    // startDate is derived fresh from startDateOverride each render on purpose —
    // this whole block must re-run with zero network calls on every keystroke/toggle.
  }, [project.data, selectedKey.data, startDateOverride]);

  const zoom = useZoom(timeline?.result.totalDurationWeeks || 1, LABEL_COL_WIDTH);

  if (project.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!project.data) return <p className="text-red-500">Project not found.</p>;
  const data = project.data;

  const headerScales = data.timelineHeaderScales as ScaleUnit[];
  function toggleScale(scale: ScaleUnit) {
    const next = headerScales.includes(scale) ? headerScales.filter((s) => s !== scale) : [...headerScales, scale];
    updateProject.mutate({ id: data.id, timelineHeaderScales: next });
  }

  const sprintCadence =
    data.sprintLengthBusinessDays != null && data.sprintStartWeekday != null
      ? { lengthBusinessDays: data.sprintLengthBusinessDays, startWeekday: data.sprintStartWeekday }
      : null;

  // A date range only means anything against a real calendar — with no
  // start date there's no origin to measure "current calendar year" etc.
  // against, so the window stays unbounded (no clipping/greying) until one
  // is set.
  const dateWindow = dateRangeToWindow(
    startDate,
    rangeStart ? new Date(rangeStart) : null,
    rangeEnd ? new Date(rangeEnd) : null
  );

  // Markers are real absolute dates — with no start date there's no origin
  // to place them against, so they're simply not shown (rather than guessed).
  const markers =
    startDate && markerList.data
      ? markerList.data.map((m) => ({
          id: m.id,
          label: m.label,
          offsetWeeks: (new Date(m.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7),
        }))
      : [];

  function exportTimelineCsv() {
    if (!timeline) return;
    const rows = buildTimelineCsvRows(data.name, data.milestones, timeline.result);
    downloadText(`${data.name}-timeline.csv`, 'text/csv', toCSV(rows, TIMELINE_COLUMNS));
  }

  async function exportTimelinePdf() {
    if (!chartRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportElementAsPdf(chartRef.current, `${data.name}-timeline.pdf`, `${data.name} — Timeline`);
    } finally {
      setIsExportingPdf(false);
    }
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
        {timeline && (
          <div className="flex gap-3 text-sm">
            <button className="text-slate-500 hover:text-slate-900" type="button" onClick={exportTimelineCsv}>
              Export CSV
            </button>
            <button
              className="text-slate-500 hover:text-slate-900 disabled:opacity-50"
              type="button"
              onClick={exportTimelinePdf}
              disabled={isExportingPdf}
            >
              {isExportingPdf ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        )}
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
          <ScaleToggleList
            selected={headerScales}
            hasStartDate={!!startDate}
            hasSprintCadence={!!sprintCadence}
            pixelsPerWeek={zoom.pixelsPerWeek}
            onToggle={toggleScale}
          />
        </div>
        {startDate && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Date range <span className="text-slate-400">(optional — only show this span)</span>
            </label>
            <div className="flex items-center gap-1">
              <input
                type="date"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
              />
              <span className="text-slate-400 text-sm">to</span>
              <input
                type="date"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
              />
              {(rangeStart || rangeEnd) && (
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-900 ml-1"
                  onClick={() => {
                    setRangeStart('');
                    setRangeEnd('');
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!sizingKeyId && <p className="text-slate-400">Choose a sizing key to generate the timeline.</p>}

      {timeline && (
        <div ref={chartRef}>
          <GanttChart
            result={timeline.result}
            milestoneBoundaries={timeline.milestoneBoundaries}
            scales={headerScales}
            startDate={startDate}
            sprintCadence={sprintCadence}
            markers={markers}
            zoom={zoom}
            dateWindow={dateWindow}
          />
        </div>
      )}
    </div>
  );
}
