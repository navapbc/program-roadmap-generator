import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import InitiativeRow from './InitiativeRow.js';

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

export default function SortableInitiativeRow({
  initiative,
  incrementId,
  sizeLabels,
  estimateFields,
  finalSizeFormula,
}: {
  initiative: Initiative;
  incrementId: string;
  sizeLabels: SizeLabel[];
  estimateFields: EstimateField[];
  finalSizeFormula: 'max' | 'min';
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
      <InitiativeRow
        initiative={initiative}
        sizeLabels={sizeLabels}
        estimateFields={estimateFields}
        finalSizeFormula={finalSizeFormula}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}
