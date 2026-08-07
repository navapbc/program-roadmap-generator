import { availableScales, type ScaleUnit } from '@roadmap/shared';

export default function ScaleToggleList({
  selected,
  hasStartDate,
  hasSprintCadence = false,
  onToggle,
}: {
  selected: string[];
  hasStartDate: boolean;
  hasSprintCadence?: boolean;
  onToggle: (scale: ScaleUnit) => void;
}) {
  // Calendar scales (month/quarter/year) only make sense against a real
  // start date, and Sprint additionally needs a sprint cadence configured
  // on the project — hide them outright rather than showing a checkbox
  // that can't do anything yet.
  return (
    <div className="flex gap-4">
      {availableScales(hasStartDate, hasSprintCadence).map((scale) => (
        <label key={scale} className="flex items-center gap-1 text-sm capitalize text-slate-700">
          <input type="checkbox" checked={selected.includes(scale)} onChange={() => onToggle(scale)} />
          {scale}
        </label>
      ))}
    </div>
  );
}
