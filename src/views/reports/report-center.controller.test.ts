import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  exportReportSpreadsheetMock,
  loadBusinessSnapshotMock,
} = vi.hoisted(() => ({
  exportReportSpreadsheetMock: vi.fn(),
  loadBusinessSnapshotMock: vi.fn(),
}))

vi.mock('@/services/analytics.service', () => ({
  loadBusinessSnapshot: loadBusinessSnapshotMock,
}))

vi.mock('@/services/spreadsheet.service', () => ({
  exportReportSpreadsheet: exportReportSpreadsheetMock,
}))

import {
  exportReportCenter,
  loadReportCenterPage,
} from './report-center.controller'

const emptySnapshot = {
  projects: [],
  contracts: [],
  settlements: [],
  payments: [],
  invoices: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('report-center.controller', () => {
  it('loads report center page snapshot through analytics service', async () => {
    loadBusinessSnapshotMock.mockResolvedValue(emptySnapshot)

    await expect(loadReportCenterPage()).resolves.toBe(emptySnapshot)
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('exports project summary, settlement detail and receivable reports by report type', async () => {
    const saveResult = { canceled: false, fileName: 'report.csv', method: 'browser-download' }
    exportReportSpreadsheetMock.mockResolvedValue(saveResult)
    const input = {
      projectSummary: [{ id: 1 }],
      settlementDetails: [{ id: 2 }],
      receivableList: [{ id: 3 }],
    }

    await expect(exportReportCenter({
      reportType: 'project_summary',
      ...input,
    })).resolves.toBe(saveResult)
    await expect(exportReportCenter({
      reportType: 'settlement_detail',
      ...input,
    })).resolves.toBe(saveResult)
    await expect(exportReportCenter({
      reportType: 'receivable',
      ...input,
    })).resolves.toBe(saveResult)

    expect(exportReportSpreadsheetMock).toHaveBeenNthCalledWith(1, {
      type: 'project_summary',
      rows: input.projectSummary,
    })
    expect(exportReportSpreadsheetMock).toHaveBeenNthCalledWith(2, {
      type: 'settlement_detail',
      rows: input.settlementDetails,
    })
    expect(exportReportSpreadsheetMock).toHaveBeenNthCalledWith(3, {
      type: 'receivable',
      rows: input.receivableList,
    })
  })
})
