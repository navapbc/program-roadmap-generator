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
