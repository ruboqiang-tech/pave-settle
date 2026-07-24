import { describe, expect, it } from 'vitest'
import type { Contract, Project, Settlement } from '@/types'
import {
  buildSettlementListRows,
  buildSettlementListSummary,
  createSettlementCreateForm,
  filterSettlementRows,
} from './settlement-list.helpers'

function createProjects(): Project[] {
  return [
    {
      id: 1,
      code: 'XM-001',
      name: '一标段路面工程',
      projectType: 'highway',
      location: '',
      ownerUnit: '业主单位 A',
      generalContractor: '总包单位 A',
      startDate: '2026-01-01',
      plannedEndDate: '2026-12-31',
      actualEndDate: '',
      status: 'settling',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      code: 'XM-002',
      name: '二标段养护工程',
      projectType: 'municipal',
      location: '',
      ownerUnit: '业主单位 B',
      generalContractor: '总包单位 B',
      startDate: '2026-02-01',
      plannedEndDate: '2026-11-30',
      actualEndDate: '',
      status: 'in_progress',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
  ]
}

function createContracts(): Contract[] {
  return [
    {
      id: 11,
      projectId: 1,
      contractNo: 'HT-001-01',
      contractName: '主合同 A',
      contractDate: '2026-01-01',
      noTaxAmount: 1.835,
      contractTaxRate: 9,
      taxAmount: 0.165,
      contractAmount: 2,
      amountSource: 'auto',
      summary: '',
    },
    {
      id: 12,
      projectId: 1,
      contractNo: 'HT-001-02',
      contractName: '补充合同 A',
      contractDate: '2026-01-01',
      noTaxAmount: 2.752,
      contractTaxRate: 9,
      taxAmount: 0.248,
      contractAmount: 3,
      amountSource: 'auto',
      summary: '',
    },
    {
      id: 21,
      projectId: 2,
      contractNo: 'HT-002-01',
      contractName: '主合同 B',
      contractDate: '2026-01-01',
      noTaxAmount: 0.917,
      contractTaxRate: 9,
      taxAmount: 0.083,
      contractAmount: 1,
      amountSource: 'auto',
      summary: '',
    },
  ]
}

function createSettlements(): Settlement[] {
  return [
    {
      id: 1,
      projectId: 1,
      contractIds: [11, 12],
      settlementNo: 'JS-001-01',
      settlementType: 'interim',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
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
      createdAt: '2026-03-31T00:00:00.000Z',
    },
    {
      id: 2,
      projectId: 1,
      contractIds: [11],
      settlementNo: 'JS-001-02',
      settlementType: 'final',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      previousCumulative: 2,
      currentAmount: 1,
      currentCumulative: 3,
      materialAdjustment: 0,
      changeAmount: 0,
      deductionAmount: 0,
      surchargeAmount: 0,
      changeRemark: '',
      materialRemark: '',
      surchargeRemark: '',
      deductionRemark: '',
      remark: '',
      status: 'approved',
      createdAt: '2026-04-30T00:00:00.000Z',
    },
    {
      id: 3,
      projectId: 2,
      contractIds: [21],
      settlementNo: 'JS-002-01',
      settlementType: 'interim',
      startDate: '2026-04-01',
      endDate: '2026-04-30',
      previousCumulative: 0,
      currentAmount: 0.5,
      currentCumulative: 0.5,
      materialAdjustment: 0,
      changeAmount: 0,
      deductionAmount: 0,
      surchargeAmount: 0,
      changeRemark: '',
      materialRemark: '',
      surchargeRemark: '',
      deductionRemark: '',
      remark: '',
      status: 'draft',
      createdAt: '2026-04-30T00:00:00.000Z',
    },
  ]
}

describe('settlement-list.helpers', () => {
  it('creates a clean settlement create form state', () => {
    expect(createSettlementCreateForm()).toEqual({
      projectId: undefined,
      contractIds: [],
      settlementType: 'interim',
      dateRange: null,
    })
  })

  it('builds settlement rows with resolved project and contract names', () => {
    const rows = buildSettlementListRows(createSettlements(), createProjects(), createContracts())

    expect(rows[0]).toMatchObject({
      settlementNo: 'JS-001-01',
      projectName: '一标段路面工程',
      contractNamesText: 'HT-001-01 - 主合同 A / HT-001-02 - 补充合同 A',
      contractCount: 2,
    })
  })

  it('filters settlement rows by query, status, type and project', () => {
    const rows = buildSettlementListRows(createSettlements(), createProjects(), createContracts())

    expect(filterSettlementRows(rows, {
      searchQuery: '补充合同 A',
      status: '',
      settlementType: '',
      projectId: undefined,
    }).map(row => row.id)).toEqual([1])

    expect(filterSettlementRows(rows, {
      searchQuery: '',
      status: 'approved',
      settlementType: 'final',
      projectId: 1,
    }).map(row => row.id)).toEqual([2])
  })

  it('summarizes effective settlement counts and amounts', () => {
    const rows = buildSettlementListRows(createSettlements(), createProjects(), createContracts())

    expect(buildSettlementListSummary(rows)).toEqual({
      totalCount: 3,
      draftCount: 1,
      effectiveCount: 2,
      approvedCount: 1,
      effectiveAmount: 3,
    })
  })
})
