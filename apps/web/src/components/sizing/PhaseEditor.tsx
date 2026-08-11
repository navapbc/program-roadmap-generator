import { useState } from 'react';
import type { PhaseUnit } from '@roadmap/shared';
import { trpc } from '../../trpc.js';

const UNIT_OPTIONS: PhaseUnit[] = ['day', 'week', 'month'];

interface Phase {
  id: string;
  name: string;
  unit: string;
  orderIndex: number;
  canOverlap: boolean;
}

export default function PhaseEditor({ sizingKeyId, phases }: { sizingKeyId: string; phases: Phase[] }) {
  const utils = trpc.useUtils();
  const invalidate = () => utils.sizingKey.getFull.invalidate({ id: sizingKeyId });
  const addPhase = trpc.sizingKey.addPhase.useMutation({ onSuccess: invalidate });
  const renamePhase = trpc.sizingKey.renamePhase.useMutation({ onSuccess: invalidate });
  const deletePhase = trpc.sizingKey.deletePhase.useMutation({ onSuccess: invalidate });
  const reorderPhase = trpc.sizingKey.reorderPhase.useMutation({ onSuccess: invalidate });
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState<PhaseUnit | ''>('');

  const sorted = [...phases].sort((a, b) => a.orderIndex - b.orderIndex);

  function move(id: string, direction: -1 | 1) {
    const idx = sorted.findIndex((p) => p.id === id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const afterId = direction === 1 ? sorted[targetIdx].id : sorted[targetIdx - 1]?.id ?? null;
    reorderPhase.mutate({ id, afterId });
  }

  return (
    <div>
      <table className="w-full text-sm border border-slate-200 rounded-md overflow-hidden mb-2">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="px-3 py-2 w-16"></th>
            <th className="px-3 py-2">Phase</th>
            <th className="px-3 py-2">Unit</th>
            <th className="px-3 py-2">Can overlap</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {sorted.map((phase, i) => (
            <tr key={phase.id}>
              <td className="px-3 py-2 whitespace-nowrap">
                <button className="text-slate-400 hover:text-slate-800 disabled:opacity-30 mr-1" disabled={i === 0} onClick={() => move(phase.id, -1)} type="button">
                  ↑
                </button>
                <button
                  className="text-slate-400 hover:text-slate-800 disabled:opacity-30"
                  disabled={i === sorted.length - 1}
                  onClick={() => move(phase.id, 1)}
                  type="button"
                >
                  ↓
                </button>
              </td>
              <td className="px-3 py-2">
                <input
                  className="border-none focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1 w-full"
                  defaultValue={phase.name}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== phase.name && renamePhase.mutate({ id: phase.id, name: e.target.value.trim() })}
                />
              </td>
              <td className="px-3 py-2">
                <select
                  className="border border-slate-300 rounded px-1 py-1 capitalize"
                  value={phase.unit}
                  onChange={(e) => renamePhase.mutate({ id: phase.id, unit: e.target.value as PhaseUnit })}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u} className="capitalize">
                      {u}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={phase.canOverlap}
                  onChange={(e) => renamePhase.mutate({ id: phase.id, canOverlap: e.target.checked })}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <button className="text-red-400 hover:text-red-700 text-xs" onClick={() => deletePhase.mutate({ id: phase.id })} type="button">
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td className="px-3 py-4 text-center text-slate-400" colSpan={5}>
                No phases yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim() || !newUnit) return;
          addPhase.mutate({ sizingKeyId, name: newName.trim(), unit: newUnit });
          setNewName('');
          setNewUnit('');
        }}
      >
        <input
          className="border border-slate-300 rounded-md px-2 py-1 text-sm flex-1"
          placeholder="e.g. Discovery"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          className="border border-slate-300 rounded-md px-2 py-1 text-sm capitalize"
          value={newUnit}
          onChange={(e) => setNewUnit(e.target.value as PhaseUnit)}
        >
          <option value="">Unit…</option>
          {UNIT_OPTIONS.map((u) => (
            <option key={u} value={u} className="capitalize">
              {u}
            </option>
          ))}
        </select>
        <button className="text-sm text-slate-500 hover:text-slate-900" type="submit">
          + Add phase
        </button>
      </form>
    </div>
  );
}
