import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import InitiativeRow from './InitiativeRow.js';

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

export default function SortableInitiativeRow({
  initiative,
  incrementId,
  sizeLabels,
}: {
  initiative: Initiative;
  incrementId: string;
  sizeLabels: SizeLabel[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: initiative.id,
    data: { type: 'initiative', incrementId },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <InitiativeRow initiative={initiative} sizeLabels={sizeLabels} dragHandleProps={{ attributes, listeners }} />
    </div>
  );
}
