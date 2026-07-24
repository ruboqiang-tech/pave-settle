import type { Database } from 'sql.js'
import type { Settlement, SettlementDetail } from '@/types'
import { execToObjects, getRowNumber } from './db-core'
import { normalizeSettlementChain } from './settlement-chain'

export interface SettlementValidationPayload {
  settlementId?: number
  settlement: Omit<Settlement, 'id' | 'createdAt'>
  details: Array<Omit<SettlementDetail, 'id'>>
}

export interface SettlementValidationDeps {
  getSettlementsByProjectId: (projectId: number) => Promise<Settlement[]>
  getStoredDetailsBySettlementId: (settlementId: number) => Promise<SettlementDetail[]>
}

interface BoqValidationSnapshot {
  contractId: number
  quantity: number
}

function buildSqlPlaceholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

function normalizeContractIds(contractIds: number[]): number[] {
  return Array.from(new Set(
    (contractIds || []).filter(contractId => Number.isFinite(contractId) && contractId > 0),
  ))
}

function projectExists(db: Database, projectId: number): boolean {
  return execToObjects(db.exec('SELECT id FROM projects WHERE id = ? LIMIT 1', [projectId])).length > 0
}

function loadProjectContractIds(
  db: Database,
  projectId: number,
  contractIds: number[],
): Set<number> {
  if (contractIds.length === 0) return new Set<number>()

  const rows = execToObjects(db.exec(
    `SELECT id FROM contracts WHERE project_id = ? AND id IN (${buildSqlPlaceholders(contractIds.length)})`,
    [projectId, ...contractIds],
  ))

  return new Set(rows.map(row => getRowNumber(row, 'id')).filter(id => id > 0))
}

function loadBoqValidationMap(
  db: Database,
  boqIds: number[],
): Map<number, BoqValidationSnapshot> {
  if (boqIds.length === 0) return new Map<number, BoqValidationSnapshot>()

  const rows = execToObjects(db.exec(
    `SELECT id, contract_id, quantity FROM bill_of_quantities WHERE id IN (${buildSqlPlaceholders(boqIds.length)})`,
    boqIds,
  ))

  return new Map(
    rows.map(row => [
      getRowNumber(row, 'id'),
      {
        contractId: getRowNumber(row, 'contract_id'),
        quantity: getRowNumber(row, 'quantity'),
      },
    ]),
  )
}

function buildDraftSettlementForValidation(
  payload: SettlementValidationPayload,
  settlementId: number,
  createdAt: string,
): Settlement {
  return {
    id: settlementId,
    projectId: payload.settlement.projectId,
    contractIds: [...payload.settlement.contractIds],
    settlementNo: payload.settlement.settlementNo,
    settlementType: payload.settlement.settlementType,
    startDate: payload.settlement.startDate,
    endDate: payload.settlement.endDate,
    previousCumulative: payload.settlement.previousCumulative,
    currentAmount: payload.settlement.currentAmount,
    currentCumulative: payload.settlement.currentCumulative,
    materialAdjustment: payload.settlement.materialAdjustment,
    changeAmount: payload.settlement.changeAmount,
    deductionAmount: payload.settlement.deductionAmount,
    surchargeAmount: payload.settlement.surchargeAmount,
    changeRemark: payload.settlement.changeRemark,
    materialRemark: payload.settlement.materialRemark,
    surchargeRemark: payload.settlement.surchargeRemark,
    deductionRemark: payload.settlement.deductionRemark,
    remark: payload.settlement.remark,
    status: payload.settlement.status,
    createdAt,
  }
}

async function validateSettlementDetailBoundaries(
  payload: SettlementValidationPayload,
  existingSettlement: Settlement | null,
  deps: SettlementValidationDeps,
): Promise<void> {
  const validationSettlementId = payload.settlementId ?? Number.MAX_SAFE_INTEGER
  const validationCreatedAt = existingSettlement?.createdAt || new Date().toISOString()
  const projectSettlements = await deps.getSettlementsByProjectId(payload.settlement.projectId)
  const settlementsForValidation = [
    ...projectSettlements.filter(settlement => settlement.id !== validationSettlementId),
    buildDraftSettlementForValidation(payload, validationSettlementId, validationCreatedAt),
  ]

  const detailMap = new Map<number, SettlementDetail[]>()
  for (const settlement of projectSettlements) {
    if (settlement.id === validationSettlementId) continue
    detailMap.set(settlement.id, await deps.getStoredDetailsBySettlementId(settlement.id))
  }
  detailMap.set(validationSettlementId, payload.details.map(detail => ({ ...detail, id: 0 })))

  const normalized = normalizeSettlementChain(settlementsForValidation, detailMap)
  const normalizedCurrentDetails = normalized.details.get(validationSettlementId) ?? []

  for (const detail of normalizedCurrentDetails) {
    if (detail.currentQuantity < 0) {
      throw new Error('结算明细本期工程量不能小于 0')
    }

    if (detail.currentCumulative < 0) {
      throw new Error('结算明细累计工程量不能小于 0')
    }
  }
}

export async function validateSettlementSavePayload(
  db: Database,
  payload: SettlementValidationPayload,
  existingSettlement: Settlement | null,
  deps: SettlementValidationDeps,
): Promise<void> {
  const projectId = Number(payload.settlement.projectId || 0)
  if (projectId <= 0) {
    throw new Error('请选择有效项目')
  }

  if (!projectExists(db, projectId)) {
    throw new Error('所选项目不存在或已删除')
  }

  const contractIds = normalizeContractIds(payload.settlement.contractIds)
  payload.settlement.contractIds = contractIds
  if (payload.details.length > 0 && contractIds.length === 0) {
    throw new Error('结算单至少需要选择一个合同')
  }

  const allowedContractIds = loadProjectContractIds(db, projectId, contractIds)
  if (allowedContractIds.size !== contractIds.length) {
    throw new Error('所选合同不存在、已删除，或不属于当前项目')
  }

  const boqIds = Array.from(new Set(
    payload.details.map(detail => Number(detail.boqId || 0)).filter(boqId => boqId > 0),
  ))
  if (payload.details.length > 0 && boqIds.length !== payload.details.length) {
    throw new Error('结算明细必须关联有效清单项')
  }

  const boqValidationMap = loadBoqValidationMap(db, boqIds)
  for (const detail of payload.details) {
    if (Number(detail.contractQuantity || 0) < 0) {
      throw new Error('结算明细合同工程量不能小于 0')
    }

    if (Number(detail.currentQuantity || 0) < 0) {
      throw new Error('结算明细本期工程量不能小于 0')
    }

    if (Number(detail.unitPrice || 0) < 0) {
      throw new Error('结算明细单价不能小于 0')
    }

    const boqId = Number(detail.boqId || 0)
    const boqSnapshot = boqValidationMap.get(boqId)
    const resolvedContractId = boqSnapshot?.contractId

    if (!resolvedContractId) {
      throw new Error('结算明细包含不存在或已删除的清单项')
    }

    if (!allowedContractIds.has(resolvedContractId)) {
      throw new Error('结算明细存在不属于当前结算合同的清单项')
    }

    if (Number(detail.contractId || 0) !== resolvedContractId) {
      throw new Error('结算明细合同与清单归属不一致')
    }

    detail.contractQuantity = boqSnapshot?.quantity ?? detail.contractQuantity
  }

  await validateSettlementDetailBoundaries(payload, existingSettlement, deps)
}
