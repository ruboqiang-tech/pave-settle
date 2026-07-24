import type { TrendGranularity } from '@/services/analytics.service'
import { roundAmount } from '@/utils/calculations'

export const trendSpanOptionMap: Record<TrendGranularity, number[]> = {
  month: [3, 6, 12, 24, 36],
  year: [1, 2, 3, 5],
}

export function buildTrendDisplayLabels(periods: string[], granularity: TrendGranularity): string[] {
  return granularity === 'month'
    ? periods.map(period => period.slice(2))
    : periods
}

export function sumTrendAmounts(amounts: number[]): number {
  return roundAmount(amounts.reduce((sum, value) => sum + value, 0))
}

export function getCurrentPeriodAmount(amounts: number[]): number {
  return amounts.length > 0 ? amounts[amounts.length - 1] : 0
}

export function getCurrentPeriodTitle(granularity: TrendGranularity): string {
  return granularity === 'month' ? '本月结算金额' : '本年结算金额'
}

export function getTrendSummaryLabel(granularity: TrendGranularity, span: number): string {
  return granularity === 'month' ? `近 ${span} 个月` : `近 ${span} 年`
}
