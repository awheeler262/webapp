import { readSheet } from 'read-excel-file/browser'

export type Entry = {
  date: string // %Y-%m-%d
  time: string // %H:%M 24-hour
  systolic: number // > 0
  diastolic: number // > 0
  pulse: number // > 0
  notes: string // empty or any character except delimiter
}

const DELIMITER = ','
const EXPECTED_COLUMNS = ['date', 'time', 'systolic', 'diastolic', 'pulse', 'notes']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// RFC 4180-style split: a field wrapped in "..." may contain the delimiter,
// with "" as an escaped literal quote. Does not span quoted fields across
// multiple physical lines -- rows are already split on newlines beforehand.
function splitCsvRow(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  let atFieldStart = true

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
      continue
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true
      atFieldStart = false
      continue
    }

    if (char === DELIMITER) {
      cells.push(current.trim())
      current = ''
      atFieldStart = true
      continue
    }

    current += char
    if (char.trim() !== '') atFieldStart = false
  }

  cells.push(current.trim())
  return cells
}

function isValidCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year!, month! - 1, day!))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day
  )
}

function validateRow(raw: Record<string, string>, row: number): { entry: Entry; errors: string[] } {
  const errors: string[] = []

  if (!DATE_RE.test(raw.date ?? '') || !isValidCalendarDate(raw.date ?? '')) {
    errors.push(`row ${row}: date "${raw.date}" must match %Y-%m-%d`)
  }

  if (!TIME_RE.test(raw.time ?? '')) {
    errors.push(`row ${row}: time "${raw.time}" must match %H:%M (24-hour)`)
  }

  const systolic = Number(raw.systolic)
  if (!Number.isFinite(systolic) || systolic <= 0) {
    errors.push(`row ${row}: systolic "${raw.systolic}" must be a number > 0`)
  }

  const diastolic = Number(raw.diastolic)
  if (!Number.isFinite(diastolic) || diastolic <= 0) {
    errors.push(`row ${row}: diastolic "${raw.diastolic}" must be a number > 0`)
  }

  const pulse = Number(raw.pulse)
  if (!Number.isFinite(pulse) || pulse <= 0) {
    errors.push(`row ${row}: pulse "${raw.pulse}" must be a number > 0`)
  }

  const notes = raw.notes ?? ''

  return {
    entry: { date: raw.date ?? '', time: raw.time ?? '', systolic, diastolic, pulse, notes },
    errors
  }
}

function checkHeader(header: string[]): void {
  if (header.length !== EXPECTED_COLUMNS.length || EXPECTED_COLUMNS.some((col, i) => header[i] !== col)) {
    throw new Error(`Header must be: ${EXPECTED_COLUMNS.join(DELIMITER)}`)
  }
}

function buildEntries(header: string[], rows: string[][]): Entry[] {
  const parsed: Entry[] = []
  const allErrors: string[] = []

  rows.forEach((cells, index) => {
    const raw: Record<string, string> = {}
    header.forEach((col, i) => { raw[col] = cells[i] ?? '' })

    const { entry, errors } = validateRow(raw, index + 2)
    allErrors.push(...errors)
    parsed.push(entry)
  })

  if (allErrors.length > 0) {
    throw new Error(allErrors.join('\n'))
  }

  return parsed
}

export function parseCsv(text: string): Entry[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) {
    throw new Error('File is empty')
  }

  const header = splitCsvRow(lines[0]!)
  checkHeader(header)

  const rows = lines.slice(1).map(splitCsvRow)
  return buildEntries(header, rows)
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

export async function parseXlsx(file: File): Promise<Entry[]> {
  const rows = await readSheet(file)
  if (rows.length === 0) {
    throw new Error('File is empty')
  }

  const header = rows[0]!.map(stringifyCell)
  checkHeader(header)

  const dataRows = rows.slice(1).map(row => row.map(stringifyCell))
  return buildEntries(header, dataRows)
}
