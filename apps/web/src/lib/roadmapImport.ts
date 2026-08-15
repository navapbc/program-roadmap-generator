import { fromCSV } from './csv.js';

/** One row per initiative. The fixed fields are named explicitly; anything else is one project-defined estimate field's value, keyed by its column header — there's no fixed list of them, unlike the old Policy/Implementation pair. */
export type ImportRow = {
  milestone: string;
  increment: string;
  initiative: string;
  notes?: string;
  timeEstimateWeeks?: string;
} & Record<string, string | undefined>;

export interface ParsedRoadmap {
  /** The project name found in the file — always uniform across every row, since an export always comes from one project. */
  suggestedName: string;
  rows: ImportRow[];
}

const REQUIRED_FIELDS = ['project', 'milestone', 'increment', 'initiative'] as const;

function normalizeRow(raw: Record<string, unknown>, rowNumber: number): ImportRow {
  const get = (key: string) => (raw[key] == null ? '' : String(raw[key]));
  for (const field of REQUIRED_FIELDS) {
    if (!get(field).trim()) {
      throw new Error(`Row ${rowNumber} is missing "${field}".`);
    }
  }
  const row: Record<string, string> = {};
  for (const key of Object.keys(raw)) {
    row[key] = get(key).trim();
  }
  row.notes = get('notes');
  // Required fields' presence was just checked above, so this cast is safe.
  return row as ImportRow;
}

/** Parses a roadmap CSV or JSON file (as produced by this app's own roadmap export) back into import-ready rows. */
export function parseRoadmapFile(filename: string, text: string): ParsedRoadmap {
  const looksLikeJson = /^\s*[[{]/.test(text);
  const isJson = filename.toLowerCase().endsWith('.json') || (!filename.toLowerCase().endsWith('.csv') && looksLikeJson);

  let raw: unknown;
  try {
    raw = isJson ? JSON.parse(text) : fromCSV(text);
  } catch (err) {
    throw new Error(isJson ? 'This file is not valid JSON.' : 'This file could not be parsed as CSV.');
  }

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('The file has no rows to import.');
  }

  const normalized = raw.map((r, i) => normalizeRow(r as Record<string, unknown>, i + 1));
  // 'project' is one of REQUIRED_FIELDS, so normalizeRow already guarantees
  // every row has a non-empty value for it — safe to assert away `undefined`.
  const distinctNames = [...new Set(normalized.map((r) => r.project!))];
  if (distinctNames.length > 1) {
    throw new Error(`This file contains more than one project (${distinctNames.join(', ')}) — import one project's export at a time.`);
  }

  return {
    suggestedName: distinctNames[0],
    rows: normalized.map(({ project, ...row }) => row),
  };
}
