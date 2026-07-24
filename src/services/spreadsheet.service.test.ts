import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  downloadCsvFileMock,
  importFromExcelMock,
  buildContractorSummaryExportPayloadMock,
  buildProjectSummaryReportExportPayloadMock,
  buildReceivableReportExportPayloadMock,
  buildSettlementDetailReportExportPayloadMock,
  downloadBasicBoqImportTemplateMock,
  exportProjectBoqCsvMock,
  exportSettlementExcelMock,
  importCsvFileMock,
} = vi.hoisted(() => ({
  downloadCsvFileMock: vi.fn(),
  importCsvFileMock: vi.fn(),
  importFromExcelMock: vi.fn(),
  buildContractorSummaryExportPayloadMock: vi.fn(),
  buildProjectSummaryReportExportPayloadMock: vi.fn(),
  buildReceivableReportExportPayloadMock: vi.fn(),
  buildSettlementDetailReportExportPayloadMock: vi.fn(),
  downloadBasicBoqImportTemplateMock: vi.fn(),
  exportProjectBoqCsvMock: vi.fn(),
  exportSettlementExcelMock: vi.fn(),
}))

vi.mock('@/utils/csv', () => ({
  downloadCsvFile: downloadCsvFileMock,
  importCsvFile: importCsvFileMock,
}))

vi.mock('@/utils/excel', () => ({
  importFromExcel: importFromExcelMock,
}))

vi.mock('@/utils/excel-presets', () => ({
  buildContractorSummaryExportPayload: buildContractorSummaryExportPayloadMock,
  buildProjectSummaryReportExportPayload: buildProjectSummaryReportExportPayloadMock,
  buildReceivableReportExportPayload: buildReceivableReportExportPayloadMock,
  buildSettlementDetailReportExportPayload: buildSettlementDetailReportExportPayloadMock,
  downloadBasicBoqImportTemplate: downloadBasicBoqImportTemplateMock,
  exportProjectBoqCsv: exportProjectBoqCsvMock,
  exportSettlementExcel: exportSettlementExcelMock,
}))

import {
  downloadProjectBoqImportTemplate,
  exportContractorSummarySpreadsheet,
  exportProjectBoqSpreadsheet,
  exportReportSpreadsheet,
  exportSettlementSpreadsheet,
  importProjectBoqCsvRows,
  importSpreadsheetRows,
} from './spreadsheet.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('spreadsheet.service', () => {
  it('delegates import and export actions to the underlying spreadsheet helpers', async () => {
    const file = {} as File
    const projectPayload = {
      contractNo: 'HT-001-01',
      contractName: '测试合同',
      items: [{ itemName: '项目A', unit: 'm2', quantity: 1, unitPrice: 2, totalPrice: 2 }],
    }
    const settlementPayload = {
      settlement: {
        settlementNo: 'JS-001-01',
        settlementType: 'interim' as const,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
        changeAmount: 0,
        materialAdjustment: 0,
        surchargeAmount: 0,
        deductionAmount: 0,
        currentAmount: 2,
        previousCumulative: 0,
        currentCumulative: 2,
      },
      contractNames: ['测试合同'],
      contractAmount: 2,
      settlementRatio: 100,
      details: [],
    }

    importFromExcelMock.mockResolvedValue([{ itemName: '导入项' }])
    importCsvFileMock.mockResolvedValue([{ itemName: 'CSV导入项' }])

    await expect(importSpreadsheetRows(file, 2)).resolves.toEqual([{ itemName: '导入项' }])
    await expect(importProjectBoqCsvRows(file)).resolves.toEqual([{ itemName: 'CSV导入项' }])
    await downloadProjectBoqImportTemplate()
    await exportProjectBoqSpreadsheet(projectPayload)
    await exportSettlementSpreadsheet(settlementPayload)

    expect(importFromExcelMock).toHaveBeenCalledWith(file, 2)
    expect(importCsvFileMock).toHaveBeenCalledWith(file)
    expect(downloadBasicBoqImportTemplateMock).toHaveBeenCalledWith('project-boq-import-template', 'project-boq')
    expect(exportProjectBoqCsvMock).toHaveBeenCalledWith(projectPayload)
    expect(exportSettlementExcelMock).toHaveBeenCalledWith(settlementPayload)
  })

  it('exports contractor summary through csv payload builder', async () => {
    const rows = [{ contractorName: '总包A', projectCount: 1 }] as never[]
    const date = new Date('2026-04-09T00:00:00.000Z')
    const saveResult = { canceled: false, fileName: 'contractors.csv', method: 'browser-download' }
    buildContractorSummaryExportPayloadMock.mockReturnValue({
      fileName: 'contractors',
      data: [['列头'], ['值']],
    })
    downloadCsvFileMock.mockResolvedValue(saveResult)

    await expect(exportContractorSummarySpreadsheet(rows, date)).resolves.toBe(saveResult)

    expect(buildContractorSummaryExportPayloadMock).toHaveBeenCalledWith(rows, date)
    expect(downloadCsvFileMock).toHaveBeenCalledWith('contractors', [['列头'], ['值']])
  })

  it('routes project summary reports to csv export', async () => {
    const rows = [{ projectName: '项目A' }] as never[]
    const saveResult = { canceled: false, fileName: 'project-summary.csv', method: 'browser-download' }
    buildProjectSummaryReportExportPayloadMock.mockReturnValue({
      fileName: 'project-summary',
      data: [['项目'], ['项目A']],
    })
    downloadCsvFileMock.mockResolvedValue(saveResult)

    await expect(exportReportSpreadsheet({
      type: 'project_summary',
      rows,
    })).resolves.toBe(saveResult)

    expect(buildProjectSummaryReportExportPayloadMock).toHaveBeenCalledWith(rows)
    expect(downloadCsvFileMock).toHaveBeenCalledWith('project-summary', [['项目'], ['项目A']])
  })

  it('routes settlement detail reports to csv export', async () => {
    const rows = [{ settlementNo: 'JS-001-01' }] as never[]
    const saveResult = { canceled: false, fileName: 'settlement-detail.csv', method: 'browser-download' }
    buildSettlementDetailReportExportPayloadMock.mockReturnValue({
      fileName: 'settlement-detail',
      data: [['结算单'], ['JS-001-01']],
    })
    downloadCsvFileMock.mockResolvedValue(saveResult)

    await expect(exportReportSpreadsheet({
      type: 'settlement_detail',
      rows,
    })).resolves.toBe(saveResult)

    expect(buildSettlementDetailReportExportPayloadMock).toHaveBeenCalledWith(rows)
    expect(downloadCsvFileMock).toHaveBeenCalledWith('settlement-detail', [['结算单'], ['JS-001-01']])
  })

  it('routes receivable reports to csv export', async () => {
    const rows = [{ projectName: '项目A', unreceivedAmount: 10 }] as never[]
    const saveResult = { canceled: false, fileName: 'receivable.csv', method: 'browser-download' }
    buildReceivableReportExportPayloadMock.mockReturnValue({
      fileName: 'receivable',
      data: [['项目'], ['项目A']],
    })
    downloadCsvFileMock.mockResolvedValue(saveResult)

    await expect(exportReportSpreadsheet({
      type: 'receivable',
      rows,
    })).resolves.toBe(saveResult)

    expect(buildReceivableReportExportPayloadMock).toHaveBeenCalledWith(rows)
    expect(downloadCsvFileMock).toHaveBeenCalledWith('receivable', [['项目'], ['项目A']])
  })
})
