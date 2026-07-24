import { AMOUNT_PRECISION, roundAmount, roundTo } from './calculations'

export interface TaxBreakdown {
  noTaxAmount: number
  taxAmount: number
  totalAmount: number
}

function roundCurrency(value: number): number {
  return roundAmount(value, AMOUNT_PRECISION)
}

export function calcFromNoTaxAmount(noTaxAmount: number, taxRate: number): TaxBreakdown {
  const safeNoTaxAmount = Number(noTaxAmount || 0)
  const safeTaxRate = Number(taxRate || 0)
  const taxAmount = roundCurrency(safeNoTaxAmount * safeTaxRate / 100)
  const totalAmount = roundCurrency(safeNoTaxAmount + taxAmount)

  return {
    noTaxAmount: roundCurrency(safeNoTaxAmount),
    taxAmount,
    totalAmount
  }
}

export function calcFromTotalAmount(totalAmount: number, taxRate: number): TaxBreakdown {
  const safeTotalAmount = Number(totalAmount || 0)
  const safeTaxRate = Number(taxRate || 0)

  if (safeTaxRate === 0) {
    return {
      noTaxAmount: roundCurrency(safeTotalAmount),
      taxAmount: 0,
      totalAmount: roundCurrency(safeTotalAmount)
    }
  }

  const noTaxAmount = roundCurrency(safeTotalAmount / (1 + safeTaxRate / 100))
  const taxAmount = roundCurrency(safeTotalAmount - noTaxAmount)

  return {
    noTaxAmount,
    taxAmount,
    totalAmount: roundCurrency(safeTotalAmount)
  }
}

export function calcEffectiveTaxRate(noTaxAmount: number, taxAmount: number): number {
  const safeNoTaxAmount = Number(noTaxAmount || 0)
  const safeTaxAmount = Number(taxAmount || 0)

  if (safeNoTaxAmount === 0) return 0
  return roundTo(safeTaxAmount / safeNoTaxAmount * 100, 2)
}
