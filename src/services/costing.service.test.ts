import { describe, expect, it } from 'vitest'
import {
  buildProjectCostSummary,
  buildProjectCostSummaryFromRepository,
  buildProjectCostTotals,
  buildProjectCostManagementSummary,
  calculateCostVariance,
  calculateCostVarianceRate,
  calculateSettlementCaliberMarginRate,
  calculateSettlementCaliberProfit,
  type ProjectCostEntry,
} from './costing.service'

const entries: ProjectCostEntry[] = [
  { projectId: 1, category: 'labor', occurredOn: '2026-04-01', amount: 10, note: '人工' },
  { projectId: 1, category: 'material', occurredOn: '2026-04-02', amount: 20, note: '材料' },
  { projectId: 1, category: 'machine', occurredOn: '2026-04-03', amount: 5.555, note: '机械' },
  { projectId: 1, category: 'other', occurredOn: '2026-04-04', amount: 1.111, note: '其他' },
]

describe('costing.service', () => {
  it('builds category totals for the four planned cost buckets', () => {
    expect(buildProjectCostTotals(entries)).toEqual({
      labor: 10,
      material: 20,
      machine: 5.555,
      other: 1.111,
    })
  })

  it('calculates settlement-caliber profit as settled minus incurred cost', () => {
    expect(calculateSettlementCaliberProfit(100, 36.666)).toBe(63.334)
    expect(calculateSettlementCaliberMarginRate(100, 63.334)).toBe(63.33)
    expect(calculateSettlementCaliberMarginRate(0, 10)).toBe(0)
  })

  it('builds a project cost summary without requiring current UI or db changes', () => {
    expect(buildProjectCostSummary({
      projectId: 1,
      settledAmount: 100,
      entries,
    })).toEqual({
      projectId: 1,
      settledAmount: 100,
      incurredCost: 36.666,
      settlementCaliberProfit: 63.334,
      settlementCaliberMarginRate: 63.33,
      entryCount: 4,
      categoryTotals: {
        labor: 10,
        material: 20,
        machine: 5.555,
        other: 1.111,
      },
    })
  })

  it('can load future cost entries through a repository adapter', async () => {
    const repository = {
      async listByProjectId(projectId: number) {
        return entries.filter(entry => entry.projectId === projectId)
      },
    }

    await expect(buildProjectCostSummaryFromRepository({
      projectId: 1,
      settledAmount: 100,
      repository,
    })).resolves.toMatchObject({
      projectId: 1,
      incurredCost: 36.666,
      settlementCaliberProfit: 63.334,
    })
  })

  it('builds budget and actual cost management summary for a single project', () => {
    const budgetEntries: ProjectCostEntry[] = [
      { projectId: 1, phase: 'budget', category: 'material', occurredOn: '2026-01-01', amount: 70, note: '预算材料' },
      { projectId: 1, phase: 'budget', category: 'labor', occurredOn: '2026-01-01', amount: 10, note: '预算人工' },
    ]
    const actualEntries: ProjectCostEntry[] = [
      { projectId: 1, phase: 'actual', category: 'material', occurredOn: '2026-06-01', amount: 72, note: '核算材料' },
      { projectId: 1, phase: 'actual', category: 'machine', occurredOn: '2026-06-01', amount: 12, note: '核算机械' },
    ]

    expect(calculateCostVariance(84, 80)).toBe(4)
    expect(calculateCostVarianceRate(4, 80)).toBe(5)
    expect(buildProjectCostManagementSummary({
      projectId: 1,
      contractAmount: 120,
      settledAmount: 118,
      budgetEntries,
      actualEntries,
    })).toEqual({
      projectId: 1,
      contractAmount: 120,
      settledAmount: 118,
      budgetCost: 80,
      actualCost: 84,
      budgetProfit: 40,
      actualProfit: 34,
      budgetMarginRate: 33.33,
      actualMarginRate: 28.81,
      costVariance: 4,
      costVarianceRate: 5,
      budgetEntryCount: 2,
      actualEntryCount: 2,
      budgetTotals: {
        labor: 10,
        material: 70,
        machine: 0,
        other: 0,
      },
      actualTotals: {
        labor: 0,
        material: 72,
        machine: 12,
        other: 0,
      },
    })
  })
})
