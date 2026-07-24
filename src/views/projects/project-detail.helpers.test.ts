import { describe, expect, it } from 'vitest'
import type { BillOfQuantities, Contract, Project, Settlement } from '@/types'
import {
  buildBoqSummary,
  buildSettlementSummary,
  createContractEditForm,
  createProjectEditForm,
  getStatusText,
  getStatusType,
  summarizeContractAmounts,
} from './project-detail.helpers'

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 1,
    code: 'XM-001',
    name: '测试项目',
    projectType: 'highway',
    location: '测试地点',
    ownerUnit: '业主单位',
    generalContractor: '总包单位',
    startDate: '2026-04-01',
    plannedEndDate: '2026-12-31',
    actualEndDate: '',
    status: 'settling',
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

function createContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 1,
    projectId: 1,
    contractNo: 'HT-001',
    contractName: '路面合同',
    contractDate: '2026-04-01',
    noTaxAmount: 1.835,
    contractTaxRate: 9,
    taxAmount: 0.165,
    contractAmount: 2,
    amountSource: 'auto',
    summary: '合同摘要',
    ...overrides,
  }
}

function createSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: 1,
    projectId: 1,
    contractIds: [1],
    settlementNo: 'JS-001-01',
    settlementType: 'interim',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    previousCumulative: 0,
    currentAmount: 2,
    currentCumulative: 2,
    materialAdjustment: 0,
    changeAmount: 0,
    deductionAmount: 0,
    surchargeAmount: 0,
    changeRemark: '',
    materialRemark: '',
    surchargeRemark: '',
    deductionRemark: '',
    remark: '',
    status: 'confirmed',
    createdAt: '2026-04-30T00:00:00.000Z',
    ...overrides,
  }
}

function createBoq(overrides: Partial<BillOfQuantities> = {}): BillOfQuantities {
  return {
    id: 1,
    contractId: 1,
    itemCode: 'A-01',
    itemName: '水稳层',
    remark: '桥头搭接',
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
    ...overrides,
  }
}

describe('project-detail.helpers', () => {
  it('creates edit forms from existing entities and safe defaults', () => {
    expect(createContractEditForm(createContract())).toEqual({
      contractNo: 'HT-001',
      contractName: '路面合同',
      contractDate: '2026-04-01',
      summary: '合同摘要',
    })

    expect(createProjectEditForm(createProject())).toEqual({
      code: 'XM-001',
      name: '测试项目',
      location: '测试地点',
      ownerUnit: '业主单位',
      generalContractor: '总包单位',
      status: 'settling',
      plannedEndDate: '2026-12-31',
      difficulty: 'medium',
    })

    expect(createProjectEditForm(null)).toEqual({
      code: '',
      name: '',
      location: '',
      ownerUnit: '',
      generalContractor: '',
      status: 'preparing',
      plannedEndDate: '',
      difficulty: 'medium',
    })
  })

  it('maps project status to the expected tag type and text', () => {
    expect(getStatusType('preparing')).toBe('info')
    expect(getStatusType('in_progress')).toBeUndefined()
    expect(getStatusType('settling')).toBe('warning')
    expect(getStatusType('completed')).toBe('success')

    expect(getStatusText('preparing')).toBe('准备中')
    expect(getStatusText('in_progress')).toBe('施工中')
    expect(getStatusText('settling')).toBe('结算中')
    expect(getStatusText('completed')).toBe('已完工')
  })

  it('summarizes contract boq amounts by no-tax, tax and total amount', () => {
    expect(summarizeContractAmounts([
      createBoq({ noTaxTotalPrice: 1.835, taxAmount: 0.165, totalPrice: 2 }),
      createBoq({ id: 2, noTaxTotalPrice: 2.752, taxAmount: 0.248, totalPrice: 3 }),
    ])).toEqual({
      noTax: 4.587,
      tax: 0.413,
      total: 5,
    })
  })

  it('builds boq and settlement table summaries with aligned totals', () => {
    expect(buildBoqSummary({
      columns: [{}, { property: 'itemName' }, { property: 'quantity' }, { property: 'noTaxTotalPrice' }, { property: 'taxAmount' }, { property: 'totalPrice' }],
      data: [
        createBoq({ id: 1, quantity: 100, noTaxTotalPrice: 1.835, taxAmount: 0.165, totalPrice: 2 }),
        createBoq({ id: 2, quantity: 50, noTaxTotalPrice: 2.752, taxAmount: 0.248, totalPrice: 3 }),
      ],
    })).toEqual(['', '合计', '150.000', '4.587', '0.413', '5.000'])

    expect(buildSettlementSummary({
      columns: [{ property: 'settlementNo' }, { property: 'currentAmount' }, { property: 'currentCumulative' }],
      data: [
        createSettlement({ id: 1, currentAmount: 2, currentCumulative: 2 }),
        createSettlement({ id: 2, currentAmount: 3, currentCumulative: 5 }),
      ],
    })).toEqual(['', '5.000', '7.000'])
  })
})
