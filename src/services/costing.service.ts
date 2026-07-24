import { roundAmount } from '@/utils/calculations'

export type CostPhase = 'budget' | 'actual'
export type CostCategory = 'labor' | 'material' | 'machine' | 'other'

export interface ProjectCostEntry {
  id?: number
  projectId: number
  phase?: CostPhase
  category: CostCategory
  itemName?: string
  spec?: string
  unit?: string
  quantity?: number
  unitCost?: number
  occurredOn: string
  amount: number
  note: string
  createdAt?: string
}

export interface ProjectCostTotals {
  labor: number
  material: number
  machine: number
  other: number
}

export interface ProjectCostSummary {
  projectId: number
  settledAmount: number
  incurredCost: number
  settlementCaliberProfit: number
  settlementCaliberMarginRate: number
  entryCount: number
  categoryTotals: ProjectCostTotals
}

export interface ProjectCostManagementSummary {
  projectId: number
  contractAmount: number
  settledAmount: number
  budgetCost: number
  actualCost: number
  budgetProfit: number
  actualProfit: number
  budgetMarginRate: number
  actualMarginRate: number
  costVariance: number
  costVarianceRate: number
  budgetEntryCount: number
  actualEntryCount: number
  budgetTotals: ProjectCostTotals
  actualTotals: ProjectCostTotals
}

export interface ProjectCostRepository {
  listByProjectId(projectId: number): Promise<ProjectCostEntry[]>
}

export const EMPTY_PROJECT_COST_TOTALS: ProjectCostTotals = {
  labor: 0,
  material: 0,
  machine: 0,
  other: 0,
}

export function buildProjectCostTotals(entries: ProjectCostEntry[]): ProjectCostTotals {
  return entries.reduce<ProjectCostTotals>((totals, entry) => {
    totals[entry.category] = roundAmount(totals[entry.category] + Number(entry.amount || 0))
    return totals
  }, { ...EMPTY_PROJECT_COST_TOTALS })
}

export function calculateSettlementCaliberProfit(settledAmount: number, incurredCost: number): number {
  return roundAmount(Number(settledAmount || 0) - Number(incurredCost || 0))
}

export function calculateSettlementCaliberMarginRate(settledAmount: number, settlementCaliberProfit: number): number {
  if (!settledAmount) return 0
  return roundAmount((settlementCaliberProfit / settledAmount) * 100, 2)
}

export function calculateCostVariance(actualCost: number, budgetCost: number): number {
  return roundAmount(Number(actualCost || 0) - Number(budgetCost || 0))
}

export function calculateCostVarianceRate(costVariance: number, budgetCost: number): number {
  if (!budgetCost) return 0
  return roundAmount((costVariance / budgetCost) * 100, 2)
}

export function buildProjectCostSummary(args: {
  projectId: number
  settledAmount: number
  entries: ProjectCostEntry[]
}): ProjectCostSummary {
  const categoryTotals = buildProjectCostTotals(args.entries)
  const incurredCost = roundAmount(
    categoryTotals.labor
    + categoryTotals.material
    + categoryTotals.machine
    + categoryTotals.other,
  )
  const settlementCaliberProfit = calculateSettlementCaliberProfit(args.settledAmount, incurredCost)

  return {
    projectId: args.projectId,
    settledAmount: roundAmount(args.settledAmount),
    incurredCost,
    settlementCaliberProfit,
    settlementCaliberMarginRate: calculateSettlementCaliberMarginRate(args.settledAmount, settlementCaliberProfit),
    entryCount: args.entries.length,
    categoryTotals,
  }
}

export async function buildProjectCostSummaryFromRepository(args: {
  projectId: number
  settledAmount: number
  repository: ProjectCostRepository
}): Promise<ProjectCostSummary> {
  const entries = await args.repository.listByProjectId(args.projectId)
  return buildProjectCostSummary({
    projectId: args.projectId,
    settledAmount: args.settledAmount,
    entries,
  })
}

export function buildProjectCostManagementSummary(args: {
  projectId: number
  contractAmount: number
  settledAmount: number
  budgetEntries: ProjectCostEntry[]
  actualEntries: ProjectCostEntry[]
}): ProjectCostManagementSummary {
  const budgetTotals = buildProjectCostTotals(args.budgetEntries)
  const actualTotals = buildProjectCostTotals(args.actualEntries)
  const budgetCost = roundAmount(
    budgetTotals.labor
    + budgetTotals.material
    + budgetTotals.machine
    + budgetTotals.other,
  )
  const actualCost = roundAmount(
    actualTotals.labor
    + actualTotals.material
    + actualTotals.machine
    + actualTotals.other,
  )
  const budgetProfit = calculateSettlementCaliberProfit(args.contractAmount, budgetCost)
  const actualProfit = calculateSettlementCaliberProfit(args.settledAmount, actualCost)
  const costVariance = calculateCostVariance(actualCost, budgetCost)

  return {
    projectId: args.projectId,
    contractAmount: roundAmount(args.contractAmount),
    settledAmount: roundAmount(args.settledAmount),
    budgetCost,
    actualCost,
    budgetProfit,
    actualProfit,
    budgetMarginRate: calculateSettlementCaliberMarginRate(args.contractAmount, budgetProfit),
    actualMarginRate: calculateSettlementCaliberMarginRate(args.settledAmount, actualProfit),
    costVariance,
    costVarianceRate: calculateCostVarianceRate(costVariance, budgetCost),
    budgetEntryCount: args.budgetEntries.length,
    actualEntryCount: args.actualEntries.length,
    budgetTotals,
    actualTotals,
  }
}
