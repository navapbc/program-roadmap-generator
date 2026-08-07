import { useMemo, useRef, useState } from 'react';
import { computeFinalSize, computeTimeline, type PhaseUnit, type ScaleUnit, type TimelineInitiativeInput } from '@roadmap/shared';
import { trpc } from '../trpc.js';
import SizingKeySelector from '../components/timeline/SizingKeySelector.js';
import ScaleToggleList from '../components/timeline/ScaleToggleList.js';
import CombinedTimelineView, { type CombinedScopeGroup } from '../components/timeline/CombinedTimelineView.js';

interface Scope {
  localId: string;
  projectId: string;
  sizingKeyId: string;
  milestoneId: string; // '' = whole project
}

const DEFAULT_SCALES: ScaleUnit[] = ['month', 'week'];

export default function CombinedTimelinePage() {
  const nextId = useRef(0);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [scales, setScales] = useState<ScaleUnit[]>(DEFAULT_SCALES);

  const projects = trpc.project.list.useQuery();

  const completeScopes = scopes.filter((s) => s.projectId && s.sizingKeyId);

  // One useQueries call per data need, however many scopes are complete —
  // this is the tRPC/react-query pattern for a dynamic list of queries
  // without breaking the rules of hooks.
  const projectResults = trpc.useQueries((t) => completeScopes.map((s) => t.project.getById({ id: s.projectId })));
  const keyResults = trpc.useQueries((t) => completeScopes.map((s) => t.sizingKey.getFull({ id: s.sizingKeyId })));

  function addScope() {
    setScopes((prev) => [...prev, { localId: `scope-${nextId.current++}`, projectId: '', sizingKeyId: '', milestoneId: '' }]);
  }
  function updateScope(localId: string, patch: Partial<Scope>) {
    setScopes((prev) => prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)));
  }
  function removeScope(localId: string) {
    setScopes((prev) => prev.filter((s) => s.localId !== localId));
  }

  const hasStartDate = completeScopes.some((_, i) => !!projectResults[i]?.data?.startDate);

  const groups: CombinedScopeGroup[] = useMemo(() => {
    const result: CombinedScopeGroup[] = [];
    completeScopes.forEach((scope, i) => {
      const project = projectResults[i]?.data;
      const key = keyResults[i]?.data;
      if (!project || !key) return;

      const milestones = scope.milestoneId ? project.milestones.filter((m) => m.id === scope.milestoneId) : project.milestones;
      const sequence: TimelineInitiativeInput[] = milestones.flatMap((m) =>
        m.increments.flatMap((inc) =>
          inc.initiatives.map((init) => {
            const finalSize = computeFinalSize(project.sizeLabels, init.policySizeLabelId, init.implementationSizeLabelId);
            return {
              initiativeId: init.id,
              name: init.name,
              finalSizeCode: finalSize?.code ?? null,
              timeEstimateWeeks: init.timeEstimateWeeks,
            };
          })
        )
      );

      const phases = key.phases.map((p) => ({ id: p.id, name: p.name, unit: p.unit as PhaseUnit, orderIndex: p.orderIndex }));
      const durations = key.phases.flatMap((p) => p.durations.map((d) => ({ sizingPhaseId: p.id, labelCode: d.labelCode, durationValue: d.durationValue })));
      const startDate = project.startDate ? new Date(project.startDate) : null;

      const computed = computeTimeline({ sequence, phases, durations, startDate });
      const milestoneLabel = scope.milestoneId ? milestones[0]?.name : null;

      result.push({
        scopeId: scope.localId,
        label: milestoneLabel ? `${project.name} — ${milestoneLabel}` : project.name,
        startDate,
        totalDurationWeeks: computed.totalDurationWeeks,
        rows: computed.rows,
      });
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completeScopes, projectResults, keyResults]);

  function toggleScale(scale: ScaleUnit) {
    setScales((prev) => (prev.includes(scale) ? prev.filter((s) => s !== scale) : [...prev, scale]));
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900 mb-2">Combined Timeline</h1>
      <p className="text-sm text-slate-500 mb-4">
        Compare multiple projects — or individual milestones — on one shared axis, each with its own sizing key.
        Nothing here is saved; it's a scratch view for comparing scenarios.
      </p>

      <div className="space-y-2 mb-4">
        {scopes.map((scope) => (
          <ScopeRow
            key={scope.localId}
            scope={scope}
            projects={projects.data ?? []}
            onChange={(patch) => updateScope(scope.localId, patch)}
            onRemove={() => removeScope(scope.localId)}
          />
        ))}
      </div>

      <button className="text-sm text-slate-500 hover:text-slate-900 mb-4" type="button" onClick={addScope}>
        + Add project or milestone
      </button>

      {scopes.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Header scales</label>
          <ScaleToggleList selected={scales} hasStartDate={hasStartDate} onToggle={toggleScale} />
        </div>
      )}

      {groups.length > 0 && <CombinedTimelineView groups={groups} scales={scales} />}
    </div>
  );
}

function ScopeRow({
  scope,
  projects,
  onChange,
  onRemove,
}: {
  scope: Scope;
  projects: { id: string; name: string }[];
  onChange: (patch: Partial<Scope>) => void;
  onRemove: () => void;
}) {
  const project = trpc.project.getById.useQuery({ id: scope.projectId }, { enabled: !!scope.projectId });

  return (
    <div className="flex items-end gap-2 p-2 border border-slate-200 rounded-md bg-slate-50">
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Project</label>
        <select
          className="border border-slate-300 rounded-md px-2 py-1 text-sm"
          value={scope.projectId}
          onChange={(e) => onChange({ projectId: e.target.value, sizingKeyId: '', milestoneId: '' })}
        >
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {scope.projectId && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Sizing key</label>
          <SizingKeySelector projectId={scope.projectId} value={scope.sizingKeyId || null} onChange={(id) => onChange({ sizingKeyId: id })} />
        </div>
      )}

      {scope.projectId && project.data && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Scope</label>
          <select
            className="border border-slate-300 rounded-md px-2 py-1 text-sm"
            value={scope.milestoneId}
            onChange={(e) => onChange({ milestoneId: e.target.value })}
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

      <button className="text-xs text-red-400 hover:text-red-700 mb-1" type="button" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}
