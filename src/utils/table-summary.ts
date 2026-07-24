import { roundAmount } from './calculations'

export type TableSummaryColumn = {
  property?: string
}

export type TableSummaryParams<T> = {
  columns: TableSummaryColumn[]
  data: T[]
}

export type SummaryField<T> = Extract<keyof T, string>
export type SummaryFormatter = (total: number) => string

export interface SummaryOptions<T extends object> {
  labelColumnIndex?: number | null
  label?: string
  formatters: Partial<Record<SummaryField<T>, SummaryFormatter>>
}

export function createSummaryFormatters<T extends object>(
  fields: readonly SummaryField<T>[],
  formatter: SummaryFormatter,
): Partial<Record<SummaryField<T>, SummaryFormatter>> {
  return fields.reduce<Partial<Record<SummaryField<T>, SummaryFormatter>>>((result, field) => {
    result[field] = formatter
    return result
  }, {})
}

export function sumByField<T extends object>(rows: T[], field: SummaryField<T>): number {
  return roundAmount(rows.reduce((sum, row) => {
    const value = (row as Record<string, unknown>)[field]
    return sum + Number(value ?? 0)
  }, 0))
}

export function buildTableSummary<T extends object>(
  params: TableSummaryParams<T>,
  options: SummaryOptions<T>,
): string[] {
  const labelColumnIndex = options.labelColumnIndex === undefined ? 1 : options.labelColumnIndex

  return params.columns.map((column, index) => {
    if (labelColumnIndex !== null && index === labelColumnIndex) return options.label ?? '合计'

    const property = column.property as SummaryField<T> | undefined
    if (!property) return ''

    const formatter = options.formatters[property]
    if (!formatter) return ''

    return formatter(sumByField(params.data, property))
  })
}
