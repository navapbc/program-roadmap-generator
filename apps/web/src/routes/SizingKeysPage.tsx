import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../trpc.js';

export default function SizingKeysPage() {
  const utils = trpc.useUtils();
  const keys = trpc.sizingKey.list.useQuery();
  const create = trpc.sizingKey.create.useMutation({ onSuccess: () => utils.sizingKey.list.invalidate() });
  const duplicate = trpc.sizingKey.duplicate.useMutation({ onSuccess: () => utils.sizingKey.list.invalidate() });
  const remove = trpc.sizingKey.delete.useMutation({ onSuccess: () => utils.sizingKey.list.invalidate() });
  const [name, setName] = useState('');

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Sizing Keys</h1>
      <p className="text-sm text-slate-500 mb-4">
        Each key defines its own set of size labels, phases, and a size×phase duration matrix — maintained
        independently of any project, so you can model different scenarios (optimistic vs. pessimistic, current
        staffing vs. augmented) and swap between them on a project's Timeline.
      </p>

      <form
        className="flex gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          create.mutate({ name: name.trim() });
          setName('');
        }}
      >
        <input
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
          placeholder="New sizing key name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium" type="submit">
          Create
        </button>
      </form>

      <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white">
        {keys.data?.map((key) => (
          <li key={key.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <Link to={`/sizing-keys/${key.id}`} className="font-medium text-slate-900 hover:underline">
                {key.name}
              </Link>
              {key.description && <p className="text-sm text-slate-500">{key.description}</p>}
            </div>
            <div className="flex gap-3 text-sm">
              <button
                className="text-slate-500 hover:text-slate-900"
                type="button"
                onClick={() => {
                  const newName = window.prompt('Name for the duplicate?', `${key.name} (copy)`);
                  if (newName?.trim()) duplicate.mutate({ id: key.id, newName: newName.trim() });
                }}
              >
                Duplicate
              </button>
              <button className="text-red-400 hover:text-red-700" type="button" onClick={() => remove.mutate({ id: key.id })}>
                Delete
              </button>
            </div>
          </li>
        ))}
        {keys.data?.length === 0 && <li className="px-4 py-6 text-center text-slate-400">No sizing keys yet.</li>}
      </ul>
    </div>
  );
}
