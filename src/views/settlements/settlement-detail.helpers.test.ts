import { describe, expect, it } from 'vitest'
import type { BillOfQuantities, SettlementDetail, SettlementDetailRow } from '@/types'
import {
  applySettlementDateRange,
  buildContractCollections,
  buildGroupedDetails,
  buildPreviousCumulativeMap,
  buildSettlementSavePayload,
  createSettlementDetailRowFromBoq,
  createSettlementDraft,
  getSettlementDateRange,
  getGroupCurrentAmount,
  mapStoredDetailsToRows,
  recalculateSettlement,
  recalculateSettlementDetailRow,
  validateSettlementDraftForSave,
} from './settlement-detail.helpers'

function createRow(overrides: Partial<SettlementDetailRow> = {}): SettlementDetailRow {
  return {
    boqId: 1,
    contractId: 10,
    contractName: '合同A',
    itemCode: 'A-01',
    itemName: '水稳层',
    remark: '桥头搭接',
    note: '',
    unit: 'm2',
    contractQuantity: 100,
    previousCumulative: 10,
    currentQuantity: 2,
    currentCumulative: 12,
    noTaxUnitPrice: 1.835,
    unitPrice: 2,
    currentAmount: 4,
    ...overrides,
  }
}

function createStoredDetail(overrides: Partial<SettlementDetail> = {}): SettlementDetail {
  return {
    id: 1,
    settlementId: 100,
    boqId: 1,
    contractId: 10,
    itemCode: 'A-01',
    itemName: '水稳层',
    remark: '桥头搭接',
    unit: 'm2',
    contractQuantity: 100,
    previousCumulative: 10,
    currentQuantity: 2,
    currentCumulative: 12,
    unitPrice: 2,
    currentAmount: 4,
    ...overrides,
  }
}

describe('settlement-detail.helpers', () => {
  it('buildContractCollections and buildGroupedDetails keep contract totals grouped by contract', () => {
    const collections = buildContractCollections([
      {
        id: 10,
        projectId: 1,
        contractNo: 'HT-001-01',
        contractName: '合同A',
        contractDate: '2026-04-01',
        noTaxAmount: 1.835,
        contractTaxRate: 9,
        taxAmount: 0.165,
        contractAmount: 2,
        amountSource: 'manual',
        summary: '',
      },
      {
        id: 20,
        projectId: 1,
        contractNo: 'HT-001-02',
        contractName: '合同B',
        contractDate: '2026-04-01',
        noTaxAmount: 2.752,
        contractTaxRate: 9,
        taxAmount: 0.248,
        contractAmount: 3,
        amountSource: 'manual',
        summary: '',
      },
    ])

    const groups = buildGroupedDetails([
      createRow({ boqId: 1, contractId: 10, contractName: '合同A', currentAmount: 1.111 }),
      createRow({ boqId: 2, contractId: 10, contractName: '合同A', currentAmount: 2.222 }),
      createRow({ boqId: 3, contractId: 20, contractName: '合同B', currentAmount: 3.333 }),
    ], collections.amountMap)

    expect(collections.totalAmount).toBe(5)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({
      contractId: 10,
      contractName: '合同A',
      contractAmount: 2,
    })
    expect(groups[1]).toMatchObject({
      contractId: 20,
      contractName: '合同B',
      contractAmount: 3,
    })
    expect(getGroupCurrentAmount(groups[0])).toBe(3.333)
    expect(getGroupCurrentAmount(groups[1])).toBe(3.333)
  })

  it('recalculateSettlementDetailRow and recalculateSettlement keep quantity and amount rounded', () => {
    const settlement = createSettlementDraft({ projectId: 1, settlementType: 'interim' })
    settlement.previousCumulative = 10
    settlement.changeAmount = 1.111
    settlement.materialAdjustment = 0.222
    settlement.surchargeAmount = 0.333
    settlement.deductionAmount = 0.444

    const row = createRow({
      previousCumulative: 1.111,
      currentQuantity: 2.222,
      unitPrice: 3,
      currentCumulative: 0,
      currentAmount: 0,
    })

    recalculateSettlementDetailRow(row)
    expect(row.currentCumulative).toBe(3.333)
    expect(row.currentAmount).toBe(6.666)

    const rows = [
      row,
      createRow({ boqId: 2, currentAmount: 1.111 }),
    ]

    recalculateSettlement(settlement, rows)
    expect(settlement.currentAmount).toBe(8.999)
    expect(settlement.currentCumulative).toBe(18.999)
  })

  it('mapStoredDetailsToRows falls back to boq-to-contract mapping and default strings', () => {
    const rows = mapStoredDetailsToRows([
      createStoredDetail({
        boqId: 101,
        contractId: 0,
        itemCode: undefined,
        itemName: undefined,
        unit: undefined,
      }),
      createStoredDetail({
        id: 2,
        boqId: 102,
        contractId: 20,
        itemCode: 'B-01',
        itemName: '沥青面层',
        remark: '桥头搭接',
        unit: 't',
      }),
    ], {
      10: '合同A',
      20: '合同B',
      30: '合同C',
    }, {
      101: 30,
      102: 99,
    })

    expect(rows).toEqual([
      {
        boqId: 101,
        contractId: 30,
        contractName: '合同C',
        itemCode: '',
        itemName: '',
        remark: '桥头搭接',
        note: '',
        unit: '',
        contractQuantity: 100,
        previousCumulative: 10,
        currentQuantity: 2,
        currentCumulative: 12,
        noTaxUnitPrice: 0,
        unitPrice: 2,
        currentAmount: 4,
      },
      {
        boqId: 102,
        contractId: 20,
        contractName: '合同B',
        itemCode: 'B-01',
        itemName: '沥青面层',
        remark: '桥头搭接',
        note: '',
        unit: 't',
        contractQuantity: 100,
        previousCumulative: 10,
        currentQuantity: 2,
        currentCumulative: 12,
        noTaxUnitPrice: 0,
        unitPrice: 2,
        currentAmount: 4,
      },
    ])
  })

  it('buildPreviousCumulativeMap merges quantities by boq and createSettlementDetailRowFromBoq reuses them', () => {
    const previousMap = buildPreviousCumulativeMap([
      createStoredDetail({ boqId: 1, currentQuantity: 1.111 }),
      createStoredDetail({ id: 2, boqId: 1, currentQuantity: 2.222 }),
      createStoredDetail({ id: 3, boqId: 2, currentQuantity: 3.333 }),
    ])

    const boq: BillOfQuantities = {
      id: 1,
      contractId: 10,
      itemCode: 'A-01',
      itemName: '水稳层',
      remark: '桥头搭接',
      note: '',
      unit: 'm2',
      quantity: 100,
      taxRate: 9,
      noTaxUnitPrice: 1.835,
      unitPrice: 2,
      noTaxTotalPrice: 183.5,
      taxAmount: 16.5,
      totalPrice: 200,
      category: 'road',
      chapterCode: '01',
      sortOrder: 1,
    }

    const row = createSettlementDetailRowFromBoq(boq, '合同A', previousMap[1])

    expect(previousMap).toEqual({
      1: 3.333,
      2: 3.333,
    })
    expect(row).toEqual({
      remark: '桥头搭接',
      boqId: 1,
      contractId: 10,
      contractName: '合同A',
      itemCode: 'A-01',
      itemName: '水稳层',
      note: '',
      unit: 'm2',
      contractQuantity: 100,
      previousCumulative: 3.333,
      currentQuantity: 0,
      currentCumulative: 3.333,
      noTaxUnitPrice: 1.835,
      unitPrice: 2,
      currentAmount: 0,
    })
  })

  it('reads and applies settlement date range for detail form editing', () => {
    const settlement = createSettlementDraft({
      projectId: 1,
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })

    expect(getSettlementDateRange(settlement)).toEqual(['2026-04-01', '2026-04-30'])

    applySettlementDateRange(settlement, ['2026-05-01', '2026-05-31'])
    expect(settlement.startDate).toBe('2026-05-01')
    expect(settlement.endDate).toBe('2026-05-31')

    applySettlementDateRange(settlement, null)
    expect(settlement.startDate).toBe('')
    expect(settlement.endDate).toBe('')
  })

  it('buildSettlementSavePayload keeps settlement fields and strips view-only contract names', () => {
    const settlement = createSettlementDraft({
      projectId: 1,
      settlementType: 'final',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    })
    settlement.id = 99
    settlement.contractIds = [10, 20]
    settlement.settlementNo = 'JS-001-01'
    settlement.previousCumulative = 10
    settlement.currentAmount = 5
    settlement.currentCumulative = 15
    settlement.materialAdjustment = 0.5
    settlement.changeAmount = 0.25
    settlement.deductionAmount = 0.125
    settlement.surchargeAmount = 0.375
    settlement.changeRemark = '变更'
    settlement.materialRemark = '材料'
    settlement.surchargeRemark = '奖补'
    settlement.deductionRemark = '扣款'
    settlement.remark = '备注'
    settlement.status = 'confirmed'

    const payload = buildSettlementSavePayload(settlement, [
      createRow({
        boqId: 1,
        contractId: 10,
        contractName: '合同A',
        itemCode: 'A-01',
        itemName: '水稳层',
      }),
    ])

    expect(payload).toEqual({
      settlementId: 99,
      settlement: {
        projectId: 1,
        contractIds: [10, 20],
        settlementNo: 'JS-001-01',
        settlementType: 'final',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        previousCumulative: 10,
        currentAmount: 5,
        currentCumulative: 15,
        materialAdjustment: 0.5,
        changeAmount: 0.25,
        deductionAmount: 0.125,
        surchargeAmount: 0.375,
        changeRemark: '变更',
        materialRemark: '材料',
        surchargeRemark: '奖补',
        deductionRemark: '扣款',
        remark: '备注',
        status: 'confirmed',
      },
      details: [
        {
          remark: '桥头搭接',
          settlementId: 99,
          boqId: 1,
          contractId: 10,
          itemCode: 'A-01',
          itemName: '水稳层',
          unit: 'm2',
          contractQuantity: 100,
          previousCumulative: 10,
          currentQuantity: 2,
          currentCumulative: 12,
          unitPrice: 2,
          currentAmount: 4,
          note: '',
        },
      ],
    })
  })

  describe('validateSettlementDraftForSave', () => {
    it('returns null when dates are valid and status is draft', () => {
      expect(validateSettlementDraftForSave({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        settlementNo: '',
        status: 'draft',
      })).toBeNull()
    })

    it('returns an error when startDate is after endDate', () => {
      const error = validateSettlementDraftForSave({
        startDate: '2026-02-01',
        endDate: '2026-01-31',
        settlementNo: 'JS-001-01',
        status: 'draft',
      })
      expect(error).toContain('开始日期')
      expect(error).toContain('结束日期')
    })

    it('returns null when startDate equals endDate', () => {
      expect(validateSettlementDraftForSave({
        startDate: '2026-01-31',
        endDate: '2026-01-31',
        settlementNo: '',
        status: 'draft',
      })).toBeNull()
    })

    it('returns an error when status is confirmed and settlementNo is empty', () => {
      const error = validateSettlementDraftForSave({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        settlementNo: '  ',
        status: 'confirmed',
      })
      expect(error).toContain('结算单号')
    })

    it('returns an error when status is approved and settlementNo is empty', () => {
      const error = validateSettlementDraftForSave({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        settlementNo: '',
        status: 'approved',
      })
      expect(error).toContain('结算单号')
    })

    it('allows empty settlementNo when status is draft', () => {
      expect(validateSettlementDraftForSave({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        settlementNo: '',
        status: 'draft',
      })).toBeNull()
    })

    it('returns null when all fields are valid for confirmed status', () => {
      expect(validateSettlementDraftForSave({
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        settlementNo: 'JS-001-01',
        status: 'confirmed',
      })).toBeNull()
    })
  })
})
