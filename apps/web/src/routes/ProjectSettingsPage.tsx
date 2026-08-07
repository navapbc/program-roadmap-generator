import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ScaleUnit } from '@roadmap/shared';
import { trpc } from '../trpc.js';
import SizeLabelEditor from '../components/sizing/SizeLabelEditor.js';
import MarkerEditor from '../components/sizing/MarkerEditor.js';
import ScaleToggleList from '../components/timeline/ScaleToggleList.js';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const project = trpc.project.getById.useQuery({ id: projectId! }, { enabled: !!projectId });
  const keys = trpc.sizingKey.listWithCompatibility.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const markers = trpc.marker.listForProject.useQuery({ projectId: projectId! }, { enabled: !!projectId });
  const updateProject = trpc.project.update.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const createCompatibleKey = trpc.sizingKey.createCompatible.useMutation({
    onSuccess: (key) => {
      utils.sizingKey.list.invalidate();
      utils.sizingKey.listWithCompatibility.invalidate({ projectId: projectId! });
      navigate(`/sizing-keys/${key.id}`);
    },
  });
  const [error, setError] = useState<string | null>(null);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [sprintLength, setSprintLength] = useState('');
  const [sprintWeekday, setSprintWeekday] = useState('');

  useEffect(() => {
    if (project.data?.sprintLengthBusinessDays != null) setSprintLength(String(project.data.sprintLengthBusinessDays));
    if (project.data?.sprintStartWeekday != null) setSprintWeekday(String(project.data.sprintStartWeekday));
  }, [project.data?.sprintLengthBusinessDays, project.data?.sprintStartWeekday]);

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

  function saveSprintCadence() {
    setSprintError(null);
    const length = sprintLength === '' ? null : Number(sprintLength);
    const weekday = sprintWeekday === '' ? null : Number(sprintWeekday);
    if ((length == null) !== (weekday == null)) {
      setSprintError('Set both a sprint length and a start weekday, or clear both.');
      return;
    }
    updateProject.mutate(
      { id: data.id, sprintLengthBusinessDays: length, sprintStartWeekday: weekday },
      { onError: (e) => setSprintError(e.message) }
    );
  }

  function clearSprintCadence() {
    setSprintLength('');
    setSprintWeekday('');
    setSprintError(null);
    updateProject.mutate({ id: data.id, sprintLengthBusinessDays: null, sprintStartWeekday: null });
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
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Sprint cadence</h2>
        <p className="text-xs text-slate-400 mb-2">
          Optional. Set both to add a "Sprint" ruler row to the Timeline, anchored to this project's start date —
          every sprint begins on the chosen weekday, running for however many calendar days it takes to cover that
          many business days.
        </p>
        <div className="flex items-end gap-2 mb-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Length (business days)</label>
            <input
              type="number"
              min={1}
              step={1}
              className="border border-slate-300 rounded-md px-2 py-1 text-sm w-32"
              value={sprintLength}
              onChange={(e) => setSprintLength(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Starts on</label>
            <select
              className="border border-slate-300 rounded-md px-2 py-1 text-sm"
              value={sprintWeekday}
              onChange={(e) => setSprintWeekday(e.target.value)}
            >
              <option value="">—</option>
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <button className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm" type="button" onClick={saveSprintCadence}>
            Save
          </button>
          {(data.sprintLengthBusinessDays != null || sprintLength !== '' || sprintWeekday !== '') && (
            <button className="text-sm text-slate-500 hover:text-slate-900" type="button" onClick={clearSprintCadence}>
              Clear
            </button>
          )}
        </div>
        {sprintError && <p className="text-sm text-red-600 mb-2">{sprintError}</p>}
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
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Key dates</h2>
        <p className="text-xs text-slate-400 mb-2">
          Named points in time — e.g. a target launch date — shown as a vertical line with a label on the Timeline.
          Only appears once a start date is set above.
        </p>
        <MarkerEditor projectId={data.id} markers={markers.data ?? []} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Timeline header scales</h2>
        <p className="text-xs text-slate-400 mb-2">
          Choose which ruler rows show above the Gantt chart. Month/Quarter/Year only appear once a start date is set
          above — there's no real calendar to snap to without one.
        </p>
        <ScaleToggleList
          selected={data.timelineHeaderScales}
          hasStartDate={!!data.startDate}
          hasSprintCadence={data.sprintLengthBusinessDays != null}
          onToggle={toggleScale}
        />
      </div>
    </div>
  );
}
