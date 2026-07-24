import { describe, expect, it } from 'vitest'
import {
  buildCostFeeSummary,
  estimateMixtureUnitPrice,
  estimatePavementDirectCostM3,
} from './cost-estimate.service'

describe('cost-estimate.service', () => {
  it('builds fee summary with management, profit and tax in sequence', () => {
    expect(buildCostFeeSummary(916.7, {
      managementRate: 5,
      profitRate: 6,
      taxRate: 9,
    })).toEqual({
      directCost: 916.7,
      managementFee: 45.84,
      profit: 57.75,
      tax: 91.83,
      comprehensive: 1112.12,
    })
  })

  it('estimates weighted mixture price from material ratios', () => {
    const price = estimateMixtureUnitPrice({
      binderRatio: 0.045,
      coarseRatio: 0.6,
      fineRatio: 0.325,
      powderRatio: 0.03,
      binderPrice: 4200,
      coarsePrice: 95,
      finePrice: 90,
      powderPrice: 260,
    })

    expect(price).toBe(283.05)
  })

  it('estimates m3 direct pavement cost with transport, labor and machines', () => {
    const directCost = estimatePavementDirectCostM3({
      tonnageM3: 2.4276,
      mixturePrice: 283.05,
      haulDistanceKm: 18,
      transportPrice: 1.55,
      thicknessCm: 6,
      laborPrice: 260,
      laborProductivity: 108,
      paverPrice: 5600,
      paverProductivity: 1333,
      steelRollerPrice: 2100,
      rubberRollerPrice: 1800,
      rollerProductivity: 1258,
    })

    expect(directCost).toBe(916.67)
  })
})
