import { describe, expect, it } from 'vitest'
import type {
  ContractorSummaryRow,
  ProjectSummaryRow,
  ReceivableRow,
  SettlementReportRow,
} from '@/services/analytics.service'
import {
  buildContractorSummaryExportPayload,
  buildProjectSummaryReportExportPayload,
  buildReceivableReportExportPayload,
  buildSettlementDetailReportExportPayload,
} from './excel-presets'

describe('excel presets', () => {
  it('builds contractor summary export payload with nested project rows', () => {
    const rows: ContractorSummaryRow[] = [
      {
        contractorName: '总包一',
        projectCount: 1,
        contractAmount: 100,
        settledAmount: 60,
        receivedAmount: 40,
        unreceivedAmount: 20,
        invoicedAmount: 30,
        invoiceGap: 30,
        settlementRatio: '60.0',
        receiveRatio: '66.7',
        projects: [
          {
            projectId: 1,
            projectName: '项目A',
            projectCode: 'P-001',
            status: 'in_progress',
            contractAmount: 100,
            settledAmount: 60,
            receivedAmount: 40,
            unreceivedAmount: 20,
            invoicedAmount: 30,
            settlementRatio: '60.0',
            receiveRatio: '66.7',
          },
        ],
      },
    ]

    const payload = buildContractorSummaryExportPayload(rows, new Date('2026-04-09T00:00:00.000Z'))

    expect(payload.fileName).toBe('总包汇总_2026-04-09')
    expect(payload.sheetName).toBe('总包汇总')
    expect(payload.data).toEqual([
      ['总包单位', '项目数', '合同总额(含税)', '已结算', '已收款', '待收款', '已开票', '开票差额', '结算进度', '收款进度'],
      ['总包一', 1, 100, 60, 40, 20, 30, 30, '60.0%', '66.7%'],
      ['  - 项目A (P-001)', '', 100, 60, 40, 20, 30, '', '60.0%', '66.7%'],
    ])
  })

  it('builds project summary report export payload', () => {
    const rows: ProjectSummaryRow[] = [
      {
        projectId: 1,
        projectCode: 'P-001',
        projectName: '项目A',
        projectType: 'highway',
        status: 'settling',
        noTaxContractAmount: 91.743,
        contractAmount: 100,
        contractTaxAmount: 8.257,
        settledAmount: 60,
        settlementRatio: '60.0',
        unsettledAmount: 40,
      },
    ]

    const payload = buildProjectSummaryReportExportPayload(rows)

    expect(payload.fileName).toBe('项目汇总表')
    expect(payload.data[1]).toEqual(['P-001', '项目A', '公路', '结算中', 91.743, 8.257, 100, 60, '60.0%', 40])
  })

  it('builds settlement detail report export payload', () => {
    const rows: SettlementReportRow[] = [
      {
        settlementNo: 'JS-001',
        projectName: '项目A',
        settlementType: 'interim',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        baseAmount: 50,
        adjustment: 5,
        deductionAmount: 2,
        currentAmount: 53,
        status: 'confirmed',
      },
    ]

    const payload = buildSettlementDetailReportExportPayload(rows)

    expect(payload.fileName).toBe('结算明细表')
    expect(payload.data[1]).toEqual(['JS-001', '项目A', '中期', '2026-04-01 至 2026-04-05', 50, 5, 2, 53])
  })

  it('builds receivable report export payload', () => {
    const rows: ReceivableRow[] = [
      {
        projectId: 1,
        projectName: '项目A',
        noTaxContractAmount: 91.743,
        contractAmount: 100,
        contractTaxAmount: 8.257,
        settledAmount: 60,
        receivedAmount: 40,
        unreceivedAmount: 20,
        invoicedAmount: 30,
        invoiceGap: 30,
        settleRatio: '60.0',
        receiveRatio: '66.7',
      },
    ]

    const payload = buildReceivableReportExportPayload(rows)

    expect(payload.fileName).toBe('应收款统计')
    expect(payload.data[1]).toEqual(['项目A', 91.743, 8.257, 100, 60, 40, 20, 30, 30, '60.0%', '66.7%'])
  })
})
