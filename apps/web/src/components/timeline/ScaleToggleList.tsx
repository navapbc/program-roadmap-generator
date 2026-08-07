import { availableScales, type ScaleUnit } from '@roadmap/shared';

export default function ScaleToggleList({
  selected,
  hasStartDate,
  onToggle,
}: {
  selected: string[];
  hasStartDate: boolean;
  onToggle: (scale: ScaleUnit) => void;
}) {
  // Calendar scales (month/quarter/year) only make sense against a real
  // start date — hide them outright rather than showing a checkbox that
  // can't do anything yet.
  return (
    <div className="flex gap-4">
      {availableScales(hasStartDate).map((scale) => (
        <label key={scale} className="flex items-center gap-1 text-sm capitalize text-slate-700">
          <input type="checkbox" checked={selected.includes(scale)} onChange={() => onToggle(scale)} />
          {scale}
        </label>
      ))}
    </div>
  );
}
