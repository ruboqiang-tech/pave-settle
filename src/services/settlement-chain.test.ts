import { describe, expect, it } from 'vitest'
import {
  hasSettlementChainDiff,
  hasSettlementDetailChainDiff,
  normalizeSettlementChain,
  sortSettlementsForChain,
  syncSettlementDetailsWithBoq,
} from './settlement-chain'

describe('settlement-chain', () => {
  it('rebuilds settlement cumulatives in chronological order for inserted middle settlements', () => {
    const settlements = [
      {
        id: 1,
        projectId: 1,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        createdAt: '2026-03-31T00:00:00.000Z',
        previousCumulative: 0,
        currentAmount: 100,
        currentCumulative: 100,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 2,
        projectId: 1,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        createdAt: '2026-05-31T00:00:00.000Z',
        previousCumulative: 100,
        currentAmount: 50,
        currentCumulative: 150,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 3,
        projectId: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        createdAt: '2026-06-01T00:00:00.000Z',
        previousCumulative: 150,
        currentAmount: 30,
        currentCumulative: 180,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
    ]

    const details = new Map([
      [1, [{ id: 11, settlementId: 1, boqId: 101, previousCumulative: 0, currentQuantity: 10, currentCumulative: 10, unitPrice: 10, currentAmount: 100 }]],
      [2, [{ id: 21, settlementId: 2, boqId: 101, previousCumulative: 10, currentQuantity: 5, currentCumulative: 15, unitPrice: 10, currentAmount: 50 }]],
      [3, [{ id: 31, settlementId: 3, boqId: 101, previousCumulative: 15, currentQuantity: 3, currentCumulative: 18, unitPrice: 10, currentAmount: 30 }]],
    ])

    const normalized = normalizeSettlementChain(settlements, details)
    const settlementById = new Map(normalized.settlements.map(item => [item.id, item]))
    const detailBySettlementId = normalized.details

    expect(settlementById.get(1)).toMatchObject({
      previousCumulative: 0,
      currentAmount: 100,
      currentCumulative: 100,
    })
    expect(settlementById.get(3)).toMatchObject({
      previousCumulative: 100,
      currentAmount: 30,
      currentCumulative: 130,
    })
    expect(settlementById.get(2)).toMatchObject({
      previousCumulative: 130,
      currentAmount: 50,
      currentCumulative: 180,
    })

    expect(detailBySettlementId.get(1)?.[0]).toMatchObject({
      previousCumulative: 0,
      currentCumulative: 10,
    })
    expect(detailBySettlementId.get(3)?.[0]).toMatchObject({
      previousCumulative: 10,
      currentCumulative: 13,
    })
    expect(detailBySettlementId.get(2)?.[0]).toMatchObject({
      previousCumulative: 13,
      currentCumulative: 18,
    })
  })

  it('rewinds later settlements after a middle settlement is removed from the chain', () => {
    const settlements = [
      {
        id: 1,
        projectId: 1,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        createdAt: '2026-03-31T00:00:00.000Z',
        previousCumulative: 0,
        currentAmount: 100,
        currentCumulative: 100,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 3,
        projectId: 1,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        createdAt: '2026-05-31T00:00:00.000Z',
        previousCumulative: 130,
        currentAmount: 50,
        currentCumulative: 180,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
    ]

    const details = new Map([
      [1, [{ id: 11, settlementId: 1, boqId: 101, previousCumulative: 0, currentQuantity: 10, currentCumulative: 10, unitPrice: 10, currentAmount: 100 }]],
      [3, [{ id: 31, settlementId: 3, boqId: 101, previousCumulative: 13, currentQuantity: 5, currentCumulative: 18, unitPrice: 10, currentAmount: 50 }]],
    ])

    const normalized = normalizeSettlementChain(settlements, details)
    const latestSettlement = normalized.settlements.find(item => item.id === 3)
    const latestDetail = normalized.details.get(3)?.[0]

    expect(latestSettlement).toMatchObject({
      previousCumulative: 100,
      currentCumulative: 150,
    })
    expect(latestDetail).toMatchObject({
      previousCumulative: 10,
      currentCumulative: 15,
    })
  })

  it('does not let draft settlements pollute later confirmed cumulatives', () => {
    const settlements = [
      {
        id: 1,
        projectId: 1,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        createdAt: '2026-03-31T00:00:00.000Z',
        status: 'confirmed',
        previousCumulative: 0,
        currentAmount: 100,
        currentCumulative: 100,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 2,
        projectId: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        createdAt: '2026-04-30T00:00:00.000Z',
        status: 'draft',
        previousCumulative: 100,
        currentAmount: 30,
        currentCumulative: 130,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 3,
        projectId: 1,
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        createdAt: '2026-05-31T00:00:00.000Z',
        status: 'confirmed',
        previousCumulative: 130,
        currentAmount: 50,
        currentCumulative: 180,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
    ]

    const details = new Map([
      [1, [{ id: 11, settlementId: 1, boqId: 101, previousCumulative: 0, currentQuantity: 10, currentCumulative: 10, unitPrice: 10, currentAmount: 100 }]],
      [2, [{ id: 21, settlementId: 2, boqId: 101, previousCumulative: 10, currentQuantity: 3, currentCumulative: 13, unitPrice: 10, currentAmount: 30 }]],
      [3, [{ id: 31, settlementId: 3, boqId: 101, previousCumulative: 13, currentQuantity: 5, currentCumulative: 18, unitPrice: 10, currentAmount: 50 }]],
    ])

    const normalized = normalizeSettlementChain(settlements, details)
    const settlementById = new Map(normalized.settlements.map(item => [item.id, item]))
    const draftDetail = normalized.details.get(2)?.[0]
    const latestDetail = normalized.details.get(3)?.[0]

    expect(settlementById.get(2)).toMatchObject({
      previousCumulative: 100,
      currentCumulative: 130,
    })
    expect(settlementById.get(3)).toMatchObject({
      previousCumulative: 100,
      currentCumulative: 150,
    })

    expect(draftDetail).toMatchObject({
      previousCumulative: 10,
      currentCumulative: 13,
    })
    expect(latestDetail).toMatchObject({
      previousCumulative: 10,
      currentCumulative: 15,
    })
  })

  it('detects when stored chain values differ from rebuilt values', () => {
    expect(
      hasSettlementChainDiff(
        {
          id: 1,
          projectId: 1,
          startDate: '',
          endDate: '',
          createdAt: '',
          previousCumulative: 100,
          currentAmount: 50,
          currentCumulative: 150,
          materialAdjustment: 0,
          changeAmount: 0,
          deductionAmount: 0,
          surchargeAmount: 0,
        },
        {
          id: 1,
          projectId: 1,
          startDate: '',
          endDate: '',
          createdAt: '',
          previousCumulative: 80,
          currentAmount: 50,
          currentCumulative: 130,
          materialAdjustment: 0,
          changeAmount: 0,
          deductionAmount: 0,
          surchargeAmount: 0,
        },
      ),
    ).toBe(true)

    expect(
      hasSettlementDetailChainDiff(
        {
          id: 1,
          settlementId: 1,
          boqId: 1,
          previousCumulative: 5,
          currentQuantity: 1,
          currentCumulative: 6,
          unitPrice: 10,
          currentAmount: 10,
        },
        {
          id: 1,
          settlementId: 1,
          boqId: 1,
          previousCumulative: 4,
          currentQuantity: 1,
          currentCumulative: 5,
          unitPrice: 10,
          currentAmount: 10,
        },
      ),
    ).toBe(true)
  })

  it('syncs settlement details with live boq price and metadata changes', () => {
    const synced = syncSettlementDetailsWithBoq(
      [
        {
          id: 1,
          settlementId: 1,
          boqId: 1001,
          contractId: 10,
          itemCode: 'OLD-01',
          itemName: '旧清单项',
          unit: 'm',
          contractQuantity: 100,
          previousCumulative: 5,
          currentQuantity: 2,
          currentCumulative: 7,
          unitPrice: 10,
          currentAmount: 20,
        },
      ],
      new Map([
        [1001, {
          id: 1001,
          contractId: 10,
          itemCode: 'NEW-01',
          itemName: '新清单项',
          unit: 'm2',
          quantity: 120,
          unitPrice: 12.345,
        }],
      ]),
    )

    expect(synced[0]).toMatchObject({
      contractId: 10,
      itemCode: 'NEW-01',
      itemName: '新清单项',
      unit: 'm2',
      contractQuantity: 120,
      unitPrice: 12.345,
      currentAmount: 24.69,
    })
  })

  it('only syncs details whose boq still belongs to the changed contract map', () => {
    const synced = syncSettlementDetailsWithBoq(
      [
        {
          id: 1,
          settlementId: 1,
          boqId: 1001,
          contractId: 10,
          itemCode: 'A-01',
          itemName: '水稳基层',
          unit: 'm2',
          contractQuantity: 100,
          previousCumulative: 0,
          currentQuantity: 2,
          currentCumulative: 2,
          unitPrice: 2,
          currentAmount: 4,
        },
        {
          id: 2,
          settlementId: 1,
          boqId: 2001,
          contractId: 20,
          itemCode: 'B-01',
          itemName: '沥青面层',
          unit: 'm2',
          contractQuantity: 80,
          previousCumulative: 0,
          currentQuantity: 3,
          currentCumulative: 3,
          unitPrice: 5,
          currentAmount: 15,
        },
      ],
      new Map([
        [1001, {
          id: 1001,
          contractId: 10,
          itemCode: 'A-01-N',
          itemName: '水稳基层新口径',
          unit: 'm2',
          quantity: 120,
          unitPrice: 2.18,
        }],
      ]),
    )

    expect(synced[0]).toMatchObject({
      contractId: 10,
      itemCode: 'A-01-N',
      itemName: '水稳基层新口径',
      contractQuantity: 120,
      unitPrice: 2.18,
      currentAmount: 4.36,
    })

    expect(synced[1]).toMatchObject({
      contractId: 20,
      itemCode: 'B-01',
      itemName: '沥青面层',
      contractQuantity: 80,
      unitPrice: 5,
      currentAmount: 15,
    })
  })

  it('sorts settlements deterministically when period dates are the same', () => {
    const sorted = sortSettlementsForChain([
      {
        id: 3,
        projectId: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        createdAt: '2026-04-30T10:00:00.000Z',
        previousCumulative: 0,
        currentAmount: 0,
        currentCumulative: 0,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 1,
        projectId: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-20',
        createdAt: '2026-04-20T10:00:00.000Z',
        previousCumulative: 0,
        currentAmount: 0,
        currentCumulative: 0,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 2,
        projectId: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        createdAt: '2026-04-30T09:00:00.000Z',
        previousCumulative: 0,
        currentAmount: 0,
        currentCumulative: 0,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
      {
        id: 4,
        projectId: 1,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        createdAt: '2026-04-30T10:00:00.000Z',
        previousCumulative: 0,
        currentAmount: 0,
        currentCumulative: 0,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
      },
    ])

    expect(sorted.map(item => item.id)).toEqual([1, 2, 3, 4])
  })
})
