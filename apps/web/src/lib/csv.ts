/** Minimal RFC 4180-ish CSV encoder — quotes any field containing a comma, quote, or newline. */
function escapeCsvField(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCSV<T extends object>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.map((c) => escapeCsvField(c)).join(',');
  const lines = rows.map((row) => columns.map((col) => escapeCsvField(row[col])).join(','));
  return [header, ...lines].join('\r\n');
}

// Mirrors toCSV's own quoting rules exactly (quote on comma/quote/newline,
// escape a quote as ""). Tolerates either CRLF or bare LF line endings,
// since a hand-edited re-import might not have gone through a Windows tool.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (char === '"') {
        inQuotes = false;
        i++;
      } else {
        field += char;
        i++;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      row.push(field);
      field = '';
      i++;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else {
      field += char;
      i++;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parses a CSV previously produced by toCSV back into one object per data row, keyed by its header. */
export function fromCSV(text: string): Record<string, string>[] {
  const rows = parseCsvRows(text).filter((r) => !(r.length === 1 && r[0] === ''));
  if (rows.length === 0) return [];
  const [header, ...dataRows] = rows;
  return dataRows.map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key] = row[i] ?? '';
    });
    return obj;
  });
}
