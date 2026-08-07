import { availableScales, isScaleReadable, type ScaleUnit } from '@roadmap/shared';

export default function ScaleToggleList({
  selected,
  hasStartDate,
  hasSprintCadence = false,
  pixelsPerWeek = Infinity,
  onToggle,
}: {
  selected: string[];
  hasStartDate: boolean;
  hasSprintCadence?: boolean;
  /** Current zoom level — a scale whose ticks would be too narrow to read at this zoom shows unchecked and disabled, with a note, rather than rendering illegible labels. Omit where there's no live chart to zoom (e.g. a settings-page preference toggle) — every scale is treated as readable. */
  pixelsPerWeek?: number;
  onToggle: (scale: ScaleUnit) => void;
}) {
  // Calendar scales (month/quarter/year) only make sense against a real
  // start date, and Sprint additionally needs a sprint cadence configured
  // on the project — hide them outright rather than showing a checkbox
  // that can't do anything yet.
  const scales = availableScales(hasStartDate, hasSprintCadence);
  const unreadable = scales.filter((scale) => !isScaleReadable(scale, pixelsPerWeek));

  return (
    <div>
      <div className="flex gap-4">
        {scales.map((scale) => {
          const disabled = unreadable.includes(scale);
          return (
            <label
              key={scale}
              className={`flex items-center gap-1 text-sm capitalize ${disabled ? 'text-slate-400' : 'text-slate-700'}`}
            >
              <input
                type="checkbox"
                checked={disabled ? false : selected.includes(scale)}
                disabled={disabled}
                onChange={() => onToggle(scale)}
              />
              {scale}
            </label>
          );
        })}
      </div>
      {unreadable.length > 0 && (
        <p className="text-xs text-slate-400 mt-1">
          Zoom in to display {unreadable.join('/')} label{unreadable.length === 1 ? '' : 's'}.
        </p>
      )}
    </div>
  );
}
