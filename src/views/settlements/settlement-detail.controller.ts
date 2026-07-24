import { settlementAttachmentManagerService } from '@/services/attachment-manager.service'
import {
  loadSettlementEditorSnapshot,
  revertSettlementEditorToDraft,
  saveSettlementEditor,
  type PendingSettlementAttachmentInput,
  type SettlementEditorLoadInput,
  type SettlementEditorSnapshot,
} from '@/services/settlement-editor.service'
import {
  exportSettlementSpreadsheet,
  type ExportSettlementSpreadsheetPayload,
} from '@/services/spreadsheet.service'
import { buildSaveFileSuccessMessage, type SaveFileResult } from '@/utils/file-download'
import type { SettlementDetailRow, SettlementStatus } from '@/types'
import type { SettlementDraft } from './settlement-detail.helpers'
import {
  buildSettlementSavePayload,
  saveSuccessMessageMap,
} from './settlement-detail.helpers'

export const settlementDetailAttachmentAdapter = settlementAttachmentManagerService

export interface SettlementDetailSaveResult {
  savedSettlementId: number
  isNewSettlement: boolean
  successMessage: string
}

export async function loadSettlementDetailPage(
  input: SettlementEditorLoadInput,
): Promise<SettlementEditorSnapshot | null> {
  return loadSettlementEditorSnapshot(input)
}

export async function undoSettlementDetailConfirm(settlementId: number) {
  const settlement = await revertSettlementEditorToDraft(settlementId)
  return {
    settlement,
    successMessage: '已撤销确认，可重新编辑',
  }
}

export async function saveSettlementDetail(
  settlement: SettlementDraft,
  details: SettlementDetailRow[],
  status: SettlementStatus,
  pendingAttachments: PendingSettlementAttachmentInput[] = [],
): Promise<SettlementDetailSaveResult> {
  const previousStatus = settlement.status
  settlement.status = status
  const isNewSettlement = settlement.id <= 0
  try {
    const saved = await saveSettlementEditor(
      buildSettlementSavePayload(settlement, details),
      pendingAttachments,
    )

    settlement.id = saved.settlement.id

    return {
      savedSettlementId: saved.settlement.id,
      isNewSettlement,
      successMessage: saveSuccessMessageMap[status],
    }
  } catch (error) {
    settlement.status = previousStatus
    throw error
  }
}

export async function exportSettlementDetail(
  payload: ExportSettlementSpreadsheetPayload,
): Promise<{ type: 'success'; data: SaveFileResult; successMessage: string } | { type: 'warning'; message: string }> {
  const result = await exportSettlementSpreadsheet(payload)
  if (result.canceled) {
    return {
      type: 'warning',
      message: '已取消导出',
    }
  }

  return {
    type: 'success',
    data: result,
    successMessage: buildSaveFileSuccessMessage(result),
  }
}

export function getSettlementDetailListRoute(): string {
  return '/settlements'
}
