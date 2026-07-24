import { describe, expect, it } from 'vitest'
import {
  createEmptyBoqRow,
  getFilledBoqItems,
  parseImportedBoqRows,
  prepareBoqItemsForSave,
  summarizeBoqAmounts,
  validateBoqItems,
} from './boq'

describe('boq utils', () => {
  it('creates default boq row', () => {
    const row = createEmptyBoqRow(12, 3)

    expect(row.contractId).toBe(12)
    expect(row.sortOrder).toBe(3)
    expect(row.remark).toBe('')
    expect(row.note).toBe('')
    expect(row.unit).toBe('\u33a1')
    expect(row.taxRate).toBe(9)
  })

  it('parses imported rows with aliases and recalculates amounts', () => {
    const rows = parseImportedBoqRows(
      [
        {
          '\u9879\u76ee\u7f16\u7801': 'BOQ-01',
          '\u9879\u76ee\u540d\u79f0': '\u900f\u5c42\u6cb9',
          '\u5355\u4f4d': '\u33a1',
          '\u5de5\u7a0b\u91cf': '100',
          '\u7a0e\u7387%': '9',
          '\u542b\u7a0e\u5355\u4ef7(\u5143)': '2',
          '\u7c7b\u522b': '\u8def\u9762\u5de5\u7a0b',
          '\u7ae0\u53f7': '300',
        },
      ],
      { contractId: 7 },
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      contractId: 7,
      itemCode: 'BOQ-01',
      itemName: '\u900f\u5c42\u6cb9',
      remark: '',
      note: '',
      category: '\u8def\u9762\u5de5\u7a0b',
      chapterCode: '300',
      quantity: 100,
      unitPrice: 2,
      totalPrice: 200,
      sortOrder: 1,
    })
    expect(Number(rows[0].noTaxUnitPrice)).toBeCloseTo(1.835, 3)
  })

  it('filters blank rows and validates incomplete rows', () => {
    const filled = getFilledBoqItems([
      createEmptyBoqRow(1, 1),
      { ...createEmptyBoqRow(1, 2), itemName: '\u7c98\u5c42\u6cb9', unit: '' },
      { ...createEmptyBoqRow(1, 3), itemName: '\u900f\u5c42\u6cb9', unit: '\u33a1' },
    ])

    expect(filled).toHaveLength(2)
    expect(validateBoqItems(filled)).toBe('\u8bf7\u586b\u5199\u6240\u6709\u6e05\u5355\u9879\u7684\u540d\u79f0\u548c\u5355\u4f4d')
    expect(validateBoqItems([filled[1]])).toBeNull()
  })

  it('prepares rows for save and summarizes amounts', () => {
    const rows = [
      {
        ...createEmptyBoqRow(0, 1),
        itemName: 'A',
        unit: '\u33a1',
        noTaxTotalPrice: 100,
        taxAmount: 9,
      },
      {
        ...createEmptyBoqRow(0, 2),
        itemName: 'B',
        unit: '\u33a1',
        noTaxTotalPrice: 50,
        taxAmount: 4.5,
      },
    ]

    const prepared = prepareBoqItemsForSave(99, rows)
    expect(prepared[0].contractId).toBe(99)
    expect(prepared[1].sortOrder).toBe(2)

    const summary = summarizeBoqAmounts(prepared)
    expect(summary).toEqual({
      noTax: 150,
      tax: 13.5,
      total: 163.5,
    })
  })
})
