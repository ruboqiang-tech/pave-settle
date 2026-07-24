import type { ContractAttachment, SettlementAttachment } from '@/types'
import { execToObjects, getDb, getLastInsertId, saveToStorage } from './db-core'

type ContractAttachmentCreateInput = {
  contractId: number
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
}

type SettlementAttachmentCreateInput = {
  settlementId: number
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
}

function mapContractAttachmentRow(row: Record<string, unknown>): ContractAttachment {
  return {
    id: Number(row.id),
    contractId: Number(row.contract_id),
    fileName: String(row.file_name ?? ''),
    fileType: String(row.file_type ?? ''),
    fileSize: Number(row.file_size ?? 0),
    fileData: String(row.file_data ?? ''),
    uploadedAt: String(row.uploaded_at ?? ''),
  }
}

function mapSettlementAttachmentRow(row: Record<string, unknown>): SettlementAttachment {
  return {
    id: Number(row.id),
    settlementId: Number(row.settlement_id),
    fileName: String(row.file_name ?? ''),
    fileType: String(row.file_type ?? ''),
    fileSize: Number(row.file_size ?? 0),
    fileData: String(row.file_data ?? ''),
    uploadedAt: String(row.uploaded_at ?? ''),
  }
}

async function deleteAttachmentById(table: 'contract_attachments' | 'settlement_attachments', id: number): Promise<void> {
  const db = getDb()
  if (!db) throw new Error('Database not initialized')

  db.run(`DELETE FROM ${table} WHERE id = ?`, [id])
  await saveToStorage()
}

export const contractAttachmentService = {
  async getByContractId(contractId: number): Promise<ContractAttachment[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      'SELECT id, contract_id, file_name, file_type, file_size, uploaded_at FROM contract_attachments WHERE contract_id = ? ORDER BY uploaded_at DESC',
      [contractId],
    )
    return execToObjects(result).map(row => mapContractAttachmentRow({ ...row, file_data: '' }))
  },

  async getById(id: number): Promise<ContractAttachment | null> {
    const db = getDb()
    if (!db) return null

    const stmt = db.prepare('SELECT * FROM contract_attachments WHERE id = ?')
    stmt.bind([id])
    if (!stmt.step()) {
      stmt.free()
      return null
    }

    const attachment = mapContractAttachmentRow(stmt.getAsObject())
    stmt.free()
    return attachment
  },

  async create(data: ContractAttachmentCreateInput, options: { skipSave?: boolean } = {}): Promise<ContractAttachment> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')

    db.run(
      `INSERT INTO contract_attachments (contract_id, file_name, file_type, file_size, file_data)
       VALUES (?, ?, ?, ?, ?)`,
      [data.contractId, data.fileName, data.fileType, data.fileSize, data.fileData],
    )
    const id = getLastInsertId()
    if (!options.skipSave) {
      await saveToStorage()
    }

    return {
      id,
      contractId: data.contractId,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      fileData: data.fileData,
      uploadedAt: new Date().toISOString(),
    }
  },

  async delete(id: number): Promise<void> {
    await deleteAttachmentById('contract_attachments', id)
  },
}

export const settlementAttachmentService = {
  async getBySettlementId(settlementId: number): Promise<SettlementAttachment[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      'SELECT id, settlement_id, file_name, file_type, file_size, uploaded_at FROM settlement_attachments WHERE settlement_id = ? ORDER BY uploaded_at DESC',
      [settlementId],
    )
    return execToObjects(result).map(row => mapSettlementAttachmentRow({ ...row, file_data: '' }))
  },

  async getById(id: number): Promise<SettlementAttachment | null> {
    const db = getDb()
    if (!db) return null

    const stmt = db.prepare('SELECT * FROM settlement_attachments WHERE id = ?')
    stmt.bind([id])
    if (!stmt.step()) {
      stmt.free()
      return null
    }

    const attachment = mapSettlementAttachmentRow(stmt.getAsObject())
    stmt.free()
    return attachment
  },

  async create(data: SettlementAttachmentCreateInput, options: { skipSave?: boolean } = {}): Promise<SettlementAttachment> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')

    db.run(
      `INSERT INTO settlement_attachments (settlement_id, file_name, file_type, file_size, file_data)
       VALUES (?, ?, ?, ?, ?)`,
      [data.settlementId, data.fileName, data.fileType, data.fileSize, data.fileData],
    )
    const id = getLastInsertId()
    if (!options.skipSave) {
      await saveToStorage()
    }

    return {
      id,
      settlementId: data.settlementId,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: data.fileSize,
      fileData: data.fileData,
      uploadedAt: new Date().toISOString(),
    }
  },

  async delete(id: number): Promise<void> {
    await deleteAttachmentById('settlement_attachments', id)
  },
}
