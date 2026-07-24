import type { BillOfQuantities, Contract } from '@/types'
import { summarizeBoqAmounts } from '@/utils/boq'
import { roundTo } from '@/utils/calculations'
import { execToObjects, getDb, getLastInsertId, getRowNumber, getRowString, saveToStorage, withTransaction } from './db-core'

import { settlementService } from './settlement.service'
import { normalizeUniqueConstraintError } from './unique-constraint'


type DatabaseHandle = NonNullable<ReturnType<typeof getDb>>
type BoqSaveInput = Array<Partial<BillOfQuantities> & { contractId: number }>

const CONTRACT_NO_CONFLICT_MESSAGE = '合同编号已存在'

function mapContract(row: Record<string, unknown>): Contract {
  return {
    id: getRowNumber(row, 'id'),
    projectId: getRowNumber(row, 'project_id'),
    contractNo: getRowString(row, 'contract_no'),
    contractName: getRowString(row, 'contract_name'),
    contractDate: getRowString(row, 'contract_date'),
    noTaxAmount: getRowNumber(row, 'no_tax_amount'),
    contractTaxRate: getRowNumber(row, 'contract_tax_rate'),
    taxAmount: getRowNumber(row, 'tax_amount'),
    contractAmount: getRowNumber(row, 'contract_amount'),
    amountSource: getRowString(row, 'amount_source', 'manual') as Contract['amountSource'],
    summary: getRowString(row, 'summary'),
  }
}

function mapBOQ(row: Record<string, unknown>): BillOfQuantities {
  return {
    id: getRowNumber(row, 'id'),
    contractId: getRowNumber(row, 'contract_id'),
    itemCode: getRowString(row, 'item_code'),
    itemName: getRowString(row, 'item_name'),
    remark: getRowString(row, 'remark'),
    note: getRowString(row, 'note'),
    unit: getRowString(row, 'unit'),
    quantity: getRowNumber(row, 'quantity'),
    taxRate: getRowNumber(row, 'tax_rate'),
    noTaxUnitPrice: getRowNumber(row, 'no_tax_unit_price'),
    unitPrice: getRowNumber(row, 'unit_price'),
    noTaxTotalPrice: getRowNumber(row, 'no_tax_total_price'),
    taxAmount: getRowNumber(row, 'tax_amount'),
    totalPrice: getRowNumber(row, 'total_price'),
    category: getRowString(row, 'category'),
    chapterCode: getRowString(row, 'chapter_code'),
    sortOrder: getRowNumber(row, 'sort_order'),
  }
}

function hasContractNoConflict(
  db: DatabaseHandle,
  contractNo: string,
  excludeContractId?: number,
): boolean {
  const rows = excludeContractId === undefined
    ? db.exec('SELECT 1 FROM contracts WHERE contract_no = ? LIMIT 1', [contractNo])
    : db.exec('SELECT 1 FROM contracts WHERE contract_no = ? AND id <> ? LIMIT 1', [contractNo, excludeContractId])

  return rows.length > 0
}

function summarizeLabels(values: string[], maxCount: number, unitLabel: string): string {
  const uniqueValues = Array.from(new Set(values.map(value => value.trim()).filter(Boolean)))
  if (uniqueValues.length === 0) return ''

  const visibleValues = uniqueValues.slice(0, maxCount)
  if (uniqueValues.length <= maxCount) {
    return visibleValues.join('、')
  }

  return visibleValues.join('、') + ' 等 ' + uniqueValues.length + unitLabel
}

async function listLinkedSettlementNosByContract(
  projectId: number,
  contractId: number,
  boqIds: number[] = [],
): Promise<string[]> {
  const db = getDb()
  if (!db) return []

  const linkedSettlementIdSet = new Set<number>()
  const projectSettlements = await settlementService.getByProjectId(projectId)
  for (const settlement of projectSettlements) {
    if ((settlement.contractIds || []).includes(contractId)) {
      linkedSettlementIdSet.add(settlement.id)
    }
  }

  const queryValues = [contractId, ...boqIds]
  let detailSql = 'SELECT DISTINCT settlement_id FROM settlement_details WHERE contract_id = ?'
  if (boqIds.length > 0) {
    detailSql += ` OR boq_id IN (${boqIds.map(() => '?').join(', ')})`
  }

  const detailRows = execToObjects(db.exec(detailSql, queryValues))
  for (const row of detailRows) {
    linkedSettlementIdSet.add(Number(row.settlement_id || 0))
  }

  return projectSettlements
    .filter(settlement => linkedSettlementIdSet.has(settlement.id))
    .map(settlement => settlement.settlementNo)
}

function getBoqRowsByContractId(db: DatabaseHandle, contractId: number): BillOfQuantities[] {
  const result = db.exec(
    'SELECT * FROM bill_of_quantities WHERE contract_id = ? ORDER BY sort_order, id',
    [contractId],
  )
  return execToObjects(result).map(row => mapBOQ(row))
}

function calculateContractTaxRate(noTaxAmount: number, taxAmount: number): number {
  if (noTaxAmount === 0) return 0
  return roundTo((taxAmount / noTaxAmount) * 100, 2)
}

function updateContractAmounts(db: DatabaseHandle, contractId: number, items: BillOfQuantities[]): void {
  const summary = summarizeBoqAmounts(items)
  const contractTaxRate = calculateContractTaxRate(summary.noTax, summary.tax)

  db.run(
    `UPDATE contracts
     SET no_tax_amount = ?, contract_tax_rate = ?, tax_amount = ?, contract_amount = ?, amount_source = ?
     WHERE id = ?`,
    [summary.noTax, contractTaxRate, summary.tax, summary.total, 'auto', contractId],
  )
}

async function upsertBoqRows(db: DatabaseHandle, contractId: number, items: BoqSaveInput): Promise<void> {
  const currentRows = getBoqRowsByContractId(db, contractId)
  const currentRowMap = new Map(currentRows.map(row => [row.id, row]))
  const retainedIds = new Set<number>()

  for (let index = 0; index < items.length; index += 1) {
    const input = items[index]
    const providedId = Number(input.id ?? 0)
    const existingRow = providedId > 0 ? currentRowMap.get(providedId) : undefined

    const rowData = existingRow
      ? {
          ...existingRow,
          ...input,
          contractId,
          sortOrder: Number(input.sortOrder ?? existingRow.sortOrder ?? index + 1),
        }
      : {
          contractId,
          itemCode: String(input.itemCode ?? ''),
          itemName: String(input.itemName ?? ''),
          remark: String(input.remark ?? ''),
          note: String(input.note ?? ''),
          unit: String(input.unit ?? ''),
          quantity: Number(input.quantity ?? 0),
          taxRate: Number(input.taxRate ?? 0),
          noTaxUnitPrice: Number(input.noTaxUnitPrice ?? 0),
          unitPrice: Number(input.unitPrice ?? 0),
          noTaxTotalPrice: Number(input.noTaxTotalPrice ?? 0),
          taxAmount: Number(input.taxAmount ?? 0),
          totalPrice: Number(input.totalPrice ?? 0),
          category: String(input.category ?? ''),
          chapterCode: String(input.chapterCode ?? ''),
          sortOrder: Number(input.sortOrder ?? index + 1),
        }

    const effectiveItem = {
      ...rowData,
      itemCode: String(rowData.itemCode ?? ''),
      itemName: String(rowData.itemName ?? ''),
      remark: String(rowData.remark ?? ''),
      note: String(rowData.note ?? ''),
      unit: String(rowData.unit ?? ''),
      quantity: Number(rowData.quantity ?? 0),
      taxRate: Number(rowData.taxRate ?? 0),
      noTaxUnitPrice: Number(rowData.noTaxUnitPrice ?? 0),
      unitPrice: Number(rowData.unitPrice ?? 0),
      noTaxTotalPrice: Number(rowData.noTaxTotalPrice ?? 0),
      taxAmount: Number(rowData.taxAmount ?? 0),
      totalPrice: Number(rowData.totalPrice ?? 0),
      category: String(rowData.category ?? ''),
      chapterCode: String(rowData.chapterCode ?? ''),
      sortOrder: Number(rowData.sortOrder ?? index + 1),
    }

    if (providedId > 0 && existingRow) {
      db.run(
        `UPDATE bill_of_quantities
         SET item_code = ?, item_name = ?, remark = ?, note = ?, unit = ?, quantity = ?, tax_rate = ?, no_tax_unit_price = ?, unit_price = ?, no_tax_total_price = ?, tax_amount = ?, total_price = ?, category = ?, chapter_code = ?, sort_order = ?
         WHERE id = ? AND contract_id = ?`,
        [
          effectiveItem.itemCode,
          effectiveItem.itemName,
          effectiveItem.remark,
          effectiveItem.note,
          effectiveItem.unit,
          effectiveItem.quantity,
          effectiveItem.taxRate,
          effectiveItem.noTaxUnitPrice,
          effectiveItem.unitPrice,
          effectiveItem.noTaxTotalPrice,
          effectiveItem.taxAmount,
          effectiveItem.totalPrice,
          effectiveItem.category,
          effectiveItem.chapterCode,
          effectiveItem.sortOrder,
          providedId,
          contractId,
        ],
      )
      retainedIds.add(providedId)
      continue
    }

    db.run(
      `INSERT INTO bill_of_quantities (contract_id, item_code, item_name, remark, note, unit, quantity, tax_rate, no_tax_unit_price, unit_price, no_tax_total_price, tax_amount, total_price, category, chapter_code, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        contractId,
        effectiveItem.itemCode,
        effectiveItem.itemName,
        effectiveItem.remark,
        effectiveItem.note,
        effectiveItem.unit,
        effectiveItem.quantity,
        effectiveItem.taxRate,
        effectiveItem.noTaxUnitPrice,
        effectiveItem.unitPrice,
        effectiveItem.noTaxTotalPrice,
        effectiveItem.taxAmount,
        effectiveItem.totalPrice,
        effectiveItem.category,
        effectiveItem.chapterCode,
        effectiveItem.sortOrder,
      ],
    )
  }

  for (const row of currentRows) {
    if (retainedIds.has(row.id)) continue

    db.run('DELETE FROM bill_of_quantities WHERE id = ? AND contract_id = ?', [row.id, contractId])
  }
}

export interface BoqSaveResult {
  items: BillOfQuantities[]
}

export const contractService = {
  async getAll(): Promise<Contract[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec('SELECT * FROM contracts ORDER BY contract_date DESC')
    return execToObjects(result).map(row => mapContract(row))
  },

  async getAllByProjectId(projectId: number): Promise<Contract[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      'SELECT * FROM contracts WHERE project_id = ? ORDER BY contract_date DESC, id DESC',
      [projectId],
    )
    return execToObjects(result).map(row => mapContract(row))
  },

  async create(data: Omit<Contract, 'id'>): Promise<Contract> {
    try {
      const db = getDb()
      if (!db) throw new Error('Database not initialized')

      if (hasContractNoConflict(db, data.contractNo)) {
        throw new Error(CONTRACT_NO_CONFLICT_MESSAGE)
      }

      db.run(
        `INSERT INTO contracts (project_id, contract_no, contract_name, contract_date, no_tax_amount, contract_tax_rate, tax_amount, contract_amount, amount_source, summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.projectId,
          data.contractNo,
          data.contractName,
          data.contractDate,
          data.noTaxAmount,
          data.contractTaxRate,
          data.taxAmount,
          data.contractAmount,
          data.amountSource || 'manual',
          data.summary,
        ],
      )

      const id = getLastInsertId()
      await saveToStorage()
      return { ...data, id }
    } catch (error) {
      throw normalizeUniqueConstraintError(error, CONTRACT_NO_CONFLICT_MESSAGE)
    }
  },

  async update(id: number, data: Partial<Contract>): Promise<void> {
    try {
      const db = getDb()
      if (!db) throw new Error('Database not initialized')

      if (data.contractNo !== undefined && hasContractNoConflict(db, data.contractNo, id)) {
        throw new Error(CONTRACT_NO_CONFLICT_MESSAGE)
      }

      const fields: string[] = []
      const values: unknown[] = []
      const fieldMap: Record<string, string> = {
        projectId: 'project_id',
        contractNo: 'contract_no',
        contractName: 'contract_name',
        contractDate: 'contract_date',
        noTaxAmount: 'no_tax_amount',
        contractTaxRate: 'contract_tax_rate',
        taxAmount: 'tax_amount',
        contractAmount: 'contract_amount',
        amountSource: 'amount_source',
        summary: 'summary',
      }

      for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key as keyof Contract] !== undefined) {
          fields.push(`${col} = ?`)
          values.push(data[key as keyof Contract])
        }
      }

      if (fields.length === 0) return
      values.push(id)
      db.run(`UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`, values)
      await saveToStorage()
    } catch (error) {
      throw normalizeUniqueConstraintError(error, CONTRACT_NO_CONFLICT_MESSAGE)
    }
  },

  async delete(id: number): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')

    const contract = await contractService.getById(id)
    if (!contract) return

    const existingBoqs = await boqService.getByContractId(id)
    const linkedSettlementNos = await listLinkedSettlementNosByContract(
      contract.projectId,
      id,
      existingBoqs.map(item => item.id),
    )

    if (linkedSettlementNos.length > 0) {
      const settlementSummary = summarizeLabels(linkedSettlementNos, 3, '张结算单')
      throw new Error('当前合同已被结算单' + settlementSummary + '引用，请先处理相关结算记录后再删除合同。')
    }

    await withTransaction(async transactionDb => {

      transactionDb.run('DELETE FROM bill_of_quantities WHERE contract_id = ?', [id])
      transactionDb.run('DELETE FROM contract_attachments WHERE contract_id = ?', [id])
      transactionDb.run('DELETE FROM contracts WHERE id = ?', [id])
    })

    await saveToStorage()
    await settlementService.recalculateProjectChain(contract.projectId)

  },


  async getById(id: number): Promise<Contract | null> {
    const db = getDb()
    if (!db) return null
    const stmt = db.prepare('SELECT * FROM contracts WHERE id = ?')
    stmt.bind([id])
    try {
      if (!stmt.step()) return null
      return mapContract(stmt.getAsObject())
    } finally {
      stmt.free()
    }
  },
}

export const boqService = {
  async getByContractId(contractId: number): Promise<BillOfQuantities[]> {
    const db = getDb()
    if (!db) return []
    return getBoqRowsByContractId(db, contractId)
  },

  async saveByContractId(contractId: number, items: BoqSaveInput): Promise<BoqSaveResult> {
    // 禁止传入空数组：saveByContractId 是"保存清单"语义而非"删除清单"。
    // 若允许空数组，将导致合同下所有 BOQ 被静默清空，产生不可逆的数据损失。
    // 需要清空清单请使用专用删除接口；此处拒绝是保护性设计，而非 Bug。
    if (items.length === 0) {
      throw new Error('清单项不能为空：saveByContractId 仅用于保存清单，不支持通过传空数组删除全部清单项')
    }

    const db = getDb()
    if (!db) throw new Error('Database not initialized')

    const contractRows = execToObjects(db.exec('SELECT project_id FROM contracts WHERE id = ? LIMIT 1', [contractId]))
    const projectId = Number(contractRows[0]?.project_id ?? 0)
    const existingRows = getBoqRowsByContractId(db, contractId)
    const existingRowMap = new Map(existingRows.map(row => [row.id, row]))
    const retainedIds = new Set<number>()

    for (const item of items) {
      const candidateId = Number(item.id ?? 0)
      if (candidateId > 0 && existingRowMap.has(candidateId)) {
        retainedIds.add(candidateId)
      }
    }

    const removedBoqIds = existingRows
      .map(row => row.id)
      .filter(id => !retainedIds.has(id))

    if (removedBoqIds.length > 0) {
      const linkedSettlementNos = await listLinkedSettlementNosByContract(projectId, contractId, removedBoqIds)
      if (linkedSettlementNos.length > 0) {
        const settlementSummary = summarizeLabels(linkedSettlementNos, 3, '张结算单')
        throw new Error('当前合同已被结算单' + settlementSummary + '引用，请先处理相关结算记录后再删除合同。')
      }
    }

    await withTransaction(async () => {
      await upsertBoqRows(db, contractId, items)

      const savedItems = getBoqRowsByContractId(db, contractId)
      updateContractAmounts(db, contractId, savedItems)

    })

    await saveToStorage()
    if (projectId > 0) {
      await settlementService.refreshProjectChainByContractBoq(projectId, contractId)
    }

    return {
      items: getBoqRowsByContractId(db, contractId),
    }
  },

  async createBatch(items: BoqSaveInput): Promise<void> {
    if (items.length === 0) return
    const contractId = items[0].contractId
    await boqService.saveByContractId(contractId, items)
  },

  async deleteContractById(contractId: number): Promise<void> {
    await contractService.delete(contractId)
  },

  async deleteByContractId(contractId: number): Promise<void> {
    await boqService.deleteContractById(contractId)
  },
}



