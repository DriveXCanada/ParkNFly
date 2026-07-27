/**
 * CSV export helper. Pass rows + a column spec ([{ header, value(row) }]) and
 * it builds a CSV and triggers a download. Values are escaped for commas,
 * quotes, and newlines.
 *
 * BACKEND: unchanged after migration — it just serializes whatever records
 * the page already has in memory.
 */

function escapeCell(val) {
  if (val == null) return ''
  const s = String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
    .join('\n')
  return `${header}\n${body}`
}

export function downloadCSV(filename, rows, columns) {
  const csv = toCSV(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
