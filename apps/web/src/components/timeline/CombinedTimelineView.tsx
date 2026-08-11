import { checkRowAgainstWindow, type DateRangeWindow, type MilestoneBoundary, type ScaleUnit, type SprintCadence } from '@roadmap/shared';
import TimeScaleHeader from './TimeScaleHeader.js';
import ZoomControl from './ZoomControl.js';
import { MarkerLabelsRow, MarkerLines, type MarkerTick } from './TimelineMarkers.js';
import type { useZoom } from '../../hooks/useZoom.js';

const PHASE_COLORS = ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-violet-400'];
const WEEKS_PER_DAY = 1 / 7;
export const LABEL_COL_WIDTH = 224; // px, matches w-56

interface SegmentDTO {
  phaseName: string;
  unitName: string;
  displayDuration: number;
  startOffsetWeeks: number;
  durationWeeks: number;
}
interface RowDTO {
  initiativeId: string;
  name: string;
  totalDurationWeeks: number;
  startOffsetWeeks: number;
  segments: SegmentDTO[];
  warning?: 'missing-size' | 'missing-duration';
}

interface MarkerDTO {
  id: string;
  label: string;
  offsetWeeks: number;
}

export interface CombinedScopeGroup {
  scopeId: string;
  label: string;
  startDate: Date | null;
  sprintCadence?: SprintCadence | null;
  totalDurationWeeks: number;
  rows: RowDTO[];
  milestoneBoundaries: MilestoneBoundary[];
  markers?: MarkerDTO[];
}

function rangeNote(status: { extendsBefore: boolean; extendsBeyond: boolean }): string | null {
  if (status.extendsBefore && status.extendsBeyond) return 'Work extends before and beyond the currently selected time span.';
  if (status.extendsBefore) return 'Work starts before the currently selected time span.';
  if (status.extendsBeyond) return 'Work extends beyond the currently selected time span.';
  return null;
}

/**
 * Aligns N independently-computed scopes on one shared calendar/relative
 * axis. Each scope's own computeTimeline() result never changes here — this
 * only decides where each scope's week-0 sits relative to the others.
 */
function computeSharedOrigin(groups: CombinedScopeGroup[]): Date | null {
  const anchored = groups.map((g) => g.startDate).filter((d): d is Date => d != null);
  if (anchored.length === 0) return null;
  return new Date(Math.min(...anchored.map((d) => d.getTime())));
}

function weeksBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 7);
}

/** The combined width (in weeks) of the shared axis — exported so the page can size its zoom hook to the same total this view will render. */
export function computeSharedTotalWeeks(groups: CombinedScopeGroup[]): number {
  const sharedOrigin = computeSharedOrigin(groups);
  const offsetByScope = new Map(
    groups.map((g) => [g.scopeId, sharedOrigin && g.startDate ? weeksBetween(sharedOrigin, g.startDate) : 0])
  );
  return Math.max(WEEKS_PER_DAY, ...groups.map((g) => (offsetByScope.get(g.scopeId) ?? 0) + g.totalDurationWeeks));
}

export default function CombinedTimelineView({
  groups,
  scales,
  zoom,
  dateWindow,
}: {
  groups: CombinedScopeGroup[];
  scales: ScaleUnit[];
  zoom: ReturnType<typeof useZoom>;
  /** Restricts the visible chart to a date window (in shared-origin week-offsets) — out-of-window rows stay in the list but render greyed with an explanatory note. */
  dateWindow?: DateRangeWindow;
}) {
  if (groups.length === 0) return null;

  const sharedOrigin = computeSharedOrigin(groups);
  const offsetByScope = new Map(
    groups.map((g) => [
      g.scopeId,
      sharedOrigin && g.startDate ? weeksBetween(sharedOrigin, g.startDate) : 0,
    ])
  );
  const fullSharedTotalWeeks = computeSharedTotalWeeks(groups);

  const windowStart = dateWindow?.startOffsetWeeks ?? 0;
  const windowEnd = dateWindow?.endOffsetWeeks ?? fullSharedTotalWeeks;
  const sharedTotalWeeks = Math.max(0.01, windowEnd - windowStart);
  const chartWidth = sharedTotalWeeks * zoom.pixelsPerWeek;
  const windowStartDate =
    sharedOrigin && windowStart !== 0 ? new Date(sharedOrigin.getTime() + windowStart * 7 * 24 * 60 * 60 * 1000) : sharedOrigin;

  const phaseNames = [...new Set(groups.flatMap((g) => g.rows.flatMap((r) => r.segments.map((s) => s.phaseName))))];
  const colorByPhase = new Map(phaseNames.map((name, i) => [name, PHASE_COLORS[i % PHASE_COLORS.length]]));

  // Different scopes can have different sprint cadences; showing one
  // shared Sprint row only makes sense with one cadence, so just use
  // whichever anchored scope has one configured first, in scope order.
  const sprintCadence = groups.find((g) => g.startDate && g.sprintCadence)?.sprintCadence ?? null;

  const markers: MarkerTick[] = groups.flatMap((g) => {
    const offset = offsetByScope.get(g.scopeId) ?? 0;
    return (g.markers ?? []).map((m) => ({ id: m.id, label: `${m.label} (${g.label})`, offsetWeeks: offset + m.offsetWeeks - windowStart }));
  });

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

      {/* Measurement-only wrapper (always the available width) — see GanttChart's
          identical comment for why the border/background/explicit-width box
          below has to be a sibling of this, not the same element. */}
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
                totalDurationWeeks={sharedTotalWeeks}
                pixelsPerWeek={zoom.pixelsPerWeek}
                sprintCadence={sprintCadence}
              />
            </div>
          </div>

          {groups.map((group) => {
            const offset = offsetByScope.get(group.scopeId) ?? 0;
            const isUnanchored = sharedOrigin != null && group.startDate == null;
            const rowsByInitiativeId = new Map(group.rows.map((r) => [r.initiativeId, r]));
            return (
              <div key={group.scopeId}>
                <div className="flex bg-slate-100 border-t border-b border-slate-200">
                  <div
                    className="sticky left-0 z-20 px-3 py-1 text-xs font-semibold text-slate-600 flex items-center gap-1 bg-slate-100"
                    style={{ width: LABEL_COL_WIDTH + chartWidth, maxWidth: '100%' }}
                  >
                    {group.label}
                    {isUnanchored && (
                      <span
                        className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded font-normal"
                        title="No start date set for this scope — shown at a relative offset, not aligned to real calendar time"
                      >
                        relative
                      </span>
                    )}
                  </div>
                </div>

                {group.milestoneBoundaries.map((milestone) => {
                  const milestoneInitiativeIds = milestone.increments.flatMap((inc) => inc.initiativeIds);
                  const milestoneRows = milestoneInitiativeIds.map((id) => rowsByInitiativeId.get(id)).filter(Boolean);
                  if (milestoneRows.length === 0) return null;
                  return (
                    <div key={milestone.milestoneId}>
                      <div className="flex bg-slate-50 border-t border-slate-100">
                        <div
                          className="sticky left-0 z-20 flex-shrink-0 px-3 py-1 text-xs font-medium text-slate-600 bg-slate-50"
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
                            <div className="flex border-t border-slate-100">
                              <div
                                className="sticky left-0 z-20 pl-6 pr-3 py-1 text-xs font-medium text-slate-400 bg-white"
                                style={{ width: LABEL_COL_WIDTH + chartWidth, maxWidth: '100%' }}
                              >
                                {increment.name}
                              </div>
                            </div>
                            {rows.map((row) => {
                              const rangeStatus = dateWindow
                                ? checkRowAgainstWindow(offset + row.startOffsetWeeks, offset + row.startOffsetWeeks + row.totalDurationWeeks, dateWindow)
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
                                        <span className="shrink-0 text-[10px] text-amber-600 bg-amber-50 px-1 rounded">unsized</span>
                                      )}
                                      {row.warning === 'missing-duration' && (
                                        <span className="shrink-0 text-[10px] text-red-600 bg-red-50 px-1 rounded">missing data</span>
                                      )}
                                    </div>
                                    {note && <span className="text-[10px] italic text-slate-400">{note}</span>}
                                  </div>
                                  <div className={`relative h-8 self-center overflow-hidden ${note ? 'opacity-30' : ''}`} style={{ width: chartWidth }}>
                                    {row.segments.map((seg, i) => (
                                      <div
                                        key={i}
                                        className={`absolute inset-y-1.5 rounded-sm ${colorByPhase.get(seg.phaseName) ?? 'bg-slate-400'}`}
                                        style={{
                                          left: `${(offset + seg.startOffsetWeeks - windowStart) * zoom.pixelsPerWeek}px`,
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
