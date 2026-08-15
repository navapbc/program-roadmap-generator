import { useState } from 'react';
import { trpc } from '../../trpc.js';
import ExportSizingKeySnapshot from './ExportSizingKeySnapshot.js';
import { buildProjectWorkbook, type KeyExportInput } from '../../lib/xlsxExport.js';
import { downloadBlob } from '../../lib/download.js';

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
interface Milestone {
  id: string;
  name: string;
  increments: Increment[];
}
interface ProjectData {
  id: string;
  name: string;
  sizeLabels: SizeLabel[];
  estimateFields: EstimateField[];
  finalSizeFormula: string;
  milestones: Milestone[];
  startDate: string | Date | null;
  timelineHeaderScales: string[];
  sprintLengthBusinessDays: number | null;
  sprintStartWeekday: number | null;
}

type Status = 'idle' | 'capturing' | 'building';

/**
 * One tab per compatible sizing key, each with its own Timeline screenshot
 * captured off-screen in sequence (rendering all of them at once would mean
 * several full Gantt layouts fighting for the same viewport) — see
 * ExportSizingKeySnapshot, which reports back both the PNG and the key's
 * label/phase/duration data it already had loaded for rendering, so this
 * component never needs a second fetch for the same key.  Incompatible
 * keys are skipped: there'd be nothing valid to render for them anyway.
 */
export default function ExportWorkbookButton({ project }: { project: ProjectData }) {
  const keys = trpc.sizingKey.listWithCompatibility.useQuery({ projectId: project.id });
  const [status, setStatus] = useState<Status>('idle');
  const [queueIndex, setQueueIndex] = useState(0);

  const compatibleKeys = keys.data?.filter((k) => k.compatible) ?? [];

  function start() {
    setQueueIndex(0);
    if (compatibleKeys.length > 0) {
      setStatus('capturing');
    } else {
      finish([]);
    }
  }

  async function finish(keyExports: KeyExportInput[]) {
    setStatus('building');
    const blob = await buildProjectWorkbook(project, keyExports);
    downloadBlob(`${project.name}.xlsx`, blob);
    setStatus('idle');
  }

  function handleCaptured(entry: KeyExportInput, capturedSoFar: KeyExportInput[]) {
    const next = [...capturedSoFar, entry];
    if (queueIndex + 1 < compatibleKeys.length) {
      setQueueIndex(queueIndex + 1);
      setPending(next);
    } else {
      finish(next);
    }
  }

  // Accumulated across the sequential capture queue; only ever read/written
  // through handleCaptured, so plain state (not a ref) is fine here.
  const [pending, setPending] = useState<KeyExportInput[]>([]);

  return (
    <>
      <button
        className="text-slate-500 hover:text-slate-900 disabled:opacity-50"
        type="button"
        onClick={start}
        disabled={status !== 'idle'}
      >
        {status === 'idle' ? 'Export XLSX' : status === 'capturing' ? `Capturing (${queueIndex + 1}/${compatibleKeys.length})…` : 'Building…'}
      </button>

      {status === 'capturing' && compatibleKeys[queueIndex] && (
        <div style={{ position: 'fixed', left: -99999, top: 0 }} aria-hidden>
          <ExportSizingKeySnapshot
            project={project}
            sizingKeyId={compatibleKeys[queueIndex].id}
            onCaptured={(snapshot) =>
              handleCaptured(
                {
                  name: snapshot.name,
                  description: snapshot.description,
                  labels: snapshot.labels,
                  phases: snapshot.phases,
                  screenshot: { dataUrl: snapshot.dataUrl, width: snapshot.width, height: snapshot.height },
                },
                pending
              )
            }
          />
        </div>
      )}
    </>
  );
}
