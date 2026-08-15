import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import IncrementBlock from './IncrementBlock.js';

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

export default function SortableIncrementBlock({
  increment,
  sizeLabels,
  estimateFields,
  finalSizeFormula,
}: {
  increment: Increment;
  sizeLabels: SizeLabel[];
  estimateFields: EstimateField[];
  finalSizeFormula: 'max' | 'min';
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: increment.id,
    data: { type: 'increment' },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
    >
      <IncrementBlock
        increment={increment}
        sizeLabels={sizeLabels}
        estimateFields={estimateFields}
        finalSizeFormula={finalSizeFormula}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}
