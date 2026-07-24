import {
  loadBusinessSnapshot,
  type BusinessSnapshot,
  type ProjectSummaryRow,
  type ReceivableRow,
  type SettlementReportRow,
} from '@/services/analytics.service'
import { exportReportSpreadsheet } from '@/services/spreadsheet.service'
import type { SaveFileResult } from '@/utils/file-download'
import type { ReportType } from './report-center.helpers'

interface ReportCenterExportInput {
  reportType: ReportType
  projectSummary: ProjectSummaryRow[]
  settlementDetails: SettlementReportRow[]
  receivableList: ReceivableRow[]
}

export async function loadReportCenterPage(): Promise<BusinessSnapshot> {
  return loadBusinessSnapshot()
}

export async function exportReportCenter(input: ReportCenterExportInput): Promise<SaveFileResult> {
  if (input.reportType === 'project_summary') {
    return exportReportSpreadsheet({
      type: 'project_summary',
      rows: input.projectSummary,
    })
  }

  if (input.reportType === 'settlement_detail') {
    return exportReportSpreadsheet({
      type: 'settlement_detail',
      rows: input.settlementDetails,
    })
  }

  return exportReportSpreadsheet({
    type: 'receivable',
    rows: input.receivableList,
  })
}
