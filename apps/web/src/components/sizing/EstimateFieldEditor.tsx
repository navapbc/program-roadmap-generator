import { useState } from 'react';
import { trpc } from '../../trpc.js';

interface EstimateField {
  id: string;
  name: string;
  orderIndex: number;
}

export default function EstimateFieldEditor({ projectId, fields }: { projectId: string; fields: EstimateField[] }) {
  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.project.getById.invalidate();
    utils.estimateField.listForProject.invalidate({ projectId });
  };
  const create = trpc.estimateField.create.useMutation({ onSuccess: invalidate, onError: (e) => alert(e.message) });
  const rename = trpc.estimateField.rename.useMutation({ onSuccess: invalidate, onError: (e) => alert(e.message) });
  const remove = trpc.estimateField.delete.useMutation({ onSuccess: invalidate });
  const reorder = trpc.estimateField.reorder.useMutation({ onSuccess: invalidate });
  const [newName, setNewName] = useState('');

  const sorted = [...fields].sort((a, b) => a.orderIndex - b.orderIndex);

  function move(id: string, direction: -1 | 1) {
    const idx = sorted.findIndex((f) => f.id === id);
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= sorted.length) return;
    const afterId = direction === 1 ? sorted[targetIdx].id : sorted[targetIdx - 1]?.id ?? null;
    reorder.mutate({ id, afterId });
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2 mb-2">
        {sorted.map((field, i) => (
          <li key={field.id} className="flex items-center gap-1 border border-slate-300 rounded-md px-2 py-1 bg-white">
            <button
              className="text-slate-400 hover:text-slate-800 disabled:opacity-30"
              disabled={i === 0}
              onClick={() => move(field.id, -1)}
              type="button"
              title="Move earlier"
            >
              ←
            </button>
            <input
              className="w-28 text-sm text-center border-none focus:ring-1 focus:ring-slate-300 rounded"
              defaultValue={field.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== field.name && rename.mutate({ id: field.id, name: e.target.value.trim() })}
            />
            <button
              className="text-slate-400 hover:text-slate-800 disabled:opacity-30"
              disabled={i === sorted.length - 1}
              onClick={() => move(field.id, 1)}
              type="button"
              title="Move later"
            >
              →
            </button>
            <button className="text-red-400 hover:text-red-700 text-xs ml-1" onClick={() => remove.mutate({ id: field.id })} type="button">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          create.mutate({ projectId, name: newName.trim() });
          setNewName('');
        }}
      >
        <input
          className="border border-slate-300 rounded-md px-2 py-1 text-sm w-32"
          placeholder="e.g. Design"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button className="text-sm text-slate-500 hover:text-slate-900" type="submit">
          + Add field
        </button>
      </form>
    </div>
  );
}
