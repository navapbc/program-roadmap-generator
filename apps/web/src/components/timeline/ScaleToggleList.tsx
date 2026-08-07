import { availableScales, type ScaleUnit } from '@roadmap/shared';

export default function ScaleToggleList({
  selected,
  hasStartDate,
  hasSprintCadence = false,
  dayReadable = true,
  onToggle,
}: {
  selected: string[];
  hasStartDate: boolean;
  hasSprintCadence?: boolean;
  /** False once the current zoom level compresses day ticks too narrow to read — see isDayScaleReadable(). */
  dayReadable?: boolean;
  onToggle: (scale: ScaleUnit) => void;
}) {
  // Calendar scales (month/quarter/year) only make sense against a real
  // start date, and Sprint additionally needs a sprint cadence configured
  // on the project — hide them outright rather than showing a checkbox
  // that can't do anything yet.
  const scales = availableScales(hasStartDate, hasSprintCadence);

  return (
    <div>
      <div className="flex gap-4">
        {scales.map((scale) => {
          const dayDisabled = scale === 'day' && !dayReadable;
          return (
            <label
              key={scale}
              className={`flex items-center gap-1 text-sm capitalize ${dayDisabled ? 'text-slate-400' : 'text-slate-700'}`}
            >
              <input
                type="checkbox"
                checked={dayDisabled ? false : selected.includes(scale)}
                disabled={dayDisabled}
                onChange={() => onToggle(scale)}
              />
              {scale}
            </label>
          );
        })}
      </div>
      {scales.includes('day') && !dayReadable && (
        <p className="text-xs text-slate-400 mt-1">Zoom in to display day labels.</p>
      )}
    </div>
  );
}
