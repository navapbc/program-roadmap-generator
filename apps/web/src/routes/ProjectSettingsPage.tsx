import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ScaleUnit } from '@roadmap/shared';
import { trpc } from '../trpc.js';
import SizeLabelEditor from '../components/sizing/SizeLabelEditor.js';
import ScaleToggleList from '../components/timeline/ScaleToggleList.js';

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const project = trpc.project.getById.useQuery({ id: projectId! }, { enabled: !!projectId });
  const keys = trpc.sizingKey.listWithCompatibility.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const updateProject = trpc.project.update.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const createCompatibleKey = trpc.sizingKey.createCompatible.useMutation({
    onSuccess: (key) => {
      utils.sizingKey.list.invalidate();
      utils.sizingKey.listWithCompatibility.invalidate({ projectId: projectId! });
      navigate(`/sizing-keys/${key.id}`);
    },
  });
  const [error, setError] = useState<string | null>(null);

  if (project.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!project.data) return <p className="text-red-500">Project not found.</p>;
  const data = project.data;

  function setDefaultKey(id: string) {
    setError(null);
    updateProject.mutate(
      { id: data.id, defaultSizingKeyId: id || null },
      { onError: (e) => setError(e.message) }
    );
  }

  function toggleScale(scale: ScaleUnit) {
    const current = data.timelineHeaderScales as ScaleUnit[];
    const next = current.includes(scale) ? current.filter((s) => s !== scale) : [...current, scale];
    updateProject.mutate({ id: data.id, timelineHeaderScales: next });
  }

  function createCompatibleSizingKey() {
    const name = window.prompt('Name for the new sizing key?', `${data.name} sizing`);
    if (name?.trim()) createCompatibleKey.mutate({ projectId: data.id, name: name.trim() });
  }

  const hasCompatibleKey = keys.data?.some((k) => k.compatible) ?? true; // assume yes until loaded, to avoid a flash

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link to={`/projects/${data.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to {data.name}
        </Link>

        <h1 className="text-xl font-semibold text-slate-900 mb-4 mt-1">Project Settings</h1>

        <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
        <input
          className="block w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-3"
          defaultValue={data.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== data.name && updateProject.mutate({ id: data.id, name: e.target.value.trim() })}
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
        <textarea
          className="block w-full border border-slate-300 rounded-md px-3 py-2 text-sm mb-4 resize-none"
          rows={2}
          defaultValue={data.description ?? ''}
          onBlur={(e) => e.target.value !== (data.description ?? '') && updateProject.mutate({ id: data.id, description: e.target.value })}
        />

        <label className="block text-sm font-medium text-slate-700 mb-1">Start date</label>
        <input
          type="date"
          className="border border-slate-300 rounded-md px-3 py-2 text-sm mb-4"
          value={data.startDate ? new Date(data.startDate).toISOString().slice(0, 10) : ''}
          onChange={(e) => updateProject.mutate({ id: data.id, startDate: e.target.value ? new Date(e.target.value) : null })}
        />
        <p className="text-xs text-slate-400 mb-4">
          Leave blank to show the timeline in relative time ("Week 1") instead of real calendar dates.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Size labels</h2>
        <p className="text-xs text-slate-400 mb-2">
          These are this project's own sizing scale — order matters, it defines what "bigger" means when computing
          an initiative's combined size.
        </p>
        <SizeLabelEditor projectId={data.id} labels={data.sizeLabels} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Default sizing key</h2>
        <p className="text-xs text-slate-400 mb-2">
          Only keys that have duration data for every size label above can be selected — incompatible keys are
          disabled below.
        </p>
        <select
          className="border border-slate-300 rounded-md px-3 py-2 text-sm w-full mb-2"
          value={data.defaultSizingKeyId ?? ''}
          onChange={(e) => setDefaultKey(e.target.value)}
        >
          <option value="">— None —</option>
          {keys.data?.map((k) => (
            <option key={k.id} value={k.id} disabled={!k.compatible}>
              {k.name} {k.compatible ? '' : `(missing: ${k.missingCodes.join(', ')})`}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
        {!hasCompatibleKey && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            No sizing key currently covers every size label above.{' '}
            <button type="button" className="underline font-medium" onClick={createCompatibleSizingKey}>
              Create one now
            </button>{' '}
            (it'll start with this project's labels already added) or{' '}
            <Link to="/sizing-keys" className="underline font-medium">
              edit an existing key
            </Link>
            .
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Timeline header scales</h2>
        <p className="text-xs text-slate-400 mb-2">
          Choose which ruler rows show above the Gantt chart. Month/Quarter/Year only appear once a start date is set
          above — there's no real calendar to snap to without one.
        </p>
        <ScaleToggleList selected={data.timelineHeaderScales} hasStartDate={!!data.startDate} onToggle={toggleScale} />
      </div>
    </div>
  );
}
