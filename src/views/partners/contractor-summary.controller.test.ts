import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  exportContractorSummarySpreadsheetMock,
  loadBusinessSnapshotMock,
} = vi.hoisted(() => ({
  exportContractorSummarySpreadsheetMock: vi.fn(),
  loadBusinessSnapshotMock: vi.fn(),
}))

vi.mock('@/services/analytics.service', () => ({
  loadBusinessSnapshot: loadBusinessSnapshotMock,
}))

vi.mock('@/services/spreadsheet.service', () => ({
  exportContractorSummarySpreadsheet: exportContractorSummarySpreadsheetMock,
}))

import {
  exportContractorSummary,
  getContractorProjectRoute,
  loadContractorSummaryPage,
} from './contractor-summary.controller'

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

describe('contractor-summary.controller', () => {
  it('loads contractor summary page snapshot through analytics service', async () => {
    loadBusinessSnapshotMock.mockResolvedValue(emptySnapshot)

    await expect(loadContractorSummaryPage()).resolves.toBe(emptySnapshot)
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('exports contractor summary rows through spreadsheet service', async () => {
    const rows = [{
      contractorName: '总包A',
      projectCount: 1,
      contractAmount: 10,
      settledAmount: 8,
      receivedAmount: 5,
      unreceivedAmount: 3,
      invoicedAmount: 4,
      invoiceGap: 4,
      settlementRatio: '80.0',
      receiveRatio: '62.5',
      projects: [],
    }]

    const saveResult = { canceled: false, fileName: '总包汇总.csv', method: 'browser-download' }
    exportContractorSummarySpreadsheetMock.mockResolvedValue(saveResult)

    await expect(exportContractorSummary(rows)).resolves.toBe(saveResult)
    expect(exportContractorSummarySpreadsheetMock).toHaveBeenCalledWith(rows)
  })

  it('builds contractor project detail route', () => {
    expect(getContractorProjectRoute(7)).toBe('/projects/7')
  })
})
