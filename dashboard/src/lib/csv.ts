/**
 * CSV export utilities — RFC 4180 compliant CSV generation,
 * filename sanitisation, and browser download trigger.
 *
 * Requirements: 14.2, 14.3
 */

/**
 * Escape a single CSV field per RFC 4180:
 * - If the value contains a comma, double-quote, or newline, wrap it in double-quotes.
 * - Any embedded double-quotes are escaped by doubling them.
 */
function escapeField(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate an RFC 4180 compliant CSV string from an array of records.
 *
 * @param data    - Non-empty array of records with string keys.
 * @param columns - Optional ordered list of column headers. If omitted,
 *                  headers are derived from the keys of the first row.
 * @returns A CSV string with CRLF line endings per RFC 4180.
 */
export function generateCSV(
  data: Record<string, unknown>[],
  columns?: string[],
): string {
  if (data.length === 0) return '';

  const headers = columns ?? Object.keys(data[0]);
  const headerLine = headers.map(escapeField).join(',');

  const rows = data.map((row) =>
    headers.map((col) => escapeField(row[col])).join(','),
  );

  return [headerLine, ...rows].join('\r\n');
}

/**
 * Sanitise a string for use as a filesystem-safe CSV filename.
 *
 * - Removes all characters except alphanumeric, hyphens, underscores, and spaces.
 * - Replaces spaces with hyphens.
 * - Lowercases the result.
 * - Appends `.csv` suffix.
 */
export function sanitiseFilename(title: string): string {
  return (
    title
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase() + '.csv'
  );
}

/**
 * Trigger a browser download of CSV content.
 *
 * Creates a Blob, generates a temporary object URL, clicks a hidden anchor
 * element to start the download, then revokes the URL.
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
