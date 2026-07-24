import {
  execToObjects,
  getDb,
  getRowNumber,
  getRowString,
  saveToStorage,
} from './db-core'

export interface BudgetFile {
  id: number
  name: string
  content: string
  createdAt: string
}

function mapBudgetFile(row: Record<string, unknown>): BudgetFile {
  return {
    id: getRowNumber(row, 'id'),
    name: getRowString(row, 'name'),
    content: getRowString(row, 'content'),
    createdAt: getRowString(row, 'created_at'),
  }
}

export const budgetFileService = {
  async getAll(): Promise<BudgetFile[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec('SELECT * FROM budget_files ORDER BY created_at DESC')
    return execToObjects(result).map(row => mapBudgetFile(row))
  },

  async getById(id: number): Promise<BudgetFile | null> {
    const db = getDb()
    if (!db) return null
    const stmt = db.prepare('SELECT * FROM budget_files WHERE id = ?')
    stmt.bind([id])
    try {
      if (!stmt.step()) return null
      return mapBudgetFile(stmt.getAsObject())
    } finally {
      stmt.free()
    }
  },

  async create(name: string, content: string): Promise<BudgetFile> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    db.run('INSERT INTO budget_files (name, content) VALUES (?, ?)', [name, content])
    const result = db.exec('SELECT last_insert_rowid()')
    const id = result[0].values[0][0] as number
    await saveToStorage()
    return {
      id,
      name,
      content,
      createdAt: new Date().toISOString()
    }
  },

  async update(id: number, name: string, content: string): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    db.run('UPDATE budget_files SET name = ?, content = ? WHERE id = ?', [name, content, id])
    await saveToStorage()
  },

  async delete(id: number): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    // Set budget_file_id of projects referencing this budget file to NULL
    db.run('UPDATE projects SET budget_file_id = NULL WHERE budget_file_id = ?', [id])
    db.run('DELETE FROM budget_files WHERE id = ?', [id])
    await saveToStorage()
  },

  async associateWithProject(projectId: number, budgetFileId: number | null): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    db.run('UPDATE projects SET budget_file_id = ? WHERE id = ?', [budgetFileId, projectId])
    await saveToStorage()
  }
}
