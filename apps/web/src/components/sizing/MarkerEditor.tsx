import { useState } from 'react';
import { trpc } from '../../trpc.js';

interface Marker {
  id: string;
  label: string;
  date: string | Date;
}

export default function MarkerEditor({ projectId, markers }: { projectId: string; markers: Marker[] }) {
  const utils = trpc.useUtils();
  const invalidate = () => utils.marker.listForProject.invalidate({ projectId });
  const create = trpc.marker.create.useMutation({ onSuccess: invalidate });
  const remove = trpc.marker.delete.useMutation({ onSuccess: invalidate });
  const update = trpc.marker.update.useMutation({ onSuccess: invalidate });
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');

  const sorted = [...markers].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div>
      <ul className="space-y-1 mb-2">
        {sorted.map((marker) => (
          <li key={marker.id} className="flex items-center gap-2 border border-slate-200 rounded-md px-2 py-1 bg-white">
            <input
              className="flex-1 text-sm border-none focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1"
              defaultValue={marker.label}
              onBlur={(e) => e.target.value.trim() && e.target.value !== marker.label && update.mutate({ id: marker.id, label: e.target.value.trim() })}
            />
            <input
              type="date"
              className="text-sm border-none focus:ring-1 focus:ring-slate-300 rounded"
              defaultValue={new Date(marker.date).toISOString().slice(0, 10)}
              onChange={(e) => e.target.value && update.mutate({ id: marker.id, date: new Date(e.target.value) })}
            />
            <button className="text-red-400 hover:text-red-700 text-xs" onClick={() => remove.mutate({ id: marker.id })} type="button">
              ✕
            </button>
          </li>
        ))}
        {sorted.length === 0 && <li className="text-sm text-slate-400">No key dates yet.</li>}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim() || !date) return;
          create.mutate({ projectId, label: label.trim(), date: new Date(date) });
          setLabel('');
          setDate('');
        }}
      >
        <input
          className="border border-slate-300 rounded-md px-2 py-1 text-sm flex-1"
          placeholder="e.g. Target launch"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input type="date" className="border border-slate-300 rounded-md px-2 py-1 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="text-sm text-slate-500 hover:text-slate-900" type="submit">
          + Add date
        </button>
      </form>
    </div>
  );
}
