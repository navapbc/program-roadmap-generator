import { Link, useNavigate } from 'react-router-dom';
import { trpc } from '../../trpc.js';

export default function SizingKeySelector({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string | null;
  onChange: (id: string) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const keys = trpc.sizingKey.listWithCompatibility.useQuery({ projectId });
  const createCompatibleKey = trpc.sizingKey.createCompatible.useMutation({
    onSuccess: (key) => {
      utils.sizingKey.list.invalidate();
      utils.sizingKey.listWithCompatibility.invalidate({ projectId });
      navigate(`/sizing-keys/${key.id}`);
    },
  });

  const hasCompatibleKey = keys.data?.some((k) => k.compatible) ?? true; // assume yes until loaded, avoids a flash

  function createCompatibleSizingKey() {
    const name = window.prompt('Name for the new sizing key?');
    if (name?.trim()) createCompatibleKey.mutate({ projectId, name: name.trim() });
  }

  return (
    <div>
      <select
        className="border border-slate-300 rounded-md px-3 py-2 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Choose a sizing key…
        </option>
        {keys.data?.map((k) => (
          <option key={k.id} value={k.id} disabled={!k.compatible}>
            {k.name} {k.compatible ? '' : `(missing: ${k.missingCodes.join(', ')})`}
          </option>
        ))}
      </select>
      {!hasCompatibleKey && (
        <p className="text-xs text-amber-700 mt-1">
          No key covers this project's labels yet.{' '}
          <button type="button" className="underline font-medium" onClick={createCompatibleSizingKey}>
            Create one
          </button>{' '}
          or <Link to="/sizing-keys" className="underline font-medium">edit an existing key</Link>.
        </p>
      )}
    </div>
  );
}
