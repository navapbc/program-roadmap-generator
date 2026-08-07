import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../trpc.js';
import { parseRoadmapFile, type ImportRow } from '../../lib/roadmapImport.js';

/**
 * Import always creates a brand-new project from a previously-exported
 * roadmap CSV/JSON — it never updates or merges into an existing one. A
 * name collision with an existing project is never silently tolerated or
 * auto-resolved: the user must pick a different name before the import can
 * proceed, which is why the name field stays editable and any collision
 * error surfaces right next to it rather than losing the parsed file.
 */
export default function ImportProjectPanel({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [name, setName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);

  const importRoadmap = trpc.project.importRoadmap.useMutation({
    onSuccess: (result) => {
      utils.project.list.invalidate();
      if (result.warnings.length > 0) {
        window.alert(`Imported with warnings:\n\n${result.warnings.join('\n')}`);
      }
      navigate(`/projects/${result.projectId}`);
      onDone();
    },
  });

  async function handleFile(file: File) {
    setFileError(null);
    importRoadmap.reset();
    try {
      const text = await file.text();
      const parsed = parseRoadmapFile(file.name, text);
      setRows(parsed.rows);
      setName(parsed.suggestedName);
    } catch (err) {
      setRows(null);
      setFileError(err instanceof Error ? err.message : 'Could not read this file.');
    }
  }

  function reset() {
    setRows(null);
    setName('');
    setFileError(null);
    importRoadmap.reset();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const milestoneCount = rows ? new Set(rows.map((r) => r.milestone)).size : 0;

  return (
    <div className="p-4 mb-6 border border-slate-200 rounded-md bg-slate-50">
      <h2 className="text-sm font-semibold text-slate-700 mb-2">Import a roadmap</h2>
      <p className="text-xs text-slate-500 mb-3">
        Import a CSV or JSON roadmap file exported from this app. This always creates a new project — it never updates an
        existing one.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        className="text-sm mb-2 block"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {fileError && <p className="text-sm text-red-600 mb-2">{fileError}</p>}

      {rows && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Project name</label>
            <input
              className="border border-slate-300 rounded-md px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
            disabled={!name.trim() || importRoadmap.isLoading}
            onClick={() => importRoadmap.mutate({ name: name.trim(), rows })}
          >
            {importRoadmap.isLoading ? 'Importing…' : 'Import'}
          </button>
          <button type="button" className="text-sm text-slate-500 hover:text-slate-900" onClick={reset}>
            Cancel
          </button>
          <span className="text-xs text-slate-400">
            {rows.length} initiative{rows.length === 1 ? '' : 's'} across {milestoneCount} milestone{milestoneCount === 1 ? '' : 's'}
          </span>
        </div>
      )}

      {importRoadmap.error && <p className="text-sm text-red-600 mt-2">{importRoadmap.error.message}</p>}
    </div>
  );
}
