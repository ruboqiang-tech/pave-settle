import { roundAmount } from '@/utils/calculations'

export interface CostFeeRates {
  managementRate: number
  profitRate: number
  taxRate: number
}

export interface CostFeeSummary {
  directCost: number
  managementFee: number
  profit: number
  tax: number
  comprehensive: number
}

export interface MixturePriceInput {
  binderRatio: number
  coarseRatio: number
  fineRatio: number
  powderRatio: number
  binderPrice: number
  coarsePrice: number
  finePrice: number
  powderPrice: number
}

export interface PavementDirectCostM3Input {
  tonnageM3: number
  mixturePrice: number
  haulDistanceKm: number
  transportPrice: number
  thicknessCm: number
  laborPrice: number
  laborProductivity: number
  paverPrice: number
  paverProductivity: number
  steelRollerPrice: number
  rubberRollerPrice: number
  rollerProductivity: number
}

export function buildCostFeeSummary(directCost: number, rates?: Partial<CostFeeRates>): CostFeeSummary {
  const safeDirectCost = roundAmount(Number(directCost || 0), 2)
  const managementFee = roundAmount(safeDirectCost * Number(rates?.managementRate || 0) / 100, 2)
  const profit = roundAmount((safeDirectCost + managementFee) * Number(rates?.profitRate || 0) / 100, 2)
  const tax = roundAmount((safeDirectCost + managementFee + profit) * Number(rates?.taxRate || 0) / 100, 2)

  return {
    directCost: safeDirectCost,
    managementFee,
    profit,
    tax,
    comprehensive: roundAmount(safeDirectCost + managementFee + profit + tax, 2),
  }
}

export function estimateMixtureUnitPrice(input: MixturePriceInput): number {
  return roundAmount(
    Number(input.binderRatio || 0) * Number(input.binderPrice || 0)
    + Number(input.coarseRatio || 0) * Number(input.coarsePrice || 0)
    + Number(input.fineRatio || 0) * Number(input.finePrice || 0)
    + Number(input.powderRatio || 0) * Number(input.powderPrice || 0),
    2,
  )
}

export function estimatePavementDirectCostM3(input: PavementDirectCostM3Input): number {
  const materialCost = Number(input.tonnageM3 || 0) * Number(input.mixturePrice || 0)
  const transportCost = Number(input.tonnageM3 || 0) * Number(input.haulDistanceKm || 0) * Number(input.transportPrice || 0)
  const thicknessM = Math.max(Number(input.thicknessCm || 0) / 100, 0)
  const areaFactor = thicknessM > 0 ? 1 / thicknessM : 1

  const laborCost = (Number(input.laborPrice || 0) / Number(input.laborProductivity || 1)) * areaFactor
  const paverCost = (Number(input.paverPrice || 0) / Number(input.paverProductivity || 1)) * areaFactor
  const rollerCost = (
    (Number(input.steelRollerPrice || 0) + Number(input.rubberRollerPrice || 0))
    / Number(input.rollerProductivity || 1)
  ) * areaFactor

  return roundAmount(materialCost + transportCost + laborCost + paverCost + rollerCost, 2)
}
