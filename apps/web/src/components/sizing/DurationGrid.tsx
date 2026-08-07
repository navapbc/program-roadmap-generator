import { trpc } from '../../trpc.js';

interface Label {
  id: string;
  code: string;
  orderIndex: number;
}

interface Duration {
  labelCode: string;
  durationValue: number;
}

interface Phase {
  id: string;
  name: string;
  orderIndex: number;
  unit: string;
  durations: Duration[];
}

export default function DurationGrid({
  sizingKeyId,
  labels,
  phases,
}: {
  sizingKeyId: string;
  labels: Label[];
  phases: Phase[];
}) {
  const utils = trpc.useUtils();
  const setDuration = trpc.sizingKey.setDuration.useMutation({
    onSuccess: () => utils.sizingKey.getFull.invalidate({ id: sizingKeyId }),
  });

  const sortedLabels = [...labels].sort((a, b) => a.orderIndex - b.orderIndex);
  const sortedPhases = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);

  if (sortedLabels.length === 0 || sortedPhases.length === 0) {
    return <p className="text-sm text-slate-400">Add at least one size label and one phase to edit durations.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border border-slate-200 rounded-md overflow-hidden">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left">Phase</th>
            {sortedLabels.map((label) => (
              <th key={label.id} className="px-3 py-2 text-center">
                {label.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {sortedPhases.map((phase) => {
            const durationByCode = new Map(phase.durations.map((d) => [d.labelCode, d.durationValue]));
            return (
              <tr key={phase.id}>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {phase.name} <span className="text-slate-400 font-normal capitalize">({phase.unit})</span>
                </td>
                {sortedLabels.map((label) => (
                  <td key={label.id} className="px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      className="w-16 border border-slate-300 rounded px-1 py-1 text-center"
                      defaultValue={durationByCode.get(label.code) ?? ''}
                      placeholder="—"
                      onBlur={(e) => {
                        const v = e.target.value === '' ? 0 : Number(e.target.value);
                        if (v >= 0) setDuration.mutate({ sizingPhaseId: phase.id, labelCode: label.code, durationValue: v });
                      }}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
