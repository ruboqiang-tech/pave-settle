import {
  execToObjects,
  getDb,
  getRowNumber,
  getRowString,
  saveToStorage,
  withTransaction,
} from './db-core'
import { roundAmount } from '@/utils/calculations'
import type { CostCategory, CostPhase, ProjectCostEntry } from './costing.service'

type DatabaseHandle = NonNullable<ReturnType<typeof getDb>>

export type ProjectCostSaveInput = Omit<ProjectCostEntry, 'id' | 'projectId' | 'phase' | 'createdAt'> & {
  id?: number
  phase?: CostPhase
}

function mapProjectCostEntry(row: Record<string, unknown>): ProjectCostEntry {
  return {
    id: getRowNumber(row, 'id'),
    projectId: getRowNumber(row, 'project_id'),
    phase: getRowString(row, 'phase', 'actual') as CostPhase,
    category: getRowString(row, 'category', 'material') as CostCategory,
    itemName: getRowString(row, 'item_name'),
    spec: getRowString(row, 'spec'),
    unit: getRowString(row, 'unit'),
    quantity: getRowNumber(row, 'quantity'),
    unitCost: getRowNumber(row, 'unit_cost'),
    amount: getRowNumber(row, 'amount'),
    occurredOn: getRowString(row, 'occurred_on'),
    note: getRowString(row, 'note'),
    createdAt: getRowString(row, 'created_at'),
  }
}

function assertDb(): DatabaseHandle {
  const db = getDb()
  if (!db) throw new Error('Database not initialized')
  return db
}

function normalizeAmount(input: ProjectCostSaveInput): number {
  const explicitAmount = Number(input.amount || 0)
  if (explicitAmount) return roundAmount(explicitAmount)

  return roundAmount(Number(input.quantity || 0) * Number(input.unitCost || 0))
}

function insertCostEntry(
  db: DatabaseHandle,
  projectId: number,
  phase: CostPhase,
  input: ProjectCostSaveInput,
): void {
  db.run(
    `INSERT INTO project_cost_entries
       (project_id, phase, category, item_name, spec, unit, quantity, unit_cost, amount, occurred_on, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      phase,
      input.category || 'material',
      input.itemName || '',
      input.spec || '',
      input.unit || '',
      Number(input.quantity || 0),
      Number(input.unitCost || 0),
      normalizeAmount(input),
      input.occurredOn || '',
      input.note || '',
    ],
  )
}

export const projectCostService = {
  async listByProjectId(projectId: number): Promise<ProjectCostEntry[]> {
    const db = getDb()
    if (!db) return []

    const result = db.exec(
      `SELECT *
       FROM project_cost_entries
       WHERE project_id = ?
       ORDER BY phase, occurred_on, id`,
      [projectId],
    )
    return execToObjects(result).map(row => mapProjectCostEntry(row))
  },

  async listByProjectAndPhase(projectId: number, phase: CostPhase): Promise<ProjectCostEntry[]> {
    const db = getDb()
    if (!db) return []

    const result = db.exec(
      `SELECT *
       FROM project_cost_entries
       WHERE project_id = ? AND phase = ?
       ORDER BY occurred_on, id`,
      [projectId, phase],
    )
    return execToObjects(result).map(row => mapProjectCostEntry(row))
  },

  async saveByProjectAndPhase(
    projectId: number,
    phase: CostPhase,
    entries: ProjectCostSaveInput[],
  ): Promise<ProjectCostEntry[]> {
    const db = assertDb()

    await withTransaction(async transactionDb => {
      transactionDb.run(
        'DELETE FROM project_cost_entries WHERE project_id = ? AND phase = ?',
        [projectId, phase],
      )

      for (const entry of entries) {
        insertCostEntry(transactionDb, projectId, phase, entry)
      }
    })

    await saveToStorage()
    return projectCostService.listByProjectAndPhase(projectId, phase)
  },
}
