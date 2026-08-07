import { Link, useParams } from 'react-router-dom';
import { trpc } from '../trpc.js';
import SizingKeyLabelEditor from '../components/sizing/SizingKeyLabelEditor.js';
import PhaseEditor from '../components/sizing/PhaseEditor.js';
import DurationGrid from '../components/sizing/DurationGrid.js';

export default function SizingKeyEditorPage() {
  const { sizingKeyId } = useParams<{ sizingKeyId: string }>();
  const utils = trpc.useUtils();
  const key = trpc.sizingKey.getFull.useQuery({ id: sizingKeyId! }, { enabled: !!sizingKeyId });
  const update = trpc.sizingKey.update.useMutation({ onSuccess: () => utils.sizingKey.getFull.invalidate({ id: sizingKeyId! }) });

  if (key.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!key.data) return <p className="text-red-500">Sizing key not found.</p>;
  const data = key.data;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link to="/sizing-keys" className="text-sm text-slate-500 hover:text-slate-900">
          ← Sizing Keys
        </Link>
        <input
          className="block text-xl font-semibold text-slate-900 border-none focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1 mt-1"
          defaultValue={data.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== data.name && update.mutate({ id: data.id, name: e.target.value.trim() })}
        />
        <textarea
          className="block w-full text-sm text-slate-500 border-none focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1 mt-1 resize-none"
          rows={2}
          placeholder="Description…"
          defaultValue={data.description ?? ''}
          onBlur={(e) => e.target.value !== (data.description ?? '') && update.mutate({ id: data.id, description: e.target.value })}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Size labels</h2>
        <p className="text-xs text-slate-400 mb-2">
          This key's own labels — a project can only select this key once every size label it uses also appears here.
        </p>
        <SizingKeyLabelEditor sizingKeyId={data.id} labels={data.labels} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Phases</h2>
        <p className="text-xs text-slate-400 mb-2">
          Each phase runs in sequence and can be measured in days, weeks, or months. Month durations use each real
          calendar month's actual length once a project has a start date (Feb ≠ Jan), not a flat average — so a
          month boundary can land mid-week on the Timeline.
        </p>
        <PhaseEditor sizingKeyId={data.id} phases={data.phases} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Durations</h2>
        <p className="text-xs text-slate-400 mb-2">How long each phase takes for each size, in that phase's unit.</p>
        <DurationGrid sizingKeyId={data.id} labels={data.labels} phases={data.phases} />
      </div>
    </div>
  );
}
