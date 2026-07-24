import {
  deleteSettlementAndReloadList,
  getSettlementDeletePreview,
  loadSettlementListSnapshot,
  type SettlementDeletePreview,
  type SettlementListSnapshot,
} from '@/services/settlement-list.service'
import type { SettlementCreateFormState } from './settlement-list.helpers'

export type { SettlementDeletePreview }

export interface SettlementListMutationResult {
  snapshot: SettlementListSnapshot
  successMessage: string
}

export async function loadSettlementListPage(): Promise<SettlementListSnapshot> {
  return loadSettlementListSnapshot()
}

export async function fetchSettlementDeletePreview(
  settlementId: number,
): Promise<SettlementDeletePreview> {
  return getSettlementDeletePreview(settlementId)
}

export async function deleteSettlementListSettlement(
  settlementId: number,
): Promise<SettlementListMutationResult> {
  const snapshot = await deleteSettlementAndReloadList(settlementId)
  return {
    snapshot,
    successMessage: '结算单已删除',
  }
}

export function buildSettlementCreateRoute(form: SettlementCreateFormState): string {
  const contractIds = form.contractIds.join(',')
  const [startDate = '', endDate = ''] = form.dateRange || []

  return `/settlements/create?projectId=${form.projectId}&contractIds=${contractIds}&type=${form.settlementType}&start=${startDate}&end=${endDate}`
}

export function getSettlementListDetailRoute(settlementId: number): string {
  return `/settlements/${settlementId}`
}
