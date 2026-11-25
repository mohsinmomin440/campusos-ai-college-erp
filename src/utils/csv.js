/**
 * Escapes CSV cells and neutralizes spreadsheet formula injection (=, +, -, @, \t, \r).
 */
export function sanitizeCsvCell(value) {
  const raw = String(value ?? '');
  const formulaProtected = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = formulaProtected.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function exportRowsToCsv(filename, headers, rows) {
  const headerLine = headers.map((h) => sanitizeCsvCell(h.label)).join(',');
  const dataLines = rows.map((row) =>
    headers.map((h) => sanitizeCsvCell(typeof h.accessor === 'function' ? h.accessor(row) : row[h.key])).join(',')
  );
  const csvContent = [headerLine, ...dataLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
