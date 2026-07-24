import { execToObjects, getDb, saveToStorage, withTransaction, isDatabaseConnected } from './db-core'
import { settlementService } from './settlement.service'
import { calculateCurrentAmount } from '@/utils/calculations'
import {
  toSettlementChainBoqSnapshot,
  type SettlementChainBoqSnapshot,
} from './settlement-chain'

export type SettlementDetailLinkBoqSnapshot = SettlementChainBoqSnapshot

export interface SettlementDetailLinkRepairItem {
  detailId: number
  settlementId: number
  projectId: number
  settlementNo: string
  boqId: number
  contractId: number
  settlementContractIds: number[]
  itemCode: string
  itemName: string
  unit: string
  contractQuantity: number
  currentQuantity: number
  matchedBoqId: number | null
}

function normalizeMatchText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '')
}

function narrowBoqCandidates(
  candidates: SettlementDetailLinkBoqSnapshot[],
  detail: Pick<SettlementDetailLinkRepairItem, 'contractId' | 'unit' | 'contractQuantity'>,
): SettlementDetailLinkBoqSnapshot | null {
  let narrowed = [...candidates]

  if (detail.contractId > 0) {
    const sameContract = narrowed.filter(candidate => candidate.contractId === detail.contractId)
    if (sameContract.length > 0) narrowed = sameContract
  }

  const unitKey = normalizeMatchText(detail.unit)
  if (unitKey) {
    const sameUnit = narrowed.filter(candidate => normalizeMatchText(candidate.unit) === unitKey)
    if (sameUnit.length > 0) narrowed = sameUnit
  }

  if (detail.contractQuantity > 0) {
    const sameQuantity = narrowed.filter(candidate => Number(candidate.quantity) === Number(detail.contractQuantity))
    if (sameQuantity.length > 0) narrowed = sameQuantity
  }

  return narrowed.length === 1 ? narrowed[0] : null
}

export function findBestMatchingBoqForSettlementDetail(
  detail: Pick<SettlementDetailLinkRepairItem, 'contractId' | 'settlementContractIds' | 'itemCode' | 'itemName' | 'unit' | 'contractQuantity'>,
  boqs: SettlementDetailLinkBoqSnapshot[],
): SettlementDetailLinkBoqSnapshot | null {
  const allowedContractIds = Array.from(new Set([detail.contractId, ...detail.settlementContractIds].filter(id => id > 0)))
  let pool = boqs

  if (allowedContractIds.length > 0) {
    pool = boqs.filter(boq => allowedContractIds.includes(boq.contractId))
  }
  if (pool.length === 0) return null

  const itemCodeKey = normalizeMatchText(detail.itemCode)
  if (itemCodeKey) {
    const byCode = pool.filter(boq => normalizeMatchText(boq.itemCode) === itemCodeKey)
    const matched = narrowBoqCandidates(byCode, detail)
    if (matched) return matched
  }

  const itemNameKey = normalizeMatchText(detail.itemName)
  const unitKey = normalizeMatchText(detail.unit)
  if (itemNameKey && unitKey) {
    const byNameUnit = pool.filter(boq =>
      normalizeMatchText(boq.itemName) === itemNameKey &&
      normalizeMatchText(boq.unit) === unitKey,
    )
    const matched = narrowBoqCandidates(byNameUnit, detail)
    if (matched) return matched
  }

  if (itemNameKey) {
    const byName = pool.filter(boq => normalizeMatchText(boq.itemName) === itemNameKey)
    const matched = narrowBoqCandidates(byName, detail)
    if (matched) return matched
  }

  return null
}

function parseContractIds(raw: unknown): number[] {
  try {
    const parsed = JSON.parse(String(raw || '[]'))
    return Array.isArray(parsed) ? parsed.map(value => Number(value)).filter(value => value > 0) : []
  } catch {
    return []
  }
}

function mapLinkRepairBoq(row: Record<string, unknown>): SettlementDetailLinkBoqSnapshot {
  return toSettlementChainBoqSnapshot(row)
}

export async function scanLegacySettlementDetailLinkIssues(): Promise<SettlementDetailLinkRepairItem[]> {
  const db = getDb()
  if (!db) return []

  const orphanedRows = execToObjects(db.exec(`
    SELECT
      sd.id AS detail_id,
      sd.settlement_id,
      s.project_id,
      s.settlement_no,
      s.contract_ids,
      sd.boq_id,
      sd.contract_id,
      sd.item_code,
      sd.item_name,
      sd.unit,
      sd.contract_quantity,
      sd.current_quantity
    FROM settlement_details sd
    JOIN settlements s ON s.id = sd.settlement_id
    LEFT JOIN bill_of_quantities bq ON bq.id = sd.boq_id
    WHERE bq.id IS NULL
    ORDER BY sd.settlement_id, sd.id
  `))

  if (orphanedRows.length === 0) return []

  const boqs = execToObjects(db.exec(`
    SELECT id, contract_id, item_code, item_name, unit, quantity, unit_price
    FROM bill_of_quantities
    ORDER BY contract_id, sort_order, id
  `)).map(row => mapLinkRepairBoq(row))

  return orphanedRows.map(row => {
    const detail: SettlementDetailLinkRepairItem = {
      detailId: Number(row.detail_id),
      settlementId: Number(row.settlement_id),
      projectId: Number(row.project_id),
      settlementNo: String(row.settlement_no || ''),
      boqId: Number(row.boq_id),
      contractId: Number(row.contract_id || 0),
      settlementContractIds: parseContractIds(row.contract_ids),
      itemCode: String(row.item_code || ''),
      itemName: String(row.item_name || ''),
      unit: String(row.unit || ''),
      contractQuantity: Number(row.contract_quantity || 0),
      currentQuantity: Number(row.current_quantity || 0),
      matchedBoqId: null,
    }

    const matched = findBestMatchingBoqForSettlementDetail(detail, boqs)
    detail.matchedBoqId = matched?.id ?? null
    return detail
  })
}

export async function repairLegacySettlementDetailLinks(): Promise<{
  scannedCount: number
  repairedCount: number
  unresolvedCount: number
}> {
  const db = getDb()
  if (!db) {
    return { scannedCount: 0, repairedCount: 0, unresolvedCount: 0 }
  }

  const issues = await scanLegacySettlementDetailLinkIssues()
  const repairable = issues.filter(issue => issue.matchedBoqId !== null)
  if (repairable.length === 0) {
    return {
      scannedCount: issues.length,
      repairedCount: 0,
      unresolvedCount: issues.length,
    }
  }

  const matchedIds = Array.from(new Set(repairable.map(issue => issue.matchedBoqId!).filter(id => id > 0)))
  const placeholders = matchedIds.map(() => '?').join(', ')
  const boqs = execToObjects(db.exec(
    `SELECT id, contract_id, item_code, item_name, unit, quantity, unit_price
     FROM bill_of_quantities
     WHERE id IN (${placeholders})`,
    matchedIds,
  )).map(row => mapLinkRepairBoq(row))
  const boqById = new Map(boqs.map(boq => [boq.id, boq]))

  const affectedProjectIds = new Set<number>()
  await withTransaction(async transactionDb => {
    for (const issue of repairable) {
      const matchedBoq = boqById.get(issue.matchedBoqId!)
      if (!matchedBoq) continue

      transactionDb.run(
        `UPDATE settlement_details
         SET boq_id = ?, contract_id = ?, item_code = ?, item_name = ?, unit = ?, contract_quantity = ?, unit_price = ?, current_amount = ?
         WHERE id = ? AND settlement_id = ?`,
        [
          matchedBoq.id,
          matchedBoq.contractId,
          matchedBoq.itemCode,
          matchedBoq.itemName,
          matchedBoq.unit,
          matchedBoq.quantity,
          matchedBoq.unitPrice,
          calculateCurrentAmount(issue.currentQuantity, matchedBoq.unitPrice),
          issue.detailId,
          issue.settlementId,
        ],
      )
      affectedProjectIds.add(issue.projectId)
    }
  })

  if (repairable.length > 0 && isDatabaseConnected()) {
    await saveToStorage()
  }

  if (isDatabaseConnected()) {
    for (const projectId of affectedProjectIds) {
      await settlementService.recalculateProjectChain(projectId)
    }
  }

  return {
    scannedCount: issues.length,
    repairedCount: repairable.length,
    unresolvedCount: issues.length - repairable.length,
  }
}
