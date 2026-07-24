import { describe, expect, it } from 'vitest'
import {
  AMOUNT_PRECISION,
  calculateCumulative,
  calculateCurrentAmount,
  calculateSettlementRatio,
  calculateSettlementTotal,
  formatAmount,
  formatCompactAmount,
  formatRatio,
  generateSettlementNo,
  getNextSettlementSequence,
  roundAmount,
  roundQuantity,
  roundTo,
  sumRounded,
} from './utils/calculations'
import type { SettlementDisplayItem } from './types'

function makeItem(overrides: Partial<SettlementDisplayItem> = {}): SettlementDisplayItem {
  return {
    boqId: 1,
    itemCode: '001',
    itemName: '娴嬭瘯椤圭洰',
    unit: 'm3',
    contractQuantity: 100,
    previousCumulative: 10,
    currentQuantity: 20,
    currentCumulative: 30,
    unitPrice: 12.345,
    currentAmount: 246.9,
    ...overrides,
  }
}

describe('rounding helpers', () => {
  it('uses 3-decimal precision by default', () => {
    expect(AMOUNT_PRECISION).toBe(3)
    expect(roundTo(1.23456)).toBe(1.235)
    expect(roundAmount(1.23444)).toBe(1.234)
    expect(roundQuantity(9.87654)).toBe(9.877)
  })

  it('sums first and rounds once', () => {
    expect(sumRounded([0.1111, 0.2222, 0.3333])).toBe(0.667)
  })
})

describe('calculateCurrentAmount', () => {
  it('multiplies and rounds to 3 decimals', () => {
    expect(calculateCurrentAmount(12.345, 6.789)).toBe(83.81)
  })

  it('handles empty values safely', () => {
    expect(calculateCurrentAmount(0, 99)).toBe(0)
    expect(calculateCurrentAmount(12, 0)).toBe(0)
  })
})

describe('calculateSettlementTotal', () => {
  it('returns base amount and total amount with adjustments', () => {
    const items = [makeItem({ currentAmount: 100.111 }), makeItem({ currentAmount: 200.222 })]
    const result = calculateSettlementTotal(items, 10.001, 20.002, 30.003, 5.001)

    expect(result.baseAmount).toBe(300.333)
    expect(result.totalAmount).toBe(355.338)
  })

  it('returns zero for empty item list', () => {
    expect(calculateSettlementTotal([])).toEqual({ baseAmount: 0, totalAmount: 0 })
  })
})

describe('calculateCumulative', () => {
  it('adds and rounds to 3 decimals', () => {
    expect(calculateCumulative(1.111, 2.222)).toBe(3.333)
    expect(calculateCumulative(0.1, 0.2)).toBe(0.3)
  })
})

describe('calculateSettlementRatio', () => {
  it('returns a 2-decimal percentage', () => {
    expect(calculateSettlementRatio(333.333, 1000)).toBe(33.33)
    expect(calculateSettlementRatio(1200, 1000)).toBe(120)
  })

  it('returns 0 when contract amount is 0', () => {
    expect(calculateSettlementRatio(100, 0)).toBe(0)
  })
})

describe('getNextSettlementSequence', () => {
  it('uses the highest parsed settlement sequence in JS-项目主编号-项目内顺序号', () => {
    expect(getNextSettlementSequence(['JS-001-01', '甲方-结算-202604-008', 'JS-001-03'])).toBe(4)
  })

  it('starts from 1 when there is no system-formatted settlement number', () => {
    expect(getNextSettlementSequence(['甲方-001', '业主-第二次结算', '最终结算A'])).toBe(1)
  })
})

describe('generateSettlementNo', () => {
  it('generates settlement no in JS-项目主编号-项目内顺序号', () => {
    const no = generateSettlementNo('XM-001', 'interim', 7)
    expect(no).toBe('JS-001-07')
  })

  it('keeps final and interim on the same prefix rule', () => {
    const no = generateSettlementNo('XM-001', 'final', 3)
    expect(no).toBe('JS-001-03')
  })
})

describe('formatters', () => {
  it('formats amount with 3 decimals by default', () => {
    expect(formatAmount(1234567.8912)).toBe('1,234,567.891')
    expect(formatAmount(1000)).toBe('1,000.000')
  })

  it('supports custom amount precision', () => {
    expect(formatAmount(123.4567, 2)).toBe('123.46')
    expect(formatAmount(123.4567, 0)).toBe('123')
  })

  it('formats invalid amounts as zero', () => {
    expect(formatAmount(null as unknown as number)).toBe('0.000')
    expect(formatAmount(undefined as unknown as number)).toBe('0.000')
    expect(formatAmount(Number.NaN)).toBe('0.000')
  })

  it('formats ratios with a percent suffix', () => {
    expect(formatRatio(33.333)).toBe('33.33%')
    expect(formatRatio(50, 1)).toBe('50.0%')
  })
})

describe('formatCompactAmount', () => {
  it('formats values >= 1亿 in 亿 units', () => {
    expect(formatCompactAmount(100000000)).toBe('1.00亿')
    expect(formatCompactAmount(150000000)).toBe('1.50亿')
    expect(formatCompactAmount(1230000000)).toBe('12.30亿')
  })

  it('formats values >= 1万 in 万 units', () => {
    expect(formatCompactAmount(10000)).toBe('1.00万')
    expect(formatCompactAmount(50000)).toBe('5.00万')
    expect(formatCompactAmount(9999999)).toBe('1000.00万')
  })

  it('formats small values with default precision', () => {
    expect(formatCompactAmount(0)).toBe('0.000')
    expect(formatCompactAmount(9999)).toBe('9,999.000')
  })

  it('handles negative values', () => {
    expect(formatCompactAmount(-100000000)).toBe('-1.00亿')
    expect(formatCompactAmount(-10000)).toBe('-1.00万')
  })
})

