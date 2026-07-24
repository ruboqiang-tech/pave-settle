import type { Settlement, SettlementDetail } from '@/types'
import { getDb, getLastInsertId, saveToStorage, execToObjects, getRowNumber, getRowString, withTransaction } from './db-core'
import {
  buildSettlementChainBoqMap,
  normalizeSettlementChain,
  syncSettlementDetailsWithBoq,
} from './settlement-chain'
import { normalizeUniqueConstraintError } from './unique-constraint'
import { validateSettlementSavePayload } from './settlement-validation.service'
type DatabaseHandle = NonNullable<ReturnType<typeof getDb>>

export type SettlementUpsertInput = Omit<Settlement, 'id' | 'createdAt'>
export type SettlementDetailUpsertInput = Omit<SettlementDetail, 'id'>

export interface SettlementSavePayload {
  settlementId?: number
  settlement: SettlementUpsertInput
  details: SettlementDetailUpsertInput[]
}

export interface SettlementSaveResult {
  settlement: Settlement
  details: SettlementDetail[]
}

const SETTLEMENT_NO_CONFLICT_MESSAGE = '结算单号已存在'

function mapSettlement(row: Record<string, unknown>): Settlement {
  let contractIds: number[] = []
  try { contractIds = JSON.parse(getRowString(row, 'contract_ids', '[]')) } catch { contractIds = [] }
  return {
    id: getRowNumber(row, 'id'),
    projectId: getRowNumber(row, 'project_id'),
    contractIds,
    settlementNo: getRowString(row, 'settlement_no'),
    settlementType: getRowString(row, 'settlement_type') as Settlement['settlementType'],
    startDate: getRowString(row, 'start_date'),
    endDate: getRowString(row, 'end_date'),
    previousCumulative: getRowNumber(row, 'previous_cumulative'),
    currentAmount: getRowNumber(row, 'current_amount'),
    currentCumulative: getRowNumber(row, 'current_cumulative'),
    materialAdjustment: getRowNumber(row, 'material_adjustment'),
    changeAmount: getRowNumber(row, 'change_amount'),
    deductionAmount: getRowNumber(row, 'deduction_amount'),
    surchargeAmount: getRowNumber(row, 'surcharge_amount'),
    changeRemark: getRowString(row, 'change_remark'),
    materialRemark: getRowString(row, 'material_remark'),
    surchargeRemark: getRowString(row, 'surcharge_remark'),
    deductionRemark: getRowString(row, 'deduction_remark'),
    remark: getRowString(row, 'remark'),
    status: getRowString(row, 'status') as Settlement['status'],
    createdAt: getRowString(row, 'created_at'),
  }
}

function mapSettlementDetail(row: Record<string, unknown>): SettlementDetail {
  return {
    id: getRowNumber(row, 'id'),
    settlementId: getRowNumber(row, 'settlement_id'),
    boqId: getRowNumber(row, 'boq_id'),
    contractId: getRowNumber(row, 'resolved_contract_id', getRowNumber(row, 'contract_id')),
    contractQuantity: getRowNumber(row, 'resolved_contract_quantity', getRowNumber(row, 'contract_quantity')),
    previousCumulative: getRowNumber(row, 'previous_cumulative'),
    currentQuantity: getRowNumber(row, 'current_quantity'),
    currentCumulative: getRowNumber(row, 'current_cumulative'),
    unitPrice: getRowNumber(row, 'resolved_unit_price', getRowNumber(row, 'unit_price')),
    currentAmount: getRowNumber(row, 'resolved_current_amount', getRowNumber(row, 'current_amount')),
    itemCode: getRowString(row, 'resolved_item_code', getRowString(row, 'item_code')),
    itemName: getRowString(row, 'resolved_item_name', getRowString(row, 'item_name')),
    remark: getRowString(row, 'resolved_remark', getRowString(row, 'remark')),
    unit: getRowString(row, 'resolved_unit', getRowString(row, 'unit')),
    note: getRowString(row, 'resolved_note', getRowString(row, 'note')),
  }
}

function mapStoredSettlementDetail(row: Record<string, unknown>): SettlementDetail {
  return {
    id: getRowNumber(row, 'id'),
    settlementId: getRowNumber(row, 'settlement_id'),
    boqId: getRowNumber(row, 'boq_id'),
    contractId: getRowNumber(row, 'contract_id'),
    contractQuantity: getRowNumber(row, 'contract_quantity'),
    previousCumulative: getRowNumber(row, 'previous_cumulative'),
    currentQuantity: getRowNumber(row, 'current_quantity'),
    currentCumulative: getRowNumber(row, 'current_cumulative'),
    unitPrice: getRowNumber(row, 'unit_price'),
    currentAmount: getRowNumber(row, 'current_amount'),
    itemCode: getRowString(row, 'item_code'),
    itemName: getRowString(row, 'item_name'),
    remark: getRowString(row, 'remark'),
    unit: getRowString(row, 'unit'),
    note: getRowString(row, 'note'),
  }
}

function assertDb(): DatabaseHandle {
  const db = getDb()
  if (!db) throw new Error('Database not initialized')
  return db
}

function hasSettlementNoConflict(
  db: DatabaseHandle,
  settlementNo: string,
  excludeSettlementId?: number,
): boolean {
  const rows = excludeSettlementId === undefined
    ? db.exec('SELECT 1 FROM settlements WHERE settlement_no = ? LIMIT 1', [settlementNo])
    : db.exec('SELECT 1 FROM settlements WHERE settlement_no = ? AND id <> ? LIMIT 1', [settlementNo, excludeSettlementId])

  return rows.length > 0
}

function insertSettlementRow(db: DatabaseHandle, data: SettlementUpsertInput): number {
  const contractIdsJson = JSON.stringify(data.contractIds || [])
  if (hasSettlementNoConflict(db, data.settlementNo)) {
    throw new Error(SETTLEMENT_NO_CONFLICT_MESSAGE)
  }
  db.run(
    `INSERT INTO settlements (project_id, contract_ids, settlement_no, settlement_type, start_date, end_date, previous_cumulative, current_amount, current_cumulative, material_adjustment, change_amount, deduction_amount, surcharge_amount, change_remark, material_remark, surcharge_remark, deduction_remark, remark, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.projectId,
      contractIdsJson,
      data.settlementNo,
      data.settlementType,
      data.startDate,
      data.endDate,
      data.previousCumulative,
      data.currentAmount,
      data.currentCumulative,
      data.materialAdjustment,
      data.changeAmount,
      data.deductionAmount,
      data.surchargeAmount,
      data.changeRemark,
      data.materialRemark,
      data.surchargeRemark,
      data.deductionRemark,
      data.remark,
      data.status,
    ],
  )
  return getLastInsertId()
}

function updateSettlementRow(db: DatabaseHandle, id: number, data: Partial<Settlement>): void {
  const fields: string[] = []
  const values: unknown[] = []
  if (data.settlementNo !== undefined && hasSettlementNoConflict(db, data.settlementNo, id)) {
    throw new Error(SETTLEMENT_NO_CONFLICT_MESSAGE)
  }

  const fieldMap: Record<string, string> = {
    projectId: 'project_id', contractIds: 'contract_ids', settlementNo: 'settlement_no', settlementType: 'settlement_type',
    startDate: 'start_date', endDate: 'end_date', previousCumulative: 'previous_cumulative',
    currentAmount: 'current_amount', currentCumulative: 'current_cumulative',
    materialAdjustment: 'material_adjustment', changeAmount: 'change_amount',
    deductionAmount: 'deduction_amount', surchargeAmount: 'surcharge_amount',
    changeRemark: 'change_remark', materialRemark: 'material_remark',
    surchargeRemark: 'surcharge_remark', deductionRemark: 'deduction_remark',
    remark: 'remark', status: 'status',
  }

  for (const [key, col] of Object.entries(fieldMap)) {
    if (data[key as keyof Settlement] !== undefined) {
      fields.push(`${col} = ?`)
      if (key === 'contractIds') {
        values.push(JSON.stringify(data.contractIds))
      } else {
        values.push(data[key as keyof Settlement])
      }
    }
  }

  if (fields.length === 0) return
  values.push(id)
  db.run(`UPDATE settlements SET ${fields.join(', ')} WHERE id = ?`, values)
}

function insertSettlementDetailRows(db: DatabaseHandle, items: SettlementDetailUpsertInput[]): void {
  for (const item of items) {
    db.run(
      `INSERT INTO settlement_details (settlement_id, boq_id, contract_id, item_code, item_name, remark, unit, contract_quantity, previous_cumulative, current_quantity, current_cumulative, unit_price, current_amount, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.settlementId,
        item.boqId,
        item.contractId || 0,
        item.itemCode || '',
        item.itemName || '',
        item.remark || '',
        item.unit || '',
        item.contractQuantity,
        item.previousCumulative,
        item.currentQuantity,
        item.currentCumulative,
        item.unitPrice,
        item.currentAmount,
        item.note || '',
      ],
    )
  }
}

function assertSettlementStatusCanPersistWithoutDetails(
  status: Settlement['status'],
  detailCount: number,
): void {
  if (detailCount > 0) return
  if (status === 'draft') return

  throw new Error('已确认或已审批的结算单必须至少包含一条结算明细。')
}

async function persistAndRecalculateProjectChains(projectIds: Iterable<number>): Promise<void> {
  await saveToStorage()
  const uniqueProjectIds = Array.from(new Set(Array.from(projectIds).filter(id => id > 0)))
  for (const projectId of uniqueProjectIds) {
    await settlementService.recalculateProjectChain(projectId)
  }
}

// ==================== 结算保存与重算辅助 ====================
export const settlementService = {
  async getAll(): Promise<Settlement[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec('SELECT * FROM settlements ORDER BY created_at DESC')
    return execToObjects(result).map(row => mapSettlement(row))
  },

  async getByProjectId(projectId: number): Promise<Settlement[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      'SELECT * FROM settlements WHERE project_id = ? ORDER BY start_date',
      [projectId]
    )
    return execToObjects(result).map(row => mapSettlement(row))
  },

  async getById(id: number): Promise<Settlement | null> {
    const db = getDb()
    if (!db) return null
    const stmt = db.prepare('SELECT * FROM settlements WHERE id = ?')
    stmt.bind([id])
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()
      return mapSettlement(row)
    }
    stmt.free()
    return null
  },

  async create(data: Omit<Settlement, 'id' | 'createdAt'>): Promise<Settlement> {
    try {
    const db = assertDb()
    const id = insertSettlementRow(db, data)
    await saveToStorage()
    return { ...data, id, createdAt: new Date().toISOString() }
    } catch (error) {
      throw normalizeUniqueConstraintError(error, SETTLEMENT_NO_CONFLICT_MESSAGE)
    }
  },

  async update(id: number, data: Partial<Settlement>): Promise<void> {
    try {
    const db = assertDb()
    updateSettlementRow(db, id, data)
    await saveToStorage()
    } catch (error) {
      throw normalizeUniqueConstraintError(error, SETTLEMENT_NO_CONFLICT_MESSAGE)
    }
  },

  async updateStatus(id: number, status: Settlement['status']): Promise<Settlement | null> {
    const db = assertDb()
    const settlement = await settlementService.getById(id)
    if (!settlement) return null

    const details = await settlementDetailService.getStoredBySettlementId(id)
    assertSettlementStatusCanPersistWithoutDetails(status, details.length)

    updateSettlementRow(db, id, { status })
    await persistAndRecalculateProjectChains([settlement.projectId])
    return settlementService.getById(id)
  },

  async delete(id: number): Promise<void> {
    const db = assertDb()
    const settlement = await settlementService.getById(id)

    await withTransaction(async () => {
      db.run('DELETE FROM settlement_details WHERE settlement_id = ?', [id])
      db.run('DELETE FROM settlement_attachments WHERE settlement_id = ?', [id])
      db.run('DELETE FROM settlements WHERE id = ?', [id])
    })

    await saveToStorage()

    if (settlement) {
      await settlementService.recalculateProjectChain(settlement.projectId)
    }
  },

  async saveWithDetails(payload: SettlementSavePayload): Promise<SettlementSaveResult> {
    const db = assertDb()
    assertSettlementStatusCanPersistWithoutDetails(payload.settlement.status, payload.details.length)

    const existingSettlement = payload.settlementId ? await settlementService.getById(payload.settlementId) : null
    if (payload.settlementId && !existingSettlement) {
      throw new Error('结算单不存在')
    }

    await validateSettlementSavePayload(db, payload, existingSettlement, {
      getSettlementsByProjectId: settlementService.getByProjectId,
      getStoredDetailsBySettlementId: settlementDetailService.getStoredBySettlementId,
    })

    const affectedProjectIds = new Set<number>([
      payload.settlement.projectId,
      ...(existingSettlement ? [existingSettlement.projectId] : []),
    ])

    let settlementId = payload.settlementId ?? 0

    await withTransaction(async () => {
      if (settlementId > 0) {
        updateSettlementRow(db, settlementId, payload.settlement)
        db.run('DELETE FROM settlement_details WHERE settlement_id = ?', [settlementId])
      } else {
        settlementId = insertSettlementRow(db, payload.settlement)
      }
      insertSettlementDetailRows(
        db,
        payload.details.map(detail => ({
          ...detail,
          settlementId,
        })),
      )

      // 同步更新清单备注
      for (const detail of payload.details) {
        if (detail.boqId > 0 && detail.note !== undefined) {
          db.run(
            'UPDATE bill_of_quantities SET note = ? WHERE id = ?',
            [detail.note || '', detail.boqId],
          )
        }
      }
    })

    await persistAndRecalculateProjectChains(affectedProjectIds)

    const settlement = await settlementService.getById(settlementId)
    if (!settlement) {
      throw new Error('结算单保存后读取失败')
    }

    return {
      settlement,
      details: await settlementDetailService.getBySettlementId(settlementId),
    }
  },

  async recalculateProjectChain(projectId: number): Promise<void> {
    const db = assertDb()

    const settlements = await settlementService.getByProjectId(projectId)
    if (settlements.length === 0) return

    const detailMap = new Map<number, SettlementDetail[]>()
    for (const settlement of settlements) {
      detailMap.set(settlement.id, await settlementDetailService.getBySettlementId(settlement.id))
    }

    const normalized = normalizeSettlementChain(settlements, detailMap)

    await withTransaction(async () => {
      for (const settlement of normalized.settlements) {
        db.run(
          `UPDATE settlements
           SET previous_cumulative = ?, current_amount = ?, current_cumulative = ?
           WHERE id = ?`,
          [settlement.previousCumulative, settlement.currentAmount, settlement.currentCumulative, settlement.id]
        )
      }

      for (const [settlementId, details] of normalized.details.entries()) {
        for (const detail of details) {
          db.run(
            `UPDATE settlement_details
             SET previous_cumulative = ?, current_quantity = ?, current_cumulative = ?, current_amount = ?
             WHERE id = ? AND settlement_id = ?`,
            [
              detail.previousCumulative,
              detail.currentQuantity,
              detail.currentCumulative,
              detail.currentAmount,
              detail.id,
              settlementId,
            ],
          )
        }
      }

    })

    await saveToStorage()
  },

  async refreshProjectChainByContractBoq(projectId: number, contractId: number): Promise<void> {
    const db = assertDb()

    const liveBoqRows = execToObjects(db.exec(
      `SELECT id, contract_id, item_code, item_name, remark, unit, quantity, unit_price
       FROM bill_of_quantities
       WHERE contract_id = ?
      ORDER BY sort_order, id`,
      [contractId],
    ))
    const liveBoqMap = buildSettlementChainBoqMap(liveBoqRows)

    const settlements = await settlementService.getByProjectId(projectId)
    if (settlements.length === 0) return

    const syncedDetailsBySettlementId = new Map<number, SettlementDetail[]>()
    for (const settlement of settlements) {
      const details = await settlementDetailService.getStoredBySettlementId(settlement.id)
      syncedDetailsBySettlementId.set(settlement.id, syncSettlementDetailsWithBoq(details, liveBoqMap))
    }

    await withTransaction(async () => {
      for (const [settlementId, syncedDetails] of syncedDetailsBySettlementId.entries()) {
        for (const detail of syncedDetails) {
          if (!liveBoqMap.has(detail.boqId)) continue

          db.run(
            `UPDATE settlement_details
             SET contract_id = ?, item_code = ?, item_name = ?, remark = ?, unit = ?, contract_quantity = ?, unit_price = ?, current_amount = ?
             WHERE id = ?`,
            [
              detail.contractId,
              detail.itemCode || '',
              detail.itemName || '',
              detail.remark || '',
              detail.unit || '',
              detail.contractQuantity,
              detail.unitPrice,
              detail.currentAmount,
              detail.id,
            ],
          )
        }
      }

    })

    await persistAndRecalculateProjectChains([projectId])
  }
}

// ==================== 结算明细服务 ====================
export const settlementDetailService = {
  async getBySettlementId(settlementId: number): Promise<SettlementDetail[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      `SELECT sd.*,
              COALESCE(bq.contract_id, sd.contract_id, 0) AS resolved_contract_id,
              COALESCE(NULLIF(bq.item_code, ''), NULLIF(sd.item_code, ''), '') AS resolved_item_code,
              COALESCE(NULLIF(bq.item_name, ''), NULLIF(sd.item_name, ''), '') AS resolved_item_name,
              COALESCE(NULLIF(bq.remark, ''), NULLIF(sd.remark, ''), '') AS resolved_remark,
              COALESCE(NULLIF(bq.unit, ''), NULLIF(sd.unit, ''), '') AS resolved_unit,
              COALESCE(bq.note, sd.note, '') AS resolved_note,
              COALESCE(bq.quantity, sd.contract_quantity, 0) AS resolved_contract_quantity,
              COALESCE(bq.unit_price, sd.unit_price, 0) AS resolved_unit_price,
              ROUND(sd.current_quantity * COALESCE(bq.unit_price, sd.unit_price, 0), 3) AS resolved_current_amount
       FROM settlement_details sd
       LEFT JOIN bill_of_quantities bq ON sd.boq_id = bq.id
       WHERE sd.settlement_id = ?
       ORDER BY bq.sort_order, sd.id`,
      [settlementId]
    )
    return execToObjects(result).map(row => mapSettlementDetail(row))
  },

  async getStoredBySettlementId(settlementId: number): Promise<SettlementDetail[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      `SELECT id, settlement_id, boq_id, contract_id, item_code, item_name, remark, unit,
              contract_quantity, previous_cumulative, current_quantity, current_cumulative, unit_price, current_amount
       FROM settlement_details
       WHERE settlement_id = ?
       ORDER BY id`,
      [settlementId],
    )
    return execToObjects(result).map(row => mapStoredSettlementDetail(row))
  },

  async createBatch(items: Omit<SettlementDetail, 'id'>[]): Promise<void> {
    const db = assertDb()
    await withTransaction(async () => {
      insertSettlementDetailRows(db, items)
    })
    await saveToStorage()
  },

  async deleteBySettlementId(settlementId: number): Promise<void> {
    const db = assertDb()
    const settlement = await settlementService.getById(settlementId)

    await withTransaction(async () => {
      db.run('DELETE FROM settlement_details WHERE settlement_id = ?', [settlementId])
    })

    await persistAndRecalculateProjectChains(settlement ? [settlement.projectId] : [])
  }
}
