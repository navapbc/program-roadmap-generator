import type { ScaleUnit, SprintCadence } from '@roadmap/shared';
import TimeScaleHeader from './TimeScaleHeader.js';
import ZoomControl from './ZoomControl.js';
import { MarkerLabelsRow, MarkerLines, type MarkerTick } from './TimelineMarkers.js';
import { useZoom } from '../../hooks/useZoom.js';

const PHASE_COLORS = ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-violet-400'];
const LABEL_COL_WIDTH = 224; // px, matches w-56

interface MilestoneBoundary {
  milestoneId: string;
  name: string;
  initiativeIds: string[];
}

// Mirrors TimelineResult, but with startDate/endDate typed as they actually
// arrive over the wire (JSON — no superjson transformer configured, so
// Dates degrade to ISO strings). Only numeric offset/duration fields are
// used for rendering; the date fields aren't read here at all.
interface TimelineSegmentDTO {
  phaseId: string | null;
  phaseName: string;
  unitName: string;
  displayDuration: number;
  startOffsetWeeks: number;
  durationWeeks: number;
}
interface TimelineRowDTO {
  initiativeId: string;
  name: string;
  kind: 'sized' | 'time-estimate' | 'unresolved';
  startOffsetWeeks: number;
  totalDurationWeeks: number;
  segments: TimelineSegmentDTO[];
  warning?: 'missing-size' | 'missing-duration';
}
interface TimelineResultDTO {
  rows: TimelineRowDTO[];
  totalDurationWeeks: number;
}

export default function GanttChart({
  result,
  milestoneBoundaries,
  scales,
  startDate,
  sprintCadence,
  markers = [],
}: {
  result: TimelineResultDTO;
  milestoneBoundaries: MilestoneBoundary[];
  scales: ScaleUnit[];
  startDate: Date | null;
  sprintCadence?: SprintCadence | null;
  markers?: MarkerTick[];
}) {
  const zoom = useZoom();
  const phaseNames = [...new Set(result.rows.flatMap((r) => r.segments.map((s) => s.phaseName)))];
  const colorByPhase = new Map(phaseNames.map((name, i) => [name, PHASE_COLORS[i % PHASE_COLORS.length]]));

  const rowsByInitiativeId = new Map(result.rows.map((r) => [r.initiativeId, r]));
  const total = result.totalDurationWeeks || 1;
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
        <div className="relative" style={{ width: LABEL_COL_WIDTH + chartWidth, minWidth: '100%' }}>
          <div className="flex">
            <div
              className="sticky left-0 z-20 flex-shrink-0 border-r border-slate-200 bg-slate-50"
              style={{ width: LABEL_COL_WIDTH }}
            />
            <div style={{ width: chartWidth }}>
              <MarkerLabelsRow markers={markers} pixelsPerWeek={zoom.pixelsPerWeek} />
              <TimeScaleHeader
                scales={scales}
                startDate={startDate}
                totalDurationWeeks={total}
                pixelsPerWeek={zoom.pixelsPerWeek}
                sprintCadence={sprintCadence}
              />
            </div>
          </div>

          {milestoneBoundaries.map((milestone) => {
            const rows = milestone.initiativeIds.map((id) => rowsByInitiativeId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
            if (rows.length === 0) return null;
            return (
              <div key={milestone.milestoneId}>
                <div className="flex bg-slate-100 border-t border-b border-slate-200">
                  <div
                    className="sticky left-0 z-20 flex-shrink-0 px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100"
                    style={{ width: LABEL_COL_WIDTH }}
                  >
                    {milestone.name}
                  </div>
                  <div style={{ width: chartWidth }} />
                </div>
                {rows.map((row) => (
                  <div key={row.initiativeId} className="flex border-t border-slate-100 items-center">
                    <div
                      className="sticky left-0 z-20 flex-shrink-0 px-3 py-2 text-sm text-slate-800 truncate flex items-center gap-1 bg-white"
                      style={{ width: LABEL_COL_WIDTH }}
                      title={row.name}
                    >
                      {row.name}
                      {row.warning === 'missing-size' && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded" title="No size or time estimate set">
                          unsized
                        </span>
                      )}
                      {row.warning === 'missing-duration' && (
                        <span
                          className="text-[10px] text-red-600 bg-red-50 px-1 rounded"
                          title="Sizing key is missing a duration for this initiative's size"
                        >
                          missing data
                        </span>
                      )}
                    </div>
                    <div className="relative h-8" style={{ width: chartWidth }}>
                      {row.segments.map((seg, i) => (
                        <div
                          key={i}
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
            );
          })}

          <MarkerLines markers={markers} pixelsPerWeek={zoom.pixelsPerWeek} labelColWidth={LABEL_COL_WIDTH} />
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
