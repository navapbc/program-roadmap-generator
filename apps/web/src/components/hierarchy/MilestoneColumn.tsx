import { useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { trpc } from '../../trpc.js';
import SortableIncrementBlock from './SortableIncrementBlock.js';
import { useReorder } from '../../hooks/useReorder.js';
import { typeAwareClosestCenter, type DragItemData } from '../../lib/dnd.js';

interface SizeLabel {
  id: string;
  code: string;
  orderIndex: number;
}

interface Initiative {
  id: string;
  name: string;
  orderKey: string;
  policySizeLabelId: string | null;
  implementationSizeLabelId: string | null;
  timeEstimateWeeks: number | null;
  notes: string | null;
}

interface Increment {
  id: string;
  name: string;
  orderKey: string;
  initiatives: Initiative[];
}

interface Milestone {
  id: string;
  name: string;
  increments: Increment[];
}

export default function MilestoneColumn({
  milestone,
  sizeLabels,
  projectId,
}: {
  milestone: Milestone;
  sizeLabels: SizeLabel[];
  projectId: string;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(milestone.name);
  const updateMilestone = trpc.milestone.update.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const deleteMilestone = trpc.milestone.delete.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const createIncrement = trpc.increment.create.useMutation({ onSuccess: () => utils.project.getById.invalidate() });
  const { reorderIncrement, reorderInitiative } = useReorder(projectId);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeData = active.data.current as DragItemData | undefined;
    if (!activeData) return;

    if (activeData.type === 'increment') {
      const ids = milestone.increments.map((i) => i.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      reorderIncrement(milestone.id, oldIndex, newIndex);
    } else if (activeData.type === 'initiative') {
      const incrementId = activeData.incrementId!;
      const overData = over.data.current as DragItemData | undefined;
      // MVP restriction: only reorder within the same increment.
      if (overData?.incrementId !== incrementId) return;
      const increment = milestone.increments.find((i) => i.id === incrementId);
      if (!increment) return;
      const ids = increment.initiatives.map((i) => i.id);
      const oldIndex = ids.indexOf(String(active.id));
      const newIndex = ids.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;
      reorderInitiative(incrementId, oldIndex, newIndex);
    }
  }

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <input
          className="text-lg font-bold text-slate-900 border-none focus:ring-1 focus:ring-slate-300 rounded px-1 -mx-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== milestone.name && updateMilestone.mutate({ id: milestone.id, name: name.trim() })}
        />
        <div className="flex gap-3 text-sm">
          <button
            className="text-slate-500 hover:text-slate-900"
            type="button"
            onClick={() => createIncrement.mutate({ milestoneId: milestone.id, name: 'New increment' })}
          >
            + Add increment
          </button>
          <button className="text-red-400 hover:text-red-700" type="button" onClick={() => deleteMilestone.mutate({ id: milestone.id })}>
            Delete milestone
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={typeAwareClosestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={milestone.increments.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-3">
            {milestone.increments.map((increment) => (
              <SortableIncrementBlock key={increment.id} increment={increment} sizeLabels={sizeLabels} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {milestone.increments.length === 0 && <p className="text-sm text-slate-400">No increments yet.</p>}
    </section>
  );
}
