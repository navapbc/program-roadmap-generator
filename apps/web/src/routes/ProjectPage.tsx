import { Link, useParams } from 'react-router-dom';
import { trpc } from '../trpc.js';
import MilestoneColumn from '../components/hierarchy/MilestoneColumn.js';
import { toCSV } from '../lib/csv.js';
import { downloadText } from '../lib/download.js';
import { buildRoadmapRows, ROADMAP_COLUMNS } from '../lib/roadmapExport.js';
import ExportWorkbookButton from '../components/export/ExportWorkbookButton.js';

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const utils = trpc.useUtils();
  const project = trpc.project.getById.useQuery({ id: projectId! }, { enabled: !!projectId });
  const createMilestone = trpc.milestone.create.useMutation({ onSuccess: () => utils.project.getById.invalidate() });

  if (project.isLoading) return <p className="text-slate-500">Loading…</p>;
  if (!project.data) return <p className="text-red-500">Project not found.</p>;

  const { data } = project;

  function exportCSV() {
    const rows = buildRoadmapRows(data);
    downloadText(`${data.name}-roadmap.csv`, 'text/csv', toCSV(rows, ROADMAP_COLUMNS));
  }

  function exportJSON() {
    const rows = buildRoadmapRows(data);
    downloadText(`${data.name}-roadmap.json`, 'application/json', JSON.stringify(rows, null, 2));
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{data.name}</h1>
          {data.description && <p className="text-sm text-slate-500">{data.description}</p>}
        </div>
        <div className="flex gap-3 text-sm">
          <Link to={`/projects/${data.id}/settings`} className="text-slate-500 hover:text-slate-900">
            Settings
          </Link>
          <Link to={`/projects/${data.id}/timeline`} className="text-slate-500 hover:text-slate-900">
            Timeline
          </Link>
          <button className="text-slate-500 hover:text-slate-900" type="button" onClick={exportCSV}>
            Export CSV
          </button>
          <button className="text-slate-500 hover:text-slate-900" type="button" onClick={exportJSON}>
            Export JSON
          </button>
          <ExportWorkbookButton project={data} />
        </div>
      </div>

      {data.sizeLabels.length === 0 && (
        <div className="mb-4 px-4 py-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          This project has no size labels yet.{' '}
          <Link to={`/projects/${data.id}/settings`} className="underline">
            Define them in Settings
          </Link>{' '}
          before sizing initiatives.
        </div>
      )}

      {data.milestones.map((milestone) => (
        <MilestoneColumn key={milestone.id} milestone={milestone} sizeLabels={data.sizeLabels} projectId={data.id} />
      ))}

      <button
        className="text-sm text-slate-500 hover:text-slate-900"
        type="button"
        onClick={() => createMilestone.mutate({ projectId: data.id, name: 'New milestone' })}
      >
        + Add milestone
      </button>
    </div>
  );
}
