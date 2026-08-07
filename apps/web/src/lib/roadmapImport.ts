import { fromCSV } from './csv.js';

export interface ImportRow {
  milestone: string;
  increment: string;
  initiative: string;
  policySize: string;
  implementationSize: string;
  timeEstimateWeeks: string;
  notes: string;
}

export interface ParsedRoadmap {
  /** The project name found in the file — always uniform across every row, since an export always comes from one project. */
  suggestedName: string;
  rows: ImportRow[];
}

const REQUIRED_FIELDS = ['project', 'milestone', 'increment', 'initiative'] as const;

function normalizeRow(raw: Record<string, unknown>, rowNumber: number): ImportRow & { project: string } {
  const get = (key: string) => (raw[key] == null ? '' : String(raw[key]));
  for (const field of REQUIRED_FIELDS) {
    if (!get(field).trim()) {
      throw new Error(`Row ${rowNumber} is missing "${field}".`);
    }
  }
  return {
    project: get('project').trim(),
    milestone: get('milestone').trim(),
    increment: get('increment').trim(),
    initiative: get('initiative').trim(),
    policySize: get('policySize').trim(),
    implementationSize: get('implementationSize').trim(),
    timeEstimateWeeks: get('timeEstimateWeeks').trim(),
    notes: get('notes'),
  };
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
  const distinctNames = [...new Set(normalized.map((r) => r.project))];
  if (distinctNames.length > 1) {
    throw new Error(`This file contains more than one project (${distinctNames.join(', ')}) — import one project's export at a time.`);
  }

  return {
    suggestedName: distinctNames[0],
    rows: normalized.map(({ project, ...row }) => row),
  };
}
