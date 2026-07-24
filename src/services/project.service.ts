import type { Project } from '@/types'
import { getDb, getLastInsertId, saveToStorage, execToObjects, getRowNumber, getRowString, withTransaction } from './db-core'
import { normalizeUniqueConstraintError } from './unique-constraint'

const PROJECT_CODE_CONFLICT_MESSAGE = '\u9879\u76ee\u7f16\u7801\u5df2\u5b58\u5728'

function mapProject(row: Record<string, unknown>): Project {
  return {
    id: getRowNumber(row, 'id'),
    code: getRowString(row, 'code'),
    name: getRowString(row, 'name'),
    projectType: getRowString(row, 'project_type') as Project['projectType'],
    location: getRowString(row, 'location'),
    ownerUnit: getRowString(row, 'owner_unit'),
    generalContractor: getRowString(row, 'general_contractor'),
    startDate: getRowString(row, 'start_date'),
    plannedEndDate: getRowString(row, 'planned_end_date'),
    actualEndDate: getRowString(row, 'actual_end_date') || undefined,
    status: getRowString(row, 'status') as Project['status'],
    createdAt: getRowString(row, 'created_at'),
    budgetFileId: getRowNumber(row, 'budget_file_id') || null,
    difficulty: (getRowString(row, 'difficulty') || 'medium') as Project['difficulty'],
  }
}

function hasProjectCodeConflict(
  db: NonNullable<ReturnType<typeof getDb>>,
  code: string,
  excludeProjectId?: number,
): boolean {
  const rows = excludeProjectId === undefined
    ? db.exec('SELECT 1 FROM projects WHERE code = ? LIMIT 1', [code])
    : db.exec('SELECT 1 FROM projects WHERE code = ? AND id <> ? LIMIT 1', [code, excludeProjectId])

  return rows.length > 0
}

export const projectService = {
  async getAll(): Promise<Project[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec('SELECT * FROM projects ORDER BY created_at DESC')
    return execToObjects(result).map(row => mapProject(row))
  },

  async getById(id: number): Promise<Project | null> {
    const db = getDb()
    if (!db) return null
    const stmt = db.prepare('SELECT * FROM projects WHERE id = ?')
    stmt.bind([id])
    try {
      if (!stmt.step()) return null
      return mapProject(stmt.getAsObject())
    } finally {
      stmt.free()
    }
  },

  async create(data: Omit<Project, 'id' | 'createdAt'>): Promise<Project> {
    try {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    if (hasProjectCodeConflict(db, data.code)) {
      throw new Error(PROJECT_CODE_CONFLICT_MESSAGE)
    }

    db.run(
      `INSERT INTO projects (code, name, project_type, location, owner_unit, general_contractor, start_date, planned_end_date, actual_end_date, status, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.code,
        data.name,
        data.projectType,
        data.location,
        data.ownerUnit,
        data.generalContractor,
        data.startDate,
        data.plannedEndDate,
        data.actualEndDate ?? '',
        data.status,
        data.difficulty ?? 'medium',
      ],
    )

    const id = getLastInsertId()
    await saveToStorage()
    return {
      ...data,
      actualEndDate: data.actualEndDate,
      id,
      createdAt: new Date().toISOString(),
    }
    } catch (error) {
      throw normalizeUniqueConstraintError(error, PROJECT_CODE_CONFLICT_MESSAGE)
    }
  },

  async update(id: number, data: Partial<Project>): Promise<void> {
    try {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    if (data.code !== undefined && hasProjectCodeConflict(db, data.code, id)) {
      throw new Error(PROJECT_CODE_CONFLICT_MESSAGE)
    }

    const fields: string[] = []
    const values: unknown[] = []
    const fieldMap: Record<string, string> = {
      code: 'code',
      name: 'name',
      projectType: 'project_type',
      location: 'location',
      ownerUnit: 'owner_unit',
      generalContractor: 'general_contractor',
      startDate: 'start_date',
      plannedEndDate: 'planned_end_date',
      actualEndDate: 'actual_end_date',
      status: 'status',
      budgetFileId: 'budget_file_id',
      difficulty: 'difficulty',
    }

    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key as keyof Project] !== undefined) {
        fields.push(`${col} = ?`)
        values.push(data[key as keyof Project])
      }
    }

    if (fields.length === 0) return
    values.push(id)
    db.run(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, values)

    await saveToStorage()
    } catch (error) {
      throw normalizeUniqueConstraintError(error, PROJECT_CODE_CONFLICT_MESSAGE)
    }
  },

  async delete(id: number): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')

    const settlementRows = db.exec('SELECT id FROM settlements WHERE project_id = ?', [id])
    const settlementIds = settlementRows[0]?.values?.map(row => Number(row[0])) ?? []
    const contractRows = db.exec('SELECT id FROM contracts WHERE project_id = ?', [id])
    const contractIds = contractRows[0]?.values?.map(row => Number(row[0])) ?? []

    await withTransaction(async transactionDb => {
      if (settlementIds.length > 0) {
        const placeholders = settlementIds.map(() => '?').join(',')
        transactionDb.run(`DELETE FROM settlement_details WHERE settlement_id IN (${placeholders})`, settlementIds)
        transactionDb.run(`DELETE FROM settlement_attachments WHERE settlement_id IN (${placeholders})`, settlementIds)
      }
      transactionDb.run('DELETE FROM settlements WHERE project_id = ?', [id])

      if (contractIds.length > 0) {
        const placeholders = contractIds.map(() => '?').join(',')
        transactionDb.run(`DELETE FROM bill_of_quantities WHERE contract_id IN (${placeholders})`, contractIds)
        transactionDb.run(`DELETE FROM contract_attachments WHERE contract_id IN (${placeholders})`, contractIds)
      }
      transactionDb.run('DELETE FROM contracts WHERE project_id = ?', [id])

      transactionDb.run('DELETE FROM payments WHERE project_id = ?', [id])
      transactionDb.run('DELETE FROM invoices WHERE project_id = ?', [id])
      transactionDb.run('DELETE FROM project_cost_entries WHERE project_id = ?', [id])
      transactionDb.run('DELETE FROM projects WHERE id = ?', [id])
    })

    await saveToStorage()
  }
}
