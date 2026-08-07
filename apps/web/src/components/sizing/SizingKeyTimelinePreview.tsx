import { computeTimeline, type PhaseUnit, type TimelineRow } from '@roadmap/shared';
import TimeScaleHeader from '../timeline/TimeScaleHeader.js';
import ZoomControl from '../timeline/ZoomControl.js';
import { useZoom } from '../../hooks/useZoom.js';

const PHASE_COLORS = ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-violet-400'];
const LABEL_COL_WIDTH = 96; // px — just the size code, narrower than the Timeline's initiative-name column

interface Label {
  id: string;
  code: string;
  orderIndex: number;
}
interface Phase {
  id: string;
  name: string;
  unit: string;
  orderIndex: number;
  durations: { labelCode: string; durationValue: number }[];
}

/**
 * Mirrors the source spreadsheet's "T-shirt size key" tab: one row per
 * size, each split into its phase segments so you can see at a glance how
 * the phases stack up across the whole size range. There's no project or
 * start date at this level, so it's always relative ("Week 1, Week 2…") —
 * reuses the exact same computeTimeline() the real Timeline runs, just
 * with one synthetic single-phase-sequence "initiative" per size so each
 * row starts at week 0 independently instead of chaining sequentially.
 */
export default function SizingKeyTimelinePreview({ labels, phases }: { labels: Label[]; phases: Phase[] }) {
  const zoom = useZoom();

  const sortedLabels = [...labels].sort((a, b) => a.orderIndex - b.orderIndex);
  const sortedPhases = [...phases]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((p) => ({ id: p.id, name: p.name, unit: p.unit as PhaseUnit, orderIndex: p.orderIndex }));
  const durations = phases.flatMap((p) => p.durations.map((d) => ({ sizingPhaseId: p.id, labelCode: d.labelCode, durationValue: d.durationValue })));

  if (sortedLabels.length === 0 || sortedPhases.length === 0) {
    return <p className="text-sm text-slate-400">Add at least one size label and one phase to preview the timeline.</p>;
  }

  const rows: TimelineRow[] = sortedLabels.map((label) => {
    const result = computeTimeline({
      sequence: [{ initiativeId: label.id, name: label.code, finalSizeCode: label.code, timeEstimateWeeks: null }],
      phases: sortedPhases,
      durations,
      startDate: null,
    });
    return result.rows[0];
  });

  const phaseNames = [...new Set(rows.flatMap((r) => r.segments.map((s) => s.phaseName)))];
  const colorByPhase = new Map(phaseNames.map((name, i) => [name, PHASE_COLORS[i % PHASE_COLORS.length]]));

  const total = Math.max(1, ...rows.map((r) => r.totalDurationWeeks));
  const chartWidth = total * zoom.pixelsPerWeek;

  return (
    <div>
      <div className="flex justify-end mb-2">
        <ZoomControl
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onReset={zoom.reset}
          canZoomIn={zoom.canZoomIn}
          canZoomOut={zoom.canZoomOut}
        />
      </div>

      <div className="border border-slate-200 rounded-md overflow-x-auto bg-white">
        <div style={{ width: LABEL_COL_WIDTH + chartWidth, minWidth: '100%' }}>
          <div className="flex">
            <div className="sticky left-0 z-20 flex-shrink-0 border-r border-slate-200 bg-slate-50" style={{ width: LABEL_COL_WIDTH }} />
            <div style={{ width: chartWidth }}>
              <TimeScaleHeader scales={['week', 'day']} startDate={null} totalDurationWeeks={total} pixelsPerWeek={zoom.pixelsPerWeek} />
            </div>
          </div>

          {sortedLabels.map((label, i) => (
            <div key={label.id} className="flex border-t border-slate-100 items-center">
              <div
                className="sticky left-0 z-20 flex-shrink-0 px-3 py-2 text-sm font-medium text-slate-800 bg-white"
                style={{ width: LABEL_COL_WIDTH }}
              >
                {label.code}
              </div>
              <div className="relative h-8" style={{ width: chartWidth }}>
                {rows[i].segments.map((seg, j) => (
                  <div
                    key={j}
                    className={`absolute inset-y-1.5 rounded-sm ${colorByPhase.get(seg.phaseName) ?? 'bg-slate-400'}`}
                    style={{
                      left: `${seg.startOffsetWeeks * zoom.pixelsPerWeek}px`,
                      width: `${Math.max(seg.durationWeeks * zoom.pixelsPerWeek, 2)}px`,
                    }}
                    title={`${seg.phaseName}: ${seg.displayDuration} ${seg.unitName}${seg.displayDuration === 1 ? '' : 's'}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 px-3 py-2 border border-t-0 border-slate-200 rounded-b-md bg-slate-50 text-xs text-slate-500">
        {phaseNames.map((name) => (
          <span key={name} className="flex items-center gap-1">
            <span className={`inline-block w-3 h-3 rounded-sm ${colorByPhase.get(name)}`} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
