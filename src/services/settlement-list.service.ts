import type { Contract, Project, Settlement } from '@/types'
import { getDb } from './db-core'
import { contractService } from './contract.service'
import { projectService } from './project.service'
import { settlementService } from './settlement.service'

export interface SettlementDeletePreview {
  detailCount: number
  attachmentCount: number
}

export async function getSettlementDeletePreview(
  settlementId: number,
): Promise<SettlementDeletePreview> {
  const db = getDb()
  if (!db) return { detailCount: 0, attachmentCount: 0 }

  const detailResult = db.exec(
    'SELECT COUNT(*) AS cnt FROM settlement_details WHERE settlement_id = ?',
    [settlementId],
  )
  const attachmentResult = db.exec(
    'SELECT COUNT(*) AS cnt FROM settlement_attachments WHERE settlement_id = ?',
    [settlementId],
  )

  const detailCount = (detailResult[0]?.values[0]?.[0] as number | undefined) ?? 0
  const attachmentCount = (attachmentResult[0]?.values[0]?.[0] as number | undefined) ?? 0

  return { detailCount, attachmentCount }
}

export interface SettlementListSnapshot {
  projects: Project[]
  contracts: Contract[]
  settlements: Settlement[]
}

export async function loadSettlementListSnapshot(): Promise<SettlementListSnapshot> {
  const [projects, contracts, settlements] = await Promise.all([
    projectService.getAll(),
    contractService.getAll(),
    settlementService.getAll(),
  ])

  return {
    projects,
    contracts,
    settlements,
  }
}

export async function deleteSettlementAndReloadList(
  settlementId: number,
): Promise<SettlementListSnapshot> {
  await settlementService.delete(settlementId)
  return loadSettlementListSnapshot()
}
