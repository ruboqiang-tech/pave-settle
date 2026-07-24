import { saveBlobFile, type SaveFileResult } from './file-download'

export type CsvCell = string | number | boolean | null | undefined
export type CsvRow = CsvCell[]
export type CsvObjectRow = Record<string, string>

function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return ''

  const text = String(value)
  if (!/[",\r\n]/.test(text)) {
    return text
  }

  return `"${text.replace(/"/g, '""')}"`
}

export function buildCsvContent(rows: CsvRow[]): string {
  return rows.map(row => row.map(cell => escapeCsvCell(cell)).join(',')).join('\r\n')
}

export function parseCsvContent(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let index = 0
  const text = content.replace(/^\uFEFF/, '')

  while (index < text.length) {
    const char = text[index]
    const next = text[index + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"'
        index += 2
        continue
      }
      if (char === '"') {
        inQuotes = false
        index += 1
        continue
      }
      cell += char
      index += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      index += 1
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      index += 1
      continue
    }
    if (char === '\r' || char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      if (char === '\r' && next === '\n') {
        index += 2
        continue
      }
      index += 1
      continue
    }

    cell += char
    index += 1
  }

  row.push(cell)
  rows.push(row)

  return rows.filter(cells => cells.some(value => value.trim().length > 0))
}

export function parseCsvObjects(content: string): CsvObjectRow[] {
  const [headers = [], ...rows] = parseCsvContent(content)
  const normalizedHeaders = headers.map(header => header.trim())

  return rows.map(row => {
    const result: CsvObjectRow = {}
    normalizedHeaders.forEach((header, index) => {
      if (!header) return
      result[header] = row[index] ?? ''
    })
    return result
  })
}

export async function importCsvFile<T = CsvObjectRow>(file: File): Promise<T[]> {
  return parseCsvObjects(await file.text()) as T[]
}

export async function downloadCsvFile(fileName: string, rows: CsvRow[]): Promise<SaveFileResult> {
  const content = `\uFEFF${buildCsvContent(rows)}`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  return saveBlobFile(blob, {
    fileName: `${fileName}.csv`,
    description: 'CSV 文件',
    mimeType: 'text/csv',
    extensions: ['.csv'],
  })
}
