import { describe, expect, it } from 'vitest'
import type {
  ProjectSummaryRow,
  ReceivableRow,
  SettlementReportRow,
} from '@/services/analytics.service'
import {
  buildProjectSummaryTableSummary,
  buildReceivableTableSummary,
  buildReportHighlightCards,
  buildReportMeta,
  buildSettlementTableSummary,
  formatSummaryAmount,
} from './report-center.helpers'

function createProjectSummaryRow(overrides: Partial<ProjectSummaryRow> = {}): ProjectSummaryRow {
  return {
    projectId: 1,
    projectCode: 'XM-001',
    projectName: '测试项目',
    projectType: 'highway',
    status: 'settling',
    noTaxContractAmount: 1.835,
    contractAmount: 2,
    contractTaxAmount: 0.165,
    settledAmount: 1,
    settlementRatio: '50.0',
    unsettledAmount: 1,
    ...overrides,
  }
}

function createSettlementReportRow(overrides: Partial<SettlementReportRow> = {}): SettlementReportRow {
  return {
    settlementNo: 'JS-001-01',
    projectName: '测试项目',
    settlementType: 'interim',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    baseAmount: 2,
    adjustment: 0.5,
    deductionAmount: 0.25,
    currentAmount: 2.25,
    status: 'confirmed',
    ...overrides,
  }
}

function createReceivableRow(overrides: Partial<ReceivableRow> = {}): ReceivableRow {
  return {
    projectId: 1,
    projectName: '测试项目',
    noTaxContractAmount: 1.835,
    contractAmount: 2,
    contractTaxAmount: 0.165,
    settledAmount: 1.5,
    receivedAmount: 1,
    unreceivedAmount: 0.5,
    invoicedAmount: 0.75,
    invoiceGap: 0.75,
    settleRatio: '75.0',
    receiveRatio: '66.7',
    ...overrides,
  }
}

describe('report-center.helpers', () => {
  it('formats summary amounts as currency and builds concise report meta', () => {
    expect(formatSummaryAmount(2)).toBe('￥2.000')
    expect(buildReportMeta('project_summary', {
      projectCount: 2,
      settlementCount: 0,
      totalUnreceived: 0,
    })).toMatchObject({
      description: '统一查看项目合同参考额、已结算与参考未结算余额，避免项目页、汇总页、报表页各算各的。',
      highlight: '当前共 2 个项目',
    })
    expect(buildReportMeta('receivable', {
      projectCount: 0,
      settlementCount: 0,
      totalUnreceived: 3,
    })).toMatchObject({
      description: '把结算、收款、开票放在同一张表里，便于统一核对待收款和待开票参考。',
      highlight: '当前待收 ￥3.000',
    })
  })

  it('builds highlight cards for each report type on a single source of truth', () => {
    const projectCards = buildReportHighlightCards('project_summary', {
      projectSummary: [
        createProjectSummaryRow({ contractAmount: 2, settledAmount: 1, unsettledAmount: 1 }),
        createProjectSummaryRow({ projectId: 2, contractAmount: 3, settledAmount: 2, unsettledAmount: 1 }),
      ],
      settlementDetails: [],
      receivableList: [],
      receivableSummary: { totalSettled: 0, totalReceived: 0, totalUnreceived: 0, totalInvoiced: 0 },
    })

    const settlementCards = buildReportHighlightCards('settlement_detail', {
      projectSummary: [],
      settlementDetails: [
        createSettlementReportRow({ baseAmount: 2, adjustment: 0.5, currentAmount: 2.25 }),
        createSettlementReportRow({ settlementNo: '2', baseAmount: 3, adjustment: 0.25, currentAmount: 3.1 }),
      ],
      receivableList: [],
      receivableSummary: { totalSettled: 0, totalReceived: 0, totalUnreceived: 0, totalInvoiced: 0 },
    })

    const receivableCards = buildReportHighlightCards('receivable', {
      projectSummary: [],
      settlementDetails: [],
      receivableList: [createReceivableRow()],
      receivableSummary: { totalSettled: 1.5, totalReceived: 1, totalUnreceived: 0.5, totalInvoiced: 0.75 },
    })

    expect(projectCards[1].value).toBe('￥5.000')
    expect(projectCards[3]).toMatchObject({
      label: '参考未结算',
      note: '按合同参考额减已结算后的参考余额',
    })
    expect(settlementCards[1].value).toBe('￥5.000')
    expect(receivableCards[2].value).toBe('￥0.500')
  })

  it('builds aligned table summaries for project, settlement and receivable reports', () => {
    expect(buildProjectSummaryTableSummary({
      columns: [{}, { property: 'projectName' }, { property: 'noTaxContractAmount' }, { property: 'contractTaxAmount' }, { property: 'contractAmount' }, { property: 'settledAmount' }, { property: 'unsettledAmount' }],
      data: [createProjectSummaryRow()],
    })).toEqual(['', '合计', '￥1.835', '￥0.165', '￥2.000', '￥1.000', '￥1.000'])

    expect(buildSettlementTableSummary({
      columns: [{}, { property: 'settlementNo' }, { property: 'baseAmount' }, { property: 'adjustment' }, { property: 'deductionAmount' }, { property: 'currentAmount' }],
      data: [createSettlementReportRow()],
    })).toEqual(['', '合计', '￥2.000', '￥0.500', '￥0.250', '￥2.250'])

    expect(buildReceivableTableSummary({
      columns: [{}, { property: 'projectName' }, { property: 'noTaxContractAmount' }, { property: 'contractTaxAmount' }, { property: 'contractAmount' }, { property: 'settledAmount' }, { property: 'receivedAmount' }, { property: 'unreceivedAmount' }, { property: 'invoicedAmount' }, { property: 'invoiceGap' }],
      data: [createReceivableRow()],
    })).toEqual(['', '合计', '￥1.835', '￥0.165', '￥2.000', '￥1.500', '￥1.000', '￥0.500', '￥0.750', '￥0.750'])
  })
})
