import { describe, expect, it } from 'vitest'
import type { BusinessSnapshot } from '@/services/analytics.service'
import {
  buildProjectListRows,
  buildProjectListSummary,
  createProjectForm,
  filterProjectRows,
  suggestNextProjectCode,
} from './project-list.helpers'

function createSnapshot(): BusinessSnapshot {
  return {
    projects: [
      {
        id: 1,
        code: 'XM-001',
        name: '一标段路面工程',
        projectType: 'highway',
        location: '测试路段 A',
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
        name: '市政养护项目',
        projectType: 'municipal',
        location: '测试路段 B',
        ownerUnit: '业主单位 B',
        generalContractor: '总包单位 B',
        startDate: '2026-02-01',
        plannedEndDate: '2026-11-30',
        actualEndDate: '',
        status: 'in_progress',
        createdAt: '2026-02-01T00:00:00.000Z',
      },
    ],
    contracts: [
      {
        id: 1,
        projectId: 1,
        contractNo: 'HT-001-01',
        contractName: '主合同 A',
        contractDate: '2026-01-02',
        noTaxAmount: 1.835,
        contractTaxRate: 9,
        taxAmount: 0.165,
        contractAmount: 2,
        amountSource: 'auto',
        summary: '',
      },
      {
        id: 2,
        projectId: 1,
        contractNo: 'HT-001-02',
        contractName: '补充合同 A',
        contractDate: '2026-02-02',
        noTaxAmount: 2.752,
        contractTaxRate: 9,
        taxAmount: 0.248,
        contractAmount: 3,
        amountSource: 'auto',
        summary: '',
      },
      {
        id: 3,
        projectId: 2,
        contractNo: 'HT-002-01',
        contractName: '主合同 B',
        contractDate: '2026-03-02',
        noTaxAmount: 0.917,
        contractTaxRate: 9,
        taxAmount: 0.083,
        contractAmount: 1,
        amountSource: 'auto',
        summary: '',
      },
    ],
    settlements: [
      {
        id: 1,
        projectId: 1,
        contractIds: [1],
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
        contractIds: [2],
        settlementNo: 'JS-001-02',
        settlementType: 'interim',
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
        status: 'draft',
        createdAt: '2026-04-30T00:00:00.000Z',
      },
      {
        id: 3,
        projectId: 2,
        contractIds: [3],
        settlementNo: 'JS-002-01',
        settlementType: 'final',
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
        status: 'approved',
        createdAt: '2026-04-30T00:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 1,
        projectId: 1,
        paymentType: 'receive',
        paymentDate: '2026-04-10',
        amount: 1.5,
        paymentMethod: '银行转账',
        referenceNo: '',
        description: '',
      },
      {
        id: 2,
        projectId: 2,
        paymentType: 'receive',
        paymentDate: '2026-04-12',
        amount: 0.25,
        paymentMethod: '银行转账',
        referenceNo: '',
        description: '',
      },
    ],
    invoices: [],
  }
}

describe('project-list.helpers', () => {
  it('creates safe project form defaults', () => {
    expect(createProjectForm()).toEqual({
      code: '',
      name: '',
      projectType: 'highway',
      location: '',
      ownerUnit: '',
      generalContractor: '',
      startDate: '',
      plannedEndDate: '',
      status: 'preparing',
      difficulty: 'medium',
    })
  })

  it('suggests the next project code from the latest sequential code', () => {
    expect(suggestNextProjectCode([
      { code: 'XM-009' },
      { code: 'XM-008' },
    ])).toBe('XM-010')

    expect(suggestNextProjectCode([
      { code: '演示项目' },
    ])).toBe('XM-001')
  })

  it('builds project rows with contract, settlement and receipt metrics', () => {
    const rows = buildProjectListRows(createSnapshot())

    expect(rows[0]).toMatchObject({
      id: 1,
      contractAmount: 5,
      settledAmount: 2,
      receivedAmount: 1.5,
      unreceivedAmount: 0.5,
      settlementRatio: 40,
    })

    expect(rows[1]).toMatchObject({
      id: 2,
      contractAmount: 1,
      settledAmount: 0.5,
      receivedAmount: 0.25,
      unreceivedAmount: 0.25,
      settlementRatio: 50,
    })
  })

  it('filters rows by query, status and project type', () => {
    const rows = buildProjectListRows(createSnapshot())

    expect(filterProjectRows(rows, {
      searchQuery: '总包单位 A',
      status: '',
      projectType: '',
    }).map(row => row.id)).toEqual([1])

    expect(filterProjectRows(rows, {
      searchQuery: '',
      status: 'in_progress',
      projectType: 'municipal',
    }).map(row => row.id)).toEqual([2])
  })

  it('summarizes filtered rows into compact header metrics', () => {
    const rows = buildProjectListRows(createSnapshot())
    const summary = buildProjectListSummary(rows)

    expect(summary).toEqual({
      totalCount: 2,
      preparingCount: 0,
      inProgressCount: 1,
      settlingCount: 1,
      completedCount: 0,
      contractAmount: 6,
      settledAmount: 2.5,
      receivedAmount: 1.75,
      unreceivedAmount: 0.75,
    })
  })
})
