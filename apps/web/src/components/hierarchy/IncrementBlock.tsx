import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { trpc } from '../../trpc.js';
import SortableInitiativeRow from './SortableInitiativeRow.js';

interface SizeLabel {
  id: string;
  code: string;
  orderIndex: number;
}

interface EstimateField {
  id: string;
  name: string;
  orderIndex: number;
}

interface InitiativeEstimateValue {
  estimateFieldId: string;
  sizeLabelId: string;
}

interface Initiative {
  id: string;
  name: string;
  estimateValues: InitiativeEstimateValue[];
  timeEstimateWeeks: number | null;
  notes: string | null;
}

interface Increment {
  id: string;
  name: string;
  initiatives: Initiative[];
}

interface DragHandleProps {
  attributes?: any;
  listeners?: any;
}

export default function IncrementBlock({
  increment,
  sizeLabels,
  estimateFields,
  finalSizeFormula,
  dragHandleProps,
}: {
  increment: Increment;
  sizeLabels: SizeLabel[];
  estimateFields: EstimateField[];
  finalSizeFormula: 'max' | 'min';
  dragHandleProps?: DragHandleProps;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(increment.name);
  const updateIncrement = trpc.increment.update.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const deleteIncrement = trpc.increment.delete.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const createInitiative = trpc.initiative.create.useMutation({ onSuccess: () => utils.project.getById.invalidate() });

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-100 border-b border-slate-200">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            className="shrink-0 cursor-grab text-slate-400 hover:text-slate-700 touch-none"
            title="Drag to reorder this increment"
            {...(dragHandleProps?.attributes ?? {})}
            {...(dragHandleProps?.listeners ?? {})}
          >
            ⠿⠿
          </button>
          <input
            className="w-full min-w-0 bg-transparent font-semibold text-sm text-slate-800 border-none focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name !== increment.name && updateIncrement.mutate({ id: increment.id, name: name.trim() })}
          />
        </div>
        <button
          className="shrink-0 text-xs text-red-400 hover:text-red-700"
          type="button"
          onClick={() => deleteIncrement.mutate({ id: increment.id })}
        >
          Delete increment
        </button>
      </div>

      <div>
        <SortableContext items={increment.initiatives.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {increment.initiatives.map((initiative) => (
            <SortableInitiativeRow
              key={initiative.id}
              initiative={initiative}
              incrementId={increment.id}
              sizeLabels={sizeLabels}
              estimateFields={estimateFields}
              finalSizeFormula={finalSizeFormula}
            />
          ))}
        </SortableContext>
        {increment.initiatives.length === 0 && (
          <p className="px-3 py-3 text-xs text-slate-400">No initiatives yet.</p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-200">
        <button
          className="text-xs text-slate-500 hover:text-slate-900"
          type="button"
          onClick={() => createInitiative.mutate({ incrementId: increment.id, name: 'New initiative' })}
        >
          + Add initiative
        </button>
      </div>
    </div>
  );
}
