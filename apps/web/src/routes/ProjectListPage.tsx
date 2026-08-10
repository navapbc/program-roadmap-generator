import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '../trpc.js';
import ImportProjectPanel from '../components/import/ImportProjectPanel.js';

export default function ProjectListPage() {
  const utils = trpc.useUtils();
  const projects = trpc.project.list.useQuery();
  const createProject = trpc.project.create.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const deleteProject = trpc.project.delete.useMutation({
    onSuccess: () => utils.project.list.invalidate(),
  });
  const [name, setName] = useState('');
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-900 mb-4">Projects</h1>

      <form
        className="flex gap-2 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          createProject.mutate({ name: name.trim() });
          setName('');
        }}
      >
        <input
          className="flex-1 border border-slate-300 rounded-md px-3 py-2 text-sm"
          placeholder="New project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          disabled={createProject.isLoading}
        >
          Create
        </button>
        <button
          type="button"
          className="border border-slate-300 px-4 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={() => setShowImport((v) => !v)}
        >
          Import…
        </button>
      </form>

      {showImport && <ImportProjectPanel onDone={() => setShowImport(false)} />}

      {projects.isLoading && <p className="text-slate-500">Loading…</p>}

      <ul className="divide-y divide-slate-200 border border-slate-200 rounded-md bg-white">
        {projects.data?.map((project) => (
          <li key={project.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <Link to={`/projects/${project.id}`} className="font-medium text-slate-900 hover:underline">
                {project.name}
              </Link>
              {project.description && <p className="text-sm text-slate-500">{project.description}</p>}
            </div>
            <div className="flex gap-3 text-sm">
              <Link to={`/projects/${project.id}/settings`} className="text-slate-500 hover:text-slate-900">
                Settings
              </Link>
              <Link to={`/projects/${project.id}/timeline`} className="text-slate-500 hover:text-slate-900">
                Timeline
              </Link>
              <button
                type="button"
                className="text-red-400 hover:text-red-700"
                onClick={() => window.confirm(`Delete "${project.name}"? This can't be undone.`) && deleteProject.mutate({ id: project.id })}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {projects.data?.length === 0 && <li className="px-4 py-6 text-center text-slate-400">No projects yet.</li>}
      </ul>
    </div>
  );
}
