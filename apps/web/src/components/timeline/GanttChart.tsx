import { checkRowAgainstWindow, type DateRangeWindow, type MilestoneBoundary, type ScaleUnit, type SprintCadence } from '@roadmap/shared';
import TimeScaleHeader from './TimeScaleHeader.js';
import ZoomControl from './ZoomControl.js';
import { MarkerLabelsRow, MarkerLines, type MarkerTick } from './TimelineMarkers.js';
import type { useZoom } from '../../hooks/useZoom.js';

const PHASE_COLORS = ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-violet-400'];
export const LABEL_COL_WIDTH = 224; // px, matches w-56

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

function rangeNote(status: { extendsBefore: boolean; extendsBeyond: boolean }): string | null {
  if (status.extendsBefore && status.extendsBeyond) return 'Work extends before and beyond the currently selected time span.';
  if (status.extendsBefore) return 'Work starts before the currently selected time span.';
  if (status.extendsBeyond) return 'Work extends beyond the currently selected time span.';
  return null;
}

export default function GanttChart({
  result,
  milestoneBoundaries,
  scales,
  startDate,
  sprintCadence,
  markers = [],
  zoom,
  dateWindow,
}: {
  result: TimelineResultDTO;
  milestoneBoundaries: MilestoneBoundary[];
  scales: ScaleUnit[];
  startDate: Date | null;
  sprintCadence?: SprintCadence | null;
  markers?: MarkerTick[];
  zoom: ReturnType<typeof useZoom>;
  /** Restricts the visible chart to a date window — out-of-window rows stay in the list but render greyed with an explanatory note. */
  dateWindow?: DateRangeWindow;
}) {
  const phaseNames = [...new Set(result.rows.flatMap((r) => r.segments.map((s) => s.phaseName)))];
  const colorByPhase = new Map(phaseNames.map((name, i) => [name, PHASE_COLORS[i % PHASE_COLORS.length]]));

  const rowsByInitiativeId = new Map(result.rows.map((r) => [r.initiativeId, r]));
  const fullTotal = result.totalDurationWeeks || 1;

  // A date window narrows the visible axis to [windowStart, windowEnd] —
  // that becomes the new "total" the zoom/fit math sizes against, and every
  // offset renders shifted so windowStart sits at 0. Rows aren't hidden
  // outside the window (their bars just render off the visible edge and get
  // clipped) — checkRowAgainstWindow separately flags them so the label can
  // grey out with an explanation instead of silently vanishing.
  const windowStart = dateWindow?.startOffsetWeeks ?? 0;
  const windowEnd = dateWindow?.endOffsetWeeks ?? fullTotal;
  const total = Math.max(0.01, windowEnd - windowStart);
  const chartWidth = total * zoom.pixelsPerWeek;
  const windowStartDate = startDate && windowStart !== 0 ? new Date(startDate.getTime() + windowStart * 7 * 24 * 60 * 60 * 1000) : startDate;

  return (
    <div>
      <div className="flex justify-end mb-2 no-export">
        <ZoomControl
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onReset={zoom.reset}
          canZoomIn={zoom.canZoomIn}
          canZoomOut={zoom.canZoomOut}
        />
      </div>

      {/* Measurement-only wrapper: always the available width, so useZoom can fit
          to it. The styled box below it is deliberately a sibling, not this same
          element — it gets an explicit pixel width that can exceed its parent's
          (that's what "fits, or else the page scrolls" needs), and a border/
          background sized to match would be wrong to also put on the
          measurement element, which must stay at 100% to measure correctly. */}
      <div ref={zoom.containerRef}>
        <div className="relative border border-slate-200 rounded-md bg-white" style={{ width: LABEL_COL_WIDTH + chartWidth, minWidth: '100%' }}>
          <div className="flex">
            <div
              className="sticky left-0 z-20 flex-shrink-0 border-r border-slate-200 bg-slate-50"
              style={{ width: LABEL_COL_WIDTH }}
            />
            <div style={{ width: chartWidth }}>
              <MarkerLabelsRow markers={markers} pixelsPerWeek={zoom.pixelsPerWeek} />
              <TimeScaleHeader
                scales={scales}
                startDate={windowStartDate}
                totalDurationWeeks={total}
                pixelsPerWeek={zoom.pixelsPerWeek}
                sprintCadence={sprintCadence}
              />
            </div>
          </div>

          {milestoneBoundaries.map((milestone) => {
            const milestoneInitiativeIds = milestone.increments.flatMap((inc) => inc.initiativeIds);
            const milestoneRows = milestoneInitiativeIds.map((id) => rowsByInitiativeId.get(id)).filter(Boolean);
            if (milestoneRows.length === 0) return null;
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

                {milestone.increments.map((increment) => {
                  const rows = increment.initiativeIds.map((id) => rowsByInitiativeId.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
                  if (rows.length === 0) return null;
                  return (
                    <div key={increment.incrementId}>
                      <div className="flex bg-slate-50 border-t border-slate-100">
                        <div
                          className="sticky left-0 z-20 flex-shrink-0 pl-6 pr-3 py-1 text-xs font-medium text-slate-500 bg-slate-50"
                          style={{ width: LABEL_COL_WIDTH }}
                        >
                          {increment.name}
                        </div>
                        <div style={{ width: chartWidth }} />
                      </div>
                      {rows.map((row) => {
                        const rangeStatus = dateWindow
                          ? checkRowAgainstWindow(row.startOffsetWeeks, row.startOffsetWeeks + row.totalDurationWeeks, dateWindow)
                          : { extendsBefore: false, extendsBeyond: false };
                        const note = rangeNote(rangeStatus);
                        return (
                          <div key={row.initiativeId} className={`flex border-t border-slate-100 ${note ? 'bg-slate-50' : ''}`}>
                            <div
                              className={`sticky left-0 z-20 flex-shrink-0 pl-9 pr-3 py-2 text-sm flex flex-col gap-0.5 ${note ? 'bg-slate-50 text-slate-400' : 'bg-white text-slate-800'}`}
                              style={{ width: LABEL_COL_WIDTH }}
                            >
                              <div className="flex items-start gap-1">
                                <span className="min-w-0 break-words">{row.name}</span>
                                {row.warning === 'missing-size' && (
                                  <span
                                    className="shrink-0 text-[10px] text-amber-600 bg-amber-50 px-1 rounded"
                                    title="No size or time estimate set"
                                  >
                                    unsized
                                  </span>
                                )}
                                {row.warning === 'missing-duration' && (
                                  <span
                                    className="shrink-0 text-[10px] text-red-600 bg-red-50 px-1 rounded"
                                    title="Sizing key is missing a duration for this initiative's size"
                                  >
                                    missing data
                                  </span>
                                )}
                              </div>
                              {note && <span className="text-[10px] italic text-slate-400">{note}</span>}
                            </div>
                            {/* overflow-hidden here (not on the outer chart box) clips a
                                segment that pokes past this one row's date window without
                                turning the whole chart into a sticky-label scroll context. */}
                            <div className={`relative h-8 self-center overflow-hidden ${note ? 'opacity-30' : ''}`} style={{ width: chartWidth }}>
                              {row.segments.map((seg, i) => (
                                <div
                                  key={i}
                                  className={`absolute inset-y-1.5 rounded-sm ${colorByPhase.get(seg.phaseName) ?? 'bg-slate-400'}`}
                                  style={{
                                    left: `${(seg.startOffsetWeeks - windowStart) * zoom.pixelsPerWeek}px`,
                                    width: `${Math.max(seg.durationWeeks * zoom.pixelsPerWeek, 2)}px`,
                                  }}
                                  title={`${seg.phaseName}: ${seg.displayDuration} ${seg.unitName}${seg.displayDuration === 1 ? '' : 's'}`}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
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
