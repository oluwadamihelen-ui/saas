import "server-only";

/// Minimal RFC4180-ish CSV line splitter: handles double-quoted fields,
/// escaped quotes (""), and commas inside quotes. No multi-line quoted
/// fields — a value spanning multiple lines isn't supported.
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/// Splits a whole CSV file into a lowercased header row plus one raw
/// key->value record per data row (missing trailing columns come back as
/// "", matching how a spreadsheet export usually behaves). Blank lines are
/// dropped rather than treated as empty records.
export function parseCsvRecords(csvText: string): { header: string[]; records: Record<string, string>[] } {
  const lines = csvText.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], records: [] };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const records: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    header.forEach((h, idx) => (record[h] = values[idx] ?? ""));
    records.push(record);
  }
  return { header, records };
}

/// Quotes a field only when it needs it (contains a comma, quote, or
/// newline), doubling any internal quotes — the write-side counterpart to
/// parseCsvLine.
function toCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/// Renders a header + rows of plain strings back into CSV text (CRLF line
/// endings, per RFC4180) — used by the data-export routes.
export function rowsToCsv(header: string[], rows: string[][]): string {
  const lines = [header, ...rows].map((row) => row.map(toCsvField).join(","));
  return lines.join("\r\n") + "\r\n";
}
