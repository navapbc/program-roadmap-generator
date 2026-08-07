import { useState } from 'react';
import { trpc } from '../../trpc.js';

interface Label {
  id: string;
  code: string;
  orderIndex: number;
}

export default function SizingKeyLabelEditor({ sizingKeyId, labels }: { sizingKeyId: string; labels: Label[] }) {
  const utils = trpc.useUtils();
  const invalidate = () => utils.sizingKey.getFull.invalidate({ id: sizingKeyId });
  const addLabel = trpc.sizingKey.addLabel.useMutation({ onSuccess: invalidate, onError: (e) => alert(e.message) });
  const renameLabel = trpc.sizingKey.renameLabel.useMutation({ onSuccess: invalidate });
  const deleteLabel = trpc.sizingKey.deleteLabel.useMutation({ onSuccess: invalidate });
  const reorderLabel = trpc.sizingKey.reorderLabel.useMutation({ onSuccess: invalidate });
  const [newCode, setNewCode] = useState('');

  const sorted = [...labels].sort((a, b) => a.orderIndex - b.orderIndex);

  function move(id: string, direction: -1 | 1) {
    const idx = sorted.findIndex((l) => l.id === id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const afterId = direction === 1 ? sorted[targetIdx].id : sorted[targetIdx - 1]?.id ?? null;
    reorderLabel.mutate({ id, afterId });
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2 mb-2">
        {sorted.map((label, i) => (
          <li key={label.id} className="flex items-center gap-1 border border-slate-300 rounded-md px-2 py-1 bg-white">
            <button className="text-slate-400 hover:text-slate-800 disabled:opacity-30" disabled={i === 0} onClick={() => move(label.id, -1)} type="button">
              ←
            </button>
            <input
              className="w-14 text-sm text-center border-none focus:ring-1 focus:ring-slate-300 rounded"
              defaultValue={label.code}
              onBlur={(e) => e.target.value.trim() && e.target.value !== label.code && renameLabel.mutate({ id: label.id, code: e.target.value.trim() })}
            />
            <button
              className="text-slate-400 hover:text-slate-800 disabled:opacity-30"
              disabled={i === sorted.length - 1}
              onClick={() => move(label.id, 1)}
              type="button"
            >
              →
            </button>
            <button className="text-red-400 hover:text-red-700 text-xs ml-1" onClick={() => deleteLabel.mutate({ id: label.id })} type="button">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newCode.trim()) return;
          addLabel.mutate({ sizingKeyId, code: newCode.trim() });
          setNewCode('');
        }}
      >
        <input
          className="border border-slate-300 rounded-md px-2 py-1 text-sm w-24"
          placeholder="e.g. XL"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
        />
        <button className="text-sm text-slate-500 hover:text-slate-900" type="submit">
          + Add size
        </button>
      </form>
    </div>
  );
}
