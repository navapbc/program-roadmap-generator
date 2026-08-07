import ExcelJS from 'exceljs';
import { buildRoadmapRows, ROADMAP_COLUMNS } from './roadmapExport.js';

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
  name: string;
  sizeLabels: SizeLabel[];
  milestones: Milestone[];
}

interface KeyLabel {
  code: string;
  orderIndex: number;
}
interface KeyPhase {
  name: string;
  unit: string;
  orderIndex: number;
  durations: { labelCode: string; durationValue: number }[];
}
export interface KeyExportInput {
  name: string;
  description: string | null;
  labels: KeyLabel[];
  phases: KeyPhase[];
  screenshot: { dataUrl: string; width: number; height: number } | null;
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[*?:/\\[\]]/g, '').trim().slice(0, 31) || 'Key';
  let candidate = base;
  let i = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base.slice(0, 28)} ${i}`;
    i++;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Assembles one workbook: a "Project" tab with the flattened roadmap data,
 * plus one tab per sizing key containing that key's label/phase/duration
 * matrix and — at the bottom — a screenshot of the Timeline as it renders
 * with that key selected (captured client-side via html2canvas before this
 * runs; see ExportSizingKeySnapshot).
 */
export async function buildProjectWorkbook(project: ProjectData, keyExports: KeyExportInput[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Program Roadmap Generator';

  const projectSheet = workbook.addWorksheet('Project');
  const headerRow = projectSheet.addRow(ROADMAP_COLUMNS);
  headerRow.font = { bold: true };
  for (const row of buildRoadmapRows(project)) {
    projectSheet.addRow(ROADMAP_COLUMNS.map((c) => row[c]));
  }
  projectSheet.columns.forEach((col) => {
    col.width = 22;
  });

  const usedSheetNames = new Set<string>(['project']);

  for (const keyExport of keyExports) {
    const sheet = workbook.addWorksheet(sanitizeSheetName(keyExport.name, usedSheetNames));

    sheet.getCell('A1').value = keyExport.name;
    sheet.getCell('A1').font = { bold: true, size: 14 };
    let currentRow = 2;
    if (keyExport.description) {
      sheet.getCell(`A${currentRow}`).value = keyExport.description;
      currentRow += 1;
    }
    currentRow += 1;

    const sortedLabels = [...keyExport.labels].sort((a, b) => a.orderIndex - b.orderIndex);
    const sortedPhases = [...keyExport.phases].sort((a, b) => a.orderIndex - b.orderIndex);

    const durationHeaderRow = sheet.getRow(currentRow);
    durationHeaderRow.getCell(1).value = 'Phase';
    durationHeaderRow.getCell(2).value = 'Unit';
    sortedLabels.forEach((label, i) => {
      durationHeaderRow.getCell(3 + i).value = label.code;
    });
    durationHeaderRow.font = { bold: true };
    currentRow += 1;

    for (const phase of sortedPhases) {
      const durationByCode = new Map(phase.durations.map((d) => [d.labelCode, d.durationValue]));
      const row = sheet.getRow(currentRow);
      row.getCell(1).value = phase.name;
      row.getCell(2).value = phase.unit;
      sortedLabels.forEach((label, i) => {
        row.getCell(3 + i).value = durationByCode.get(label.code) ?? null;
      });
      currentRow += 1;
    }
    sheet.columns.forEach((col, i) => {
      col.width = i < 2 ? 16 : 8;
    });

    currentRow += 1;
    if (keyExport.screenshot) {
      const maxWidthPx = 900;
      const scale = Math.min(1, maxWidthPx / keyExport.screenshot.width);
      const imageId = workbook.addImage({ base64: keyExport.screenshot.dataUrl, extension: 'png' });
      // exceljs supports a {tl, ext} anchor (top-left + explicit size) at
      // runtime as an alternative to {tl, br}, but its bundled types only
      // declare the latter — hence the unknown-first cast.
      sheet.addImage(imageId, {
        tl: { col: 0, row: currentRow },
        ext: { width: keyExport.screenshot.width * scale, height: keyExport.screenshot.height * scale },
      } as unknown as ExcelJS.ImageRange);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
