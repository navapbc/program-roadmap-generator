import { computeScaleTicks, SCALE_DISPLAY_ORDER, type ScaleUnit } from '@roadmap/shared';

export default function TimeScaleHeader({
  scales,
  startDate,
  totalDurationWeeks,
}: {
  scales: ScaleUnit[];
  startDate: Date | null;
  totalDurationWeeks: number;
}) {
  if (totalDurationWeeks <= 0) return null;

  // Stack rows coarsest-to-finest always, regardless of what order the
  // scales were toggled on in — a checkbox history shouldn't reorder the ruler.
  const orderedScales = SCALE_DISPLAY_ORDER.filter((s) => scales.includes(s));

  return (
    <div className="border-b border-slate-200">
      {orderedScales.map((scale) => {
        const ticks = computeScaleTicks(scale, { startDate, totalDurationWeeks });
        if (ticks.length === 0) return null;
        return (
          <div key={scale} className="relative h-6 border-t border-slate-100 first:border-t-0">
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="absolute inset-y-0 border-r border-slate-200 text-[10px] text-slate-500 px-1 truncate flex items-center"
                style={{
                  left: `${(tick.startOffsetWeeks / totalDurationWeeks) * 100}%`,
                  width: `${(tick.widthWeeks / totalDurationWeeks) * 100}%`,
                }}
                title={tick.label}
              >
                {tick.label}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
