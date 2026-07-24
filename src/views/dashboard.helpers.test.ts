import { describe, expect, it } from 'vitest'
import {
  buildTrendDisplayLabels,
  getCurrentPeriodAmount,
  getCurrentPeriodTitle,
  getTrendSummaryLabel,
  sumTrendAmounts,
  trendSpanOptionMap,
} from './dashboard.helpers'

describe('dashboard.helpers', () => {
  it('provides span options for month and year trend modes', () => {
    expect(trendSpanOptionMap.month).toEqual([3, 6, 12, 24, 36])
    expect(trendSpanOptionMap.year).toEqual([1, 2, 3, 5])
  })

  it('builds readable trend labels for month and year periods', () => {
    expect(buildTrendDisplayLabels(['2026-01', '2026-02'], 'month')).toEqual(['26-01', '26-02'])
    expect(buildTrendDisplayLabels(['2025', '2026'], 'year')).toEqual(['2025', '2026'])
  })

  it('summarizes trend amounts and derives period labels', () => {
    expect(sumTrendAmounts([1.111, 2.222, 3.333])).toBe(6.666)
    expect(getCurrentPeriodAmount([1, 2, 3])).toBe(3)
    expect(getCurrentPeriodAmount([])).toBe(0)
    expect(getCurrentPeriodTitle('month')).toBe('本月结算金额')
    expect(getCurrentPeriodTitle('year')).toBe('本年结算金额')
    expect(getTrendSummaryLabel('month', 12)).toBe('近 12 个月')
    expect(getTrendSummaryLabel('year', 3)).toBe('近 3 年')
  })
})
