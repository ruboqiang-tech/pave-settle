import {
  loadBusinessSnapshot,
  type BusinessSnapshot,
  type ContractorSummaryRow,
} from '@/services/analytics.service'
import { exportContractorSummarySpreadsheet } from '@/services/spreadsheet.service'
import type { SaveFileResult } from '@/utils/file-download'

export async function loadContractorSummaryPage(): Promise<BusinessSnapshot> {
  return loadBusinessSnapshot()
}

export async function exportContractorSummary(rows: ContractorSummaryRow[]): Promise<SaveFileResult> {
  return exportContractorSummarySpreadsheet(rows)
}

export function getContractorProjectRoute(projectId: number): string {
  return `/projects/${projectId}`
}
