import type { ScaleUnit } from '@roadmap/shared';
import TimeScaleHeader from './TimeScaleHeader.js';

const PHASE_COLORS = ['bg-indigo-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-violet-400'];
const WEEKS_PER_DAY = 1 / 7;

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

export interface CombinedScopeGroup {
  scopeId: string;
  label: string;
  startDate: Date | null;
  totalDurationWeeks: number;
  rows: RowDTO[];
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

export default function CombinedTimelineView({
  groups,
  scales,
}: {
  groups: CombinedScopeGroup[];
  scales: ScaleUnit[];
}) {
  if (groups.length === 0) return null;

  const sharedOrigin = computeSharedOrigin(groups);
  const offsetByScope = new Map(
    groups.map((g) => [
      g.scopeId,
      sharedOrigin && g.startDate ? weeksBetween(sharedOrigin, g.startDate) : 0,
    ])
  );
  const sharedTotalWeeks = Math.max(
    WEEKS_PER_DAY,
    ...groups.map((g) => (offsetByScope.get(g.scopeId) ?? 0) + g.totalDurationWeeks)
  );

  const phaseNames = [...new Set(groups.flatMap((g) => g.rows.flatMap((r) => r.segments.map((s) => s.phaseName))))];
  const colorByPhase = new Map(phaseNames.map((name, i) => [name, PHASE_COLORS[i % PHASE_COLORS.length]]));

  return (
    <div className="border border-slate-200 rounded-md overflow-hidden bg-white">
      <div className="flex">
        <div className="w-56 flex-shrink-0 border-r border-slate-200 bg-slate-50" />
        <div className="flex-1 min-w-0">
          <TimeScaleHeader scales={scales} startDate={sharedOrigin} totalDurationWeeks={sharedTotalWeeks} />
        </div>
      </div>

      {groups.map((group) => {
        const offset = offsetByScope.get(group.scopeId) ?? 0;
        const isUnanchored = sharedOrigin != null && group.startDate == null;
        return (
          <div key={group.scopeId}>
            <div className="flex bg-slate-100 border-t border-b border-slate-200">
              <div className="w-56 flex-shrink-0 px-3 py-1 text-xs font-semibold text-slate-600 flex items-center gap-1">
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
              <div className="flex-1" />
            </div>
            {group.rows.map((row) => (
              <div key={row.initiativeId} className="flex border-t border-slate-100 items-center">
                <div className="w-56 flex-shrink-0 px-3 py-2 text-sm text-slate-800 truncate flex items-center gap-1" title={row.name}>
                  {row.name}
                  {row.warning === 'missing-size' && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">unsized</span>
                  )}
                  {row.warning === 'missing-duration' && (
                    <span className="text-[10px] text-red-600 bg-red-50 px-1 rounded">missing data</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 relative h-8">
                  {row.segments.map((seg, i) => (
                    <div
                      key={i}
                      className={`absolute inset-y-1.5 rounded-sm ${colorByPhase.get(seg.phaseName) ?? 'bg-slate-400'}`}
                      style={{
                        left: `${((offset + seg.startOffsetWeeks) / sharedTotalWeeks) * 100}%`,
                        width: `${Math.max((seg.durationWeeks / sharedTotalWeeks) * 100, 0.3)}%`,
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

      <div className="flex gap-4 px-3 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
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
