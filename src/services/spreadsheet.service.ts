import type {
  ContractorSummaryRow,
  ProjectSummaryRow,
  ReceivableRow,
  SettlementReportRow,
} from './analytics.service'
import type { BillOfQuantities, Settlement, SettlementDetailRow } from '@/types'
import { downloadCsvFile, importCsvFile } from '@/utils/csv'
import { importFromExcel } from '@/utils/excel'
import type { SaveFileResult } from '@/utils/file-download'
import {
  buildContractorSummaryExportPayload,
  buildProjectSummaryReportExportPayload,
  buildReceivableReportExportPayload,
  buildSettlementDetailReportExportPayload,
  downloadBasicBoqImportTemplate,
  exportProjectBoqCsv,
  exportSettlementExcel,
} from '@/utils/excel-presets'

export type ProjectBoqSpreadsheetItem = Pick<
  BillOfQuantities,
  'itemName' | 'remark' | 'note' | 'unit' | 'quantity' | 'unitPrice' | 'totalPrice'
  | 'taxRate' | 'noTaxUnitPrice' | 'noTaxTotalPrice' | 'taxAmount'
>

export interface ExportProjectBoqSpreadsheetPayload {
  projectCode?: string
  projectName?: string
  contractNo: string
  contractName: string
  items: ProjectBoqSpreadsheetItem[]
}

export interface ExportSettlementSpreadsheetPayload {
  settlement: Pick<
    Settlement,
    | 'settlementNo'
    | 'settlementType'
    | 'startDate'
    | 'endDate'
    | 'changeAmount'
    | 'materialAdjustment'
    | 'surchargeAmount'
    | 'deductionAmount'
    | 'currentAmount'
    | 'previousCumulative'
    | 'currentCumulative'
  >
  projectName?: string
  contractNames: string[]
  contractAmount: number
  settlementRatio: number
  details: SettlementDetailRow[]
}

export type ReportSpreadsheetExportPayload =
  | { type: 'project_summary'; rows: ProjectSummaryRow[] }
  | { type: 'settlement_detail'; rows: SettlementReportRow[] }
  | { type: 'receivable'; rows: ReceivableRow[] }

export async function importSpreadsheetRows<T = Record<string, unknown>>(
  file: File,
  sheetIndex: number = 0,
): Promise<T[]> {
  return importFromExcel<T>(file, sheetIndex)
}

export async function importProjectBoqCsvRows<T = Record<string, unknown>>(file: File): Promise<T[]> {
  return importCsvFile<T>(file)
}

export async function downloadProjectBoqImportTemplate(): Promise<SaveFileResult> {
  return downloadBasicBoqImportTemplate('project-boq-import-template', 'project-boq')
}

export async function exportProjectBoqSpreadsheet(payload: ExportProjectBoqSpreadsheetPayload): Promise<SaveFileResult> {
  return exportProjectBoqCsv(payload)
}

export async function exportSettlementSpreadsheet(payload: ExportSettlementSpreadsheetPayload): Promise<SaveFileResult> {
  return exportSettlementExcel(payload)
}

export async function exportContractorSummarySpreadsheet(
  rows: ContractorSummaryRow[],
  date = new Date(),
): Promise<SaveFileResult> {
  const payload = buildContractorSummaryExportPayload(rows, date)
  return downloadCsvFile(payload.fileName, payload.data)
}

export async function exportReportSpreadsheet(payload: ReportSpreadsheetExportPayload): Promise<SaveFileResult> {
  if (payload.type === 'project_summary') {
    const csvPayload = buildProjectSummaryReportExportPayload(payload.rows)
    return downloadCsvFile(csvPayload.fileName, csvPayload.data)
  }

  if (payload.type === 'settlement_detail') {
    const csvPayload = buildSettlementDetailReportExportPayload(payload.rows)
    return downloadCsvFile(csvPayload.fileName, csvPayload.data)
  }

  const csvPayload = buildReceivableReportExportPayload(payload.rows)
  return downloadCsvFile(csvPayload.fileName, csvPayload.data)
}
