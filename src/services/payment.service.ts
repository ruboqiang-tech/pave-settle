import type { Payment } from '@/types'
import { getDb, getLastInsertId, saveToStorage, execToObjects, getRowNumber, getRowString } from './db-core'
import { projectExists, roundCurrencyAmount } from './record-validation'

// ==================== 数据行映�?====================
function mapPayment(row: Record<string, unknown>): Payment {
  return {
    id: getRowNumber(row, 'id'),
    projectId: getRowNumber(row, 'project_id'),
    paymentType: getRowString(row, 'payment_type') as Payment['paymentType'],
    paymentDate: getRowString(row, 'payment_date'),
    amount: getRowNumber(row, 'amount'),
    paymentMethod: getRowString(row, 'payment_method'),
    referenceNo: getRowString(row, 'reference_no'),
    description: getRowString(row, 'description'),
  }
}


function validatePaymentInput(data: Partial<Payment>): void {
  if (!data.projectId || data.projectId <= 0) {
    throw new Error('请选择有效项目')
  }

  if (!projectExists(data.projectId)) {
    throw new Error('所选项目不存在或已删除')
  }

  if (!String(data.paymentDate || '').trim()) {
    throw new Error('请选择收款日期')
  }

  if (roundCurrencyAmount(Number(data.amount || 0)) <= 0) {
    throw new Error('收付款金额必须大于 0')
  }

  if (!String(data.paymentMethod || '').trim()) {
    throw new Error('请选择收款方式')
  }
}

export const paymentService = {
  async getAll(): Promise<Payment[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec('SELECT * FROM payments ORDER BY payment_date DESC')
    return execToObjects(result).map(row => mapPayment(row))
  },

  async getByProjectId(projectId: number): Promise<Payment[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      'SELECT * FROM payments WHERE project_id = ? ORDER BY payment_date DESC',
      [projectId]
    )
    return execToObjects(result).map(row => mapPayment(row))
  },

  async getById(id: number): Promise<Payment | null> {
    const db = getDb()
    if (!db) return null
    const stmt = db.prepare('SELECT * FROM payments WHERE id = ?')
    stmt.bind([id])
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      stmt.free()
      return mapPayment(row)
    }
    stmt.free()
    return null
  },

  async create(data: Omit<Payment, 'id'>): Promise<Payment> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    validatePaymentInput(data)

    const amount = roundCurrencyAmount(data.amount)
    db.run(
      `INSERT INTO payments (project_id, payment_type, payment_date, amount, payment_method, reference_no, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.projectId, data.paymentType, data.paymentDate, amount, data.paymentMethod, data.referenceNo, data.description]
    )
    const id = getLastInsertId()
    await saveToStorage()
    return { ...data, amount, id }
  },

  async update(id: number, data: Partial<Payment>): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    const existing = await paymentService.getById(id)
    if (!existing) {
      throw new Error('收付款记录不存在')
    }

    const merged: Payment = {
      ...existing,
      ...data,
      amount: data.amount !== undefined ? roundCurrencyAmount(data.amount) : existing.amount,
    }
    validatePaymentInput(merged)

    const fields: string[] = []
    const values: unknown[] = []
    const fieldMap: Record<string, string> = {
      projectId: 'project_id', paymentType: 'payment_type', paymentDate: 'payment_date',
      amount: 'amount', paymentMethod: 'payment_method', referenceNo: 'reference_no', description: 'description'
    }
    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key as keyof Payment] !== undefined) {
        fields.push(`${col} = ?`)
        values.push(key === 'amount' ? merged.amount : data[key as keyof Payment])
      }
    }
    if (fields.length === 0) return
    values.push(id)
    db.run(`UPDATE payments SET ${fields.join(', ')} WHERE id = ?`, values)
    await saveToStorage()
  },

  async delete(id: number): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    const existing = await paymentService.getById(id)
    if (!existing) {
      throw new Error('收付款记录不存在')
    }
    db.run('DELETE FROM payments WHERE id = ?', [id])
    await saveToStorage()
  }
}


