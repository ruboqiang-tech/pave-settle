import { describe, expect, it } from 'vitest'
import { buildTableSummary, createSummaryFormatters, sumByField, type TableSummaryParams } from './table-summary'

type DemoRow = {
  name: string
  amount: number
  tax: number
}

describe('table-summary', () => {
  it('sumByField keeps numeric totals rounded', () => {
    const rows: DemoRow[] = [
      { name: 'A', amount: 1.111, tax: 0.222 },
      { name: 'B', amount: 2.222, tax: 0.333 },
    ]

    expect(sumByField(rows, 'amount')).toBe(3.333)
    expect(sumByField(rows, 'tax')).toBe(0.555)
  })

  it('buildTableSummary uses the label column and configured field formatters', () => {
    const params: TableSummaryParams<DemoRow> = {
      columns: [{}, { property: 'name' }, { property: 'amount' }, { property: 'tax' }],
      data: [
        { name: 'A', amount: 1.111, tax: 0.222 },
        { name: 'B', amount: 2.222, tax: 0.333 },
      ],
    }

    expect(buildTableSummary(params, {
      formatters: {
        amount: total => `¥${total.toFixed(3)}`,
        tax: total => `税${total.toFixed(3)}`,
      },
    })).toEqual(['', '合计', '¥3.333', '税0.555'])
  })

  it('createSummaryFormatters applies one formatter to multiple fields', () => {
    const params: TableSummaryParams<DemoRow> = {
      columns: [{}, { property: 'name' }, { property: 'amount' }, { property: 'tax' }],
      data: [
        { name: 'A', amount: 1.111, tax: 0.222 },
        { name: 'B', amount: 2.222, tax: 0.333 },
      ],
    }

    expect(buildTableSummary(params, {
      formatters: createSummaryFormatters<DemoRow>(['amount', 'tax'], total => `¥${total.toFixed(3)}`),
    })).toEqual(['', '合计', '¥3.333', '¥0.555'])
  })
})
