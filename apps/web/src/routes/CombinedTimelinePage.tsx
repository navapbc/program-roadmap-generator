import { useMemo, useRef, useState } from 'react';
import {
  buildMilestoneBoundaries,
  computeFinalSize,
  computeTimeline,
  dateRangeToWindow,
  isUsabilityCheckpointInitiative,
  type ScaleUnit,
  type PhaseUnit,
  type TimelineInitiativeInput,
} from '@roadmap/shared';
import { trpc } from '../trpc.js';
import SizingKeySelector from '../components/timeline/SizingKeySelector.js';
import ScaleToggleList from '../components/timeline/ScaleToggleList.js';
import CombinedTimelineView, {
  computeSharedTotalWeeks,
  LABEL_COL_WIDTH,
  type CombinedScopeGroup,
} from '../components/timeline/CombinedTimelineView.js';
import { useZoom } from '../hooks/useZoom.js';

interface Scope {
  localId: string;
  projectId: string;
  milestoneId: string; // '' = whole project
  incrementId: string; // '' = whole milestone; only meaningful once milestoneId is set
  sizingKeyId: string;
  startDateOverride: string; // '' = none; view-only, never written to the Project
}

const DEFAULT_SCALES: ScaleUnit[] = ['month', 'week'];
const EMPTY_SCOPE: Omit<Scope, 'localId'> = {
  projectId: '',
  milestoneId: '',
  incrementId: '',
  sizingKeyId: '',
  startDateOverride: '',
};

export default function CombinedTimelinePage() {
  const nextId = useRef(0);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scales, setScales] = useState<ScaleUnit[]>(DEFAULT_SCALES);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewName, setViewName] = useState('');

  const utils = trpc.useUtils();
  const projects = trpc.project.list.useQuery();
  const savedViews = trpc.combinedView.list.useQuery();

  const completeScopes = scopes.filter((s) => s.projectId && s.sizingKeyId);

  // One useQueries call per data need, however many scopes are complete —
  // this is the tRPC/react-query pattern for a dynamic list of queries
  // without breaking the rules of hooks.
  const projectResults = trpc.useQueries((t) => completeScopes.map((s) => t.project.getById({ id: s.projectId })));
  const keyResults = trpc.useQueries((t) => completeScopes.map((s) => t.sizingKey.getFull({ id: s.sizingKeyId })));
  const markerResults = trpc.useQueries((t) => completeScopes.map((s) => t.marker.listForProject({ projectId: s.projectId })));

  function addScope() {
    setScopes((prev) => [...prev, { localId: `scope-${nextId.current++}`, ...EMPTY_SCOPE }]);
  }
  function updateScope(localId: string, patch: Partial<Scope>) {
    setScopes((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  }
  function removeScope(localId: string) {
    setScopes((prev) => prev.filter((s) => s.localId !== localId));
  }

  const hasSprintCadence = completeScopes.some(
    (_, i) => !!projectResults[i]?.data?.startDate && projectResults[i]?.data?.sprintLengthBusinessDays != null
  );

  // A scope's effective start date is its project's own date, or (only when
  // the project has none) the view-only override entered for it. Once ANY
  // scope in the comparison has an effective date — from either source —
  // every other scope needs one too to be meaningfully plotted on the same
  // real calendar axis; a scope that still lacks one is left out of
  // rendering entirely rather than silently plotted at a wrong offset.
  const effectiveStartDates = completeScopes.map((s, i) => {
    const project = projectResults[i]?.data;
    if (project?.startDate) return new Date(project.startDate);
    if (s.startDateOverride) return new Date(s.startDateOverride);
    return null;
  });
  const effectiveStartDateByLocalId = new Map(completeScopes.map((s, i) => [s.localId, effectiveStartDates[i]]));
  const anyAnchored = effectiveStartDates.some((d) => d != null);
  const hasStartDate = anyAnchored;

  const groups: CombinedScopeGroup[] = useMemo(() => {
    const result: CombinedScopeGroup[] = [];
    completeScopes.forEach((scope, i) => {
      const project = projectResults[i]?.data;
      const key = keyResults[i]?.data;
      const startDate = effectiveStartDates[i];
      if (!project || !key) return;
      if (anyAnchored && !startDate) return; // needs a forced override, not yet supplied

      const milestones = (scope.milestoneId ? project.milestones.filter((m) => m.id === scope.milestoneId) : project.milestones).map(
        (m) => ({
          ...m,
          increments: scope.incrementId ? m.increments.filter((inc) => inc.id === scope.incrementId) : m.increments,
        })
      );
      const sequence: TimelineInitiativeInput[] = milestones.flatMap((m) =>
        m.increments.flatMap((inc) =>
          inc.initiatives.map((init) => {
            const finalSize = computeFinalSize(project.sizeLabels, init.policySizeLabelId, init.implementationSizeLabelId);
            return {
              initiativeId: init.id,
              name: init.name,
              finalSizeCode: finalSize?.code ?? null,
              timeEstimateWeeks: init.timeEstimateWeeks,
              incrementId: inc.id,
              isUsabilityCheckpoint: key.usabilityGateEnabled
                ? isUsabilityCheckpointInitiative(init.name, init.timeEstimateWeeks)
                : false,
            };
          })
        )
      );

      const phases = key.phases.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit as PhaseUnit,
        orderIndex: p.orderIndex,
        canOverlap: p.canOverlap,
      }));
      const durations = key.phases.flatMap((p) => p.durations.map((d) => ({ sizingPhaseId: p.id, labelCode: d.labelCode, durationValue: d.durationValue })));

      const computed = computeTimeline({ sequence, phases, durations, startDate, maxOverlap: key.maxOverlap });
      const milestoneBoundaries = buildMilestoneBoundaries(milestones);
      const milestoneLabel = scope.milestoneId ? milestones[0]?.name : null;
      const incrementLabel = scope.incrementId ? milestones[0]?.increments[0]?.name : null;
      const sprintCadence =
        project.sprintLengthBusinessDays != null && project.sprintStartWeekday != null
          ? { lengthBusinessDays: project.sprintLengthBusinessDays, startWeekday: project.sprintStartWeekday }
          : null;

      const markers = startDate
        ? (markerResults[i]?.data ?? []).map((m) => ({
            id: m.id,
            label: m.label,
            offsetWeeks: (new Date(m.date).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7),
          }))
        : [];

      result.push({
        scopeId: scope.localId,
        label: `${[project.name, milestoneLabel, incrementLabel].filter(Boolean).join(' — ')} (${key.name})`,
        startDate,
        sprintCadence,
        totalDurationWeeks: computed.totalDurationWeeks,
        rows: computed.rows,
        milestoneBoundaries,
        markers,
      });
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeScopes, projectResults, keyResults, markerResults, anyAnchored]);

  const zoom = useZoom(groups.length > 0 ? computeSharedTotalWeeks(groups) : 1, LABEL_COL_WIDTH);

  // The date-range window is expressed relative to the same shared origin
  // CombinedTimelineView anchors its axis to — the earliest effective start
  // date across all rendered scopes.
  const sharedOrigin = groups.map((g) => g.startDate).filter((d): d is Date => d != null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const dateWindow = dateRangeToWindow(sharedOrigin, rangeStart ? new Date(rangeStart) : null, rangeEnd ? new Date(rangeEnd) : null);

  function toggleScale(scale: ScaleUnit) {
    setScales((prev) => (prev.includes(scale) ? prev.filter((s) => s !== scale) : [...prev, scale]));
  }

  // --- Save / load named views ---

  function scopesToInput(list: Scope[]) {
    return list
      .filter((s) => s.projectId && s.sizingKeyId)
      .map((s) => ({
        projectId: s.projectId,
        milestoneId: s.milestoneId || null,
        incrementId: s.incrementId || null,
        sizingKeyId: s.sizingKeyId,
        startDateOverride: s.startDateOverride ? new Date(s.startDateOverride) : null,
      }));
  }

  const createView = trpc.combinedView.create.useMutation({
    onSuccess: (view) => {
      utils.combinedView.list.invalidate();
      setViewId(view.id);
    },
  });
  const updateView = trpc.combinedView.update.useMutation({ onSuccess: () => utils.combinedView.list.invalidate() });
  const deleteView = trpc.combinedView.delete.useMutation({
    onSuccess: (_data, variables) => {
      utils.combinedView.list.invalidate();
      if (variables.id === viewId) {
        setViewId(null);
        setViewName('');
      }
    },
  });

  function saveView() {
    if (!viewName.trim()) return;
    const input = {
      name: viewName.trim(),
      timelineHeaderScales: scales,
      dateRangeStart: rangeStart ? new Date(rangeStart) : null,
      dateRangeEnd: rangeEnd ? new Date(rangeEnd) : null,
      scopes: scopesToInput(scopes),
    };
    if (viewId) {
      updateView.mutate({ id: viewId, ...input });
    } else {
      createView.mutate(input);
    }
  }

  function saveAsNew() {
    const name = window.prompt('Name for this new saved view?', viewName ? `${viewName} (copy)` : '');
    if (!name?.trim()) return;
    createView.mutate({
      name: name.trim(),
      timelineHeaderScales: scales,
      dateRangeStart: rangeStart ? new Date(rangeStart) : null,
      dateRangeEnd: rangeEnd ? new Date(rangeEnd) : null,
      scopes: scopesToInput(scopes),
    });
    setViewName(name.trim());
  }

  async function loadView(id: string) {
    if (!id) {
      setViewId(null);
      setViewName('');
      setScopes([]);
      setScales(DEFAULT_SCALES);
      setRangeStart('');
      setRangeEnd('');
      return;
    }
    const view = await utils.combinedView.getById.fetch({ id });
    setViewId(view.id);
    setViewName(view.name);
    setScales(view.timelineHeaderScales as ScaleUnit[]);
    setRangeStart(view.dateRangeStart ? new Date(view.dateRangeStart).toISOString().slice(0, 10) : '');
    setRangeEnd(view.dateRangeEnd ? new Date(view.dateRangeEnd).toISOString().slice(0, 10) : '');
    setScopes(
      view.scopes.map((s) => ({
        localId: `scope-${nextId.current++}`,
        projectId: s.projectId,
        milestoneId: s.milestoneId ?? '',
        incrementId: s.incrementId ?? '',
        sizingKeyId: s.sizingKeyId,
        startDateOverride: s.startDateOverride ? new Date(s.startDateOverride).toISOString().slice(0, 10) : '',
      }))
    );
  }

  return (
    <div>
      <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Combined Timeline</h1>
      <p className="text-sm text-slate-500 mb-4">
        Compare multiple projects — down to a specific milestone or increment — on one shared axis, each with its own
        sizing key.
      </p>

      <div className="mb-4">
        <h2 className="text-xs font-medium text-slate-500 mb-1">Saved views</h2>
        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white">
          <li className={`px-4 py-2 flex items-center justify-between ${viewId === null ? 'bg-slate-100' : ''}`}>
            <button
              type="button"
              className={viewId === null ? 'font-medium text-slate-900' : 'text-slate-700 hover:underline'}
              onClick={() => loadView('')}
            >
              New (unsaved) view
            </button>
          </li>
          {savedViews.data?.map((v) => (
            <li key={v.id} className={`px-4 py-2 flex items-center justify-between ${viewId === v.id ? 'bg-slate-100' : ''}`}>
              <button
                type="button"
                className={viewId === v.id ? 'font-medium text-slate-900' : 'text-slate-700 hover:underline'}
                onClick={() => loadView(v.id)}
              >
                {v.name}
              </button>
              <button
                type="button"
                className="text-sm text-red-400 hover:text-red-700"
                onClick={() => window.confirm(`Delete the saved view "${v.name}"?`) && deleteView.mutate({ id: v.id })}
              >
                Delete
              </button>
            </li>
          ))}
          {savedViews.data?.length === 0 && <li className="px-4 py-6 text-center text-slate-400">No saved views yet.</li>}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-slate-50 border border-slate-200 rounded-md">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
          <input
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
            placeholder="Name this view to save it"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="bg-slate-900 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
          disabled={!viewName.trim() || createView.isLoading || updateView.isLoading}
          onClick={saveView}
        >
          {viewId ? 'Update' : 'Save'}
        </button>
        {viewId && (
          <button type="button" className="text-sm text-slate-500 hover:text-slate-900" onClick={saveAsNew}>
            Save as new
          </button>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {scopes.map((scope) => (
          <ScopeRow
            key={scope.localId}
            scope={scope}
            projects={projects.data ?? []}
            anyAnchored={anyAnchored}
            hasEffectiveStartDate={effectiveStartDateByLocalId.get(scope.localId) != null}
            onChange={(patch) => updateScope(scope.localId, patch)}
            onRemove={() => removeScope(scope.localId)}
          />
        ))}
      </div>

      <button className="text-sm text-slate-500 hover:text-slate-900 mb-4" type="button" onClick={addScope}>
        + Add project, milestone, or increment
      </button>

      {scopes.length > 0 && (
        <div className="flex flex-wrap items-end gap-6 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Header scales</label>
            <ScaleToggleList
              selected={scales}
              hasStartDate={hasStartDate}
              hasSprintCadence={hasSprintCadence}
              pixelsPerWeek={zoom.pixelsPerWeek}
              onToggle={toggleScale}
            />
          </div>
          {hasStartDate && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Date range <span className="text-slate-400">(optional — only show this span)</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
                <span className="text-slate-400 text-sm">to</span>
                <input
                  type="date"
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
                {(rangeStart || rangeEnd) && (
                  <button
                    type="button"
                    className="text-xs text-slate-500 hover:text-slate-900 ml-1"
                    onClick={() => {
                      setRangeStart('');
                      setRangeEnd('');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      </div>

      {groups.length > 0 && <CombinedTimelineView groups={groups} scales={scales} zoom={zoom} dateWindow={dateWindow} />}
    </div>
  );
}

function ScopeRow({
  scope,
  projects,
  anyAnchored,
  hasEffectiveStartDate,
  onChange,
  onRemove,
}: {
  scope: Scope;
  projects: { id: string; name: string }[];
  anyAnchored: boolean;
  hasEffectiveStartDate: boolean;
  onChange: (patch: Partial<Scope>) => void;
  onRemove: () => void;
}) {
  const project = trpc.project.getById.useQuery({ id: scope.projectId }, { enabled: !!scope.projectId });

  const selectedMilestone = scope.milestoneId ? project.data?.milestones.find((m) => m.id === scope.milestoneId) : null;
  const projectHasOwnStartDate = !!project.data?.startDate;
  const needsOverride = !!scope.projectId && !!scope.sizingKeyId && anyAnchored && !projectHasOwnStartDate && !hasEffectiveStartDate;

  return (
    <div className="flex items-end gap-2 p-2 border border-slate-200 rounded-md bg-slate-50 flex-wrap">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
        <select
          className="border border-slate-300 rounded-md px-2 py-1 text-sm"
          value={scope.projectId}
          onChange={(e) => onChange({ projectId: e.target.value, milestoneId: '', incrementId: '', sizingKeyId: '', startDateOverride: '' })}
        >
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {scope.projectId && project.data && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Milestone</label>
          <select
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
            value={scope.milestoneId}
            onChange={(e) => onChange({ milestoneId: e.target.value, incrementId: '' })}
          >
            <option value="">Whole project</option>
            {project.data.milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope.milestoneId && selectedMilestone && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Increment</label>
          <select
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
            value={scope.incrementId}
            onChange={(e) => onChange({ incrementId: e.target.value })}
          >
            <option value="">Whole milestone</option>
            {selectedMilestone.increments.map((inc) => (
              <option key={inc.id} value={inc.id}>
                {inc.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {scope.projectId && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Sizing key</label>
          <SizingKeySelector projectId={scope.projectId} value={scope.sizingKeyId || null} onChange={(id) => onChange({ sizingKeyId: id })} />
        </div>
      )}

      {needsOverride && (
        <div>
          <label className="block text-xs font-medium text-amber-700 mb-1">
            Start date <span className="font-normal">(required — this project has none; used only for this view)</span>
          </label>
          <input
            type="date"
            className="border border-amber-400 rounded-md px-3 py-2 text-sm"
            value={scope.startDateOverride}
            onChange={(e) => onChange({ startDateOverride: e.target.value })}
          />
        </div>
      )}

      <button className="text-xs text-red-400 hover:text-red-700 mb-1" type="button" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
