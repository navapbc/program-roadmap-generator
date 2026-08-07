import { useState } from 'react';
import { computeFinalSize } from '@roadmap/shared';
import { trpc } from '../../trpc.js';

interface SizeLabel {
  id: string;
  code: string;
  orderIndex: number;
}

interface Initiative {
  id: string;
  name: string;
  policySizeLabelId: string | null;
  implementationSizeLabelId: string | null;
  timeEstimateWeeks: number | null;
  notes: string | null;
}

interface DragHandleProps {
  attributes?: any;
  listeners?: any;
}

export default function InitiativeRow({
  initiative,
  sizeLabels,
  dragHandleProps,
}: {
  initiative: Initiative;
  sizeLabels: SizeLabel[];
  dragHandleProps?: DragHandleProps;
}) {
  const utils = trpc.useUtils();
  const update = trpc.initiative.update.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const remove = trpc.initiative.delete.useMutation({ onSuccess: () => utils.project.getById.invalidate() });

  const [name, setName] = useState(initiative.name);
  const [notes, setNotes] = useState(initiative.notes ?? '');
  const [policyId, setPolicyId] = useState(initiative.policySizeLabelId);
  const [implId, setImplId] = useState(initiative.implementationSizeLabelId);
  const [estimate, setEstimate] = useState(initiative.timeEstimateWeeks);
  const [mode, setMode] = useState<'size' | 'estimate'>(initiative.timeEstimateWeeks != null ? 'estimate' : 'size');

  const finalSize = computeFinalSize(sizeLabels, policyId, implId);

  function switchMode(next: 'size' | 'estimate') {
    setMode(next);
    if (next === 'estimate') {
      setPolicyId(null);
      setImplId(null);
      update.mutate({ id: initiative.id, timeEstimateWeeks: estimate ?? 1 });
      if (estimate == null) setEstimate(1);
    } else {
      setEstimate(null);
      update.mutate({ id: initiative.id, policySizeLabelId: policyId ?? sizeLabels[0]?.id ?? null });
      if (!policyId && sizeLabels[0]) setPolicyId(sizeLabels[0].id);
    }
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-2 items-start px-3 py-2 border-t border-slate-100 bg-white">
      <button
        type="button"
        className="cursor-grab text-slate-300 hover:text-slate-500 self-center touch-none"
        title="Drag to reorder within this increment"
        {...(dragHandleProps?.attributes ?? {})}
        {...(dragHandleProps?.listeners ?? {})}
      >
        ⠿
      </button>

      <div>
        <input
          className="w-full border-none text-sm font-medium text-slate-900 focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== initiative.name && update.mutate({ id: initiative.id, name: name.trim() })}
        />
        <textarea
          className="w-full mt-1 border-none text-xs text-slate-500 focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1 resize-none"
          rows={1}
          placeholder="Notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => notes !== (initiative.notes ?? '') && update.mutate({ id: initiative.id, notes: notes || null })}
        />
      </div>

      {mode === 'size' ? (
        <>
          <SizeSelect
            label="Policy"
            value={policyId}
            options={sizeLabels}
            onChange={(v) => {
              setPolicyId(v);
              update.mutate({ id: initiative.id, policySizeLabelId: v });
            }}
          />
          <SizeSelect
            label="Impl."
            value={implId}
            options={sizeLabels}
            onChange={(v) => {
              setImplId(v);
              update.mutate({ id: initiative.id, implementationSizeLabelId: v });
            }}
          />
          <div className="w-20">
            <div className="text-[10px] uppercase text-slate-400">Final</div>
            <div className={`text-sm font-semibold ${finalSize ? 'text-slate-900' : 'text-amber-600'}`}>
              {finalSize?.code ?? 'Unsized'}
            </div>
          </div>
        </>
      ) : (
        <div className="col-span-3 w-40">
          <div className="text-[10px] uppercase text-slate-400">Time estimate (weeks)</div>
          <input
            type="number"
            min={0.5}
            step={0.5}
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            value={estimate ?? ''}
            onChange={(e) => setEstimate(e.target.value === '' ? null : Number(e.target.value))}
            onBlur={() => estimate != null && update.mutate({ id: initiative.id, timeEstimateWeeks: estimate })}
          />
        </div>
      )}

      <button
        className="text-xs text-slate-400 hover:text-slate-700 underline whitespace-nowrap self-center"
        onClick={() => switchMode(mode === 'size' ? 'estimate' : 'size')}
        type="button"
      >
        {mode === 'size' ? 'Use estimate' : 'Use sizing'}
      </button>

      <button
        className="text-xs text-red-400 hover:text-red-700 self-center"
        onClick={() => remove.mutate({ id: initiative.id })}
        type="button"
        title="Delete initiative"
      >
        ✕
      </button>
    </div>
  );
}

function SizeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: SizeLabel[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="w-20">
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <select
        className="w-full border border-slate-300 rounded px-1 py-1 text-sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.code}
          </option>
        ))}
      </select>
    </div>
  );
}
