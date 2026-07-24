import type { SettlementDisplayItem } from '@/types'
import { extractProjectSequence } from './numbering'

export const AMOUNT_PRECISION = 3
export const RATIO_PRECISION = 2
export const RMB_SYMBOL = '\uFFE5'
const SETTLEMENT_NO_REGEX = /^JS-(\d+)-(\d+)$/

export function roundTo(value: number, precision: number = AMOUNT_PRECISION): number {
  const safeValue = Number(value || 0)
  const factor = 10 ** precision
  return Math.round(safeValue * factor) / factor
}

export function roundAmount(value: number, precision: number = AMOUNT_PRECISION): number {
  return roundTo(value, precision)
}

export function roundQuantity(value: number, precision: number = AMOUNT_PRECISION): number {
  return roundTo(value, precision)
}

export function sumRounded(values: number[], precision: number = AMOUNT_PRECISION): number {
  return roundTo(values.reduce((sum, value) => sum + Number(value || 0), 0), precision)
}

export function calculateCurrentAmount(currentQuantity: number, unitPrice: number): number {
  return roundAmount(Number(currentQuantity || 0) * Number(unitPrice || 0))
}

export function calculateSettlementTotal(
  items: SettlementDisplayItem[],
  materialAdjustment: number = 0,
  changeAmount: number = 0,
  surchargeAmount: number = 0,
  deductionAmount: number = 0,
): {
  baseAmount: number
  totalAmount: number
} {
  const baseAmount = sumRounded(items.map(item => item.currentAmount))
  const totalAmount = roundAmount(
    baseAmount
    + Number(materialAdjustment || 0)
    + Number(changeAmount || 0)
    + Number(surchargeAmount || 0)
    - Number(deductionAmount || 0),
  )

  return {
    baseAmount,
    totalAmount,
  }
}

export function calculateCumulative(previousCumulative: number, currentAmount: number): number {
  return roundAmount(Number(previousCumulative || 0) + Number(currentAmount || 0))
}

export function calculateSettlementRatio(cumulativeAmount: number, contractAmount: number): number {
  if (contractAmount === 0) return 0
  return roundTo((cumulativeAmount / contractAmount) * 100, RATIO_PRECISION)
}

export function generateSettlementNo(
  projectCode: string,
  settlementType: 'interim' | 'final',
  sequence: number,
  referenceDate: string | Date = new Date(),
): string {
  void settlementType
  void referenceDate
  const projectSequence = extractProjectSequence(projectCode) || '001'
  const normalizedSequence = Number(sequence)
  const safeSequence = Number.isFinite(normalizedSequence) && normalizedSequence > 0
    ? Math.trunc(normalizedSequence)
    : 1

  return `JS-${projectSequence}-${String(safeSequence).padStart(2, '0')}`
}

export function getNextSettlementSequence(settlementNos: string[]): number {
  const parsedSequences = settlementNos
    .map(settlementNo => parseSettlementNo(settlementNo)?.sequence)
    .filter((sequence): sequence is number => sequence !== undefined && Number.isFinite(sequence) && sequence > 0)

  if (parsedSequences.length === 0) {
    return 1
  }

  return Math.max(...parsedSequences) + 1
}

export function parseSettlementNo(settlementNo: string): {
  projectCode: string
  period: string
  sequence: number
} | null {
  const normalized = String(settlementNo || '').trim()
  if (!normalized) return null

  const matched = normalized.match(SETTLEMENT_NO_REGEX)
  if (!matched) return null

  const [, projectCode, rawSequence] = matched
  const sequence = Number(rawSequence)
  if (!Number.isFinite(sequence) || sequence <= 0) return null

  return {
    projectCode,
    period: '',
    sequence,
  }
}

export function formatAmount(amount: number, decimals: number = AMOUNT_PRECISION): string {
  const safeAmount = amount === null || amount === undefined || isNaN(amount)
    ? 0
    : roundTo(amount, decimals)

  return safeAmount.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatCurrency(amount: number, decimals: number = AMOUNT_PRECISION): string {
  return `${RMB_SYMBOL}${formatAmount(amount, decimals)}`
}

export function formatCompactAmount(amount: number): string {
  const safe = Number(amount) || 0
  if (Math.abs(safe) >= 1e8) {
    return `${roundTo(safe / 1e8, 2).toFixed(2)}亿`
  }
  if (Math.abs(safe) >= 1e4) {
    return `${roundTo(safe / 1e4, 2).toFixed(2)}万`
  }
  return formatAmount(safe)
}

export function formatCompactCurrency(amount: number): string {
  return `${RMB_SYMBOL}${formatCompactAmount(amount)}`
}

export function formatRatio(ratio: number, decimals: number = RATIO_PRECISION): string {
  return `${roundTo(Number(ratio || 0), decimals).toFixed(decimals)}%`
}

export function clampProgressPercentage(percentage: number): number {
  const safePercentage = roundTo(Number(percentage || 0), RATIO_PRECISION)
  return Math.min(Math.max(safePercentage, 0), 100)
}

export function formatProgressRatio(ratio: number, decimals: number = RATIO_PRECISION): string {
  const rounded = roundTo(Number(ratio || 0), decimals)
  return `${Number(rounded.toFixed(decimals))}%`
}
