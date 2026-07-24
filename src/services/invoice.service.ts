import type { Invoice } from '@/types'
import { getDb, getLastInsertId, saveToStorage, execToObjects, getRowNumber, getRowString } from './db-core'
import { projectExists, roundCurrencyAmount } from './record-validation'
import { normalizeUniqueConstraintError } from './unique-constraint'

// ==================== 数据行映�?====================
function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: getRowNumber(row, 'id'),
    projectId: getRowNumber(row, 'project_id'),
    invoiceNo: getRowString(row, 'invoice_no'),
    invoiceType: getRowString(row, 'invoice_type') as Invoice['invoiceType'],
    invoiceAmount: getRowNumber(row, 'invoice_amount'),
    taxRate: getRowNumber(row, 'tax_rate'),
    taxAmount: getRowNumber(row, 'tax_amount'),
    totalAmount: getRowNumber(row, 'total_amount'),
    invoiceDate: getRowString(row, 'invoice_date'),
    remark: getRowString(row, 'remark'),
    createdAt: getRowString(row, 'created_at'),
  }
}


function hasInvoiceNoConflict(
  db: NonNullable<ReturnType<typeof getDb>>,
  invoiceNo: string,
  excludeInvoiceId?: number,
): boolean {
  const rows = excludeInvoiceId === undefined
    ? db.exec('SELECT 1 FROM invoices WHERE invoice_no = ? LIMIT 1', [invoiceNo])
    : db.exec('SELECT 1 FROM invoices WHERE invoice_no = ? AND id <> ? LIMIT 1', [invoiceNo, excludeInvoiceId])

  return rows.length > 0
}

const INVOICE_NO_CONFLICT_MESSAGE = '发票号码已存在'

function roundInvoiceAmount(amount: number): number {
  return roundCurrencyAmount(amount)
}

function validateInvoiceInput(data: Partial<Invoice>): void {
  if (!data.projectId || data.projectId <= 0) {
    throw new Error('请选择有效项目')
  }

  if (!projectExists(data.projectId)) {
    throw new Error('所选项目不存在或已删除')
  }

  if (!String(data.invoiceNo || '').trim()) {
    throw new Error('请输入发票号')
  }

  if (!String(data.invoiceDate || '').trim()) {
    throw new Error('请选择开票日期')
  }

  const invoiceAmount = roundCurrencyAmount(Number(data.invoiceAmount || 0))
  const taxAmount = roundCurrencyAmount(Number(data.taxAmount || 0))
  const totalAmount = roundCurrencyAmount(Number(data.totalAmount || 0))
  const taxRate = Number(data.taxRate || 0)

  if (invoiceAmount <= 0) {
    throw new Error('不含税金额必须大于 0')
  }

  if (totalAmount <= 0) {
    throw new Error('价税合计必须大于 0')
  }

  if (taxRate < 0) {
    throw new Error('税率不能小于 0')
  }

  if (taxAmount < 0) {
    throw new Error('税额不能小于 0')
  }

  if (roundCurrencyAmount(invoiceAmount + taxAmount) !== totalAmount) {
    throw new Error('发票金额、税额与价税合计不一致')
  }
}

// ==================== 发票服务 ====================
export const invoiceService = {
  async getAll(): Promise<Invoice[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec('SELECT * FROM invoices ORDER BY invoice_date DESC')
    return execToObjects(result).map(row => mapInvoice(row))
  },

  async getByProjectId(projectId: number): Promise<Invoice[]> {
    const db = getDb()
    if (!db) return []
    const result = db.exec(
      'SELECT * FROM invoices WHERE project_id = ? ORDER BY invoice_date DESC',
      [projectId]
    )
    return execToObjects(result).map(row => mapInvoice(row))
  },

  async getById(id: number): Promise<Invoice | null> {
    const db = getDb()
    if (!db) return null
    const stmt = db.prepare('SELECT * FROM invoices WHERE id = ?')
    stmt.bind([id])
    if (stmt.step()) {
      const row = stmt.getAsObject() as Record<string, unknown>
      stmt.free()
      return mapInvoice(row)
    }
    stmt.free()
    return null
  },

  async create(data: Omit<Invoice, 'id' | 'createdAt'>): Promise<Invoice> {
    try {
      const db = getDb()
      if (!db) throw new Error('Database not initialized')
      validateInvoiceInput(data)
      if (hasInvoiceNoConflict(db, data.invoiceNo)) {
        throw new Error(INVOICE_NO_CONFLICT_MESSAGE)
      }

      const invoiceAmount = roundCurrencyAmount(data.invoiceAmount)
      const taxAmount = roundCurrencyAmount(data.taxAmount)
      const totalAmount = roundCurrencyAmount(data.totalAmount)
      db.run(
        `INSERT INTO invoices (project_id, invoice_no, invoice_type, invoice_amount, tax_rate, tax_amount, total_amount, invoice_date, remark)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.projectId, data.invoiceNo, data.invoiceType, invoiceAmount, data.taxRate, taxAmount, totalAmount, data.invoiceDate, data.remark]
      )
      const id = getLastInsertId()
      const row = db.exec('SELECT * FROM invoices WHERE id = ?', [id])
      const mapped = execToObjects(row)
      await saveToStorage()
      return {
        ...data,
        invoiceAmount,
        taxAmount,
        totalAmount,
        id,
        createdAt: String(mapped[0]?.created_at ?? ''),
      }
    } catch (error) {
      throw normalizeUniqueConstraintError(error, INVOICE_NO_CONFLICT_MESSAGE)
    }
  },

  async update(id: number, data: Partial<Invoice>): Promise<void> {
    try {
      const db = getDb()
      if (!db) throw new Error('Database not initialized')
      const existing = await invoiceService.getById(id)
      if (!existing) {
        throw new Error('发票记录不存在')
      }

      const merged: Invoice = {
        ...existing,
        ...data,
        invoiceAmount: data.invoiceAmount !== undefined ? roundInvoiceAmount(data.invoiceAmount) : existing.invoiceAmount,
        taxAmount: data.taxAmount !== undefined ? roundInvoiceAmount(data.taxAmount) : existing.taxAmount,
        totalAmount: data.totalAmount !== undefined ? roundInvoiceAmount(data.totalAmount) : existing.totalAmount,
      }
      validateInvoiceInput(merged)
      if (data.invoiceNo !== undefined && hasInvoiceNoConflict(db, merged.invoiceNo, id)) {
        throw new Error(INVOICE_NO_CONFLICT_MESSAGE)
      }

      const fields: string[] = []
      const values: unknown[] = []
      const fieldMap: Record<string, string> = {
        projectId: 'project_id', invoiceNo: 'invoice_no', invoiceType: 'invoice_type',
        invoiceAmount: 'invoice_amount', taxRate: 'tax_rate', taxAmount: 'tax_amount',
        totalAmount: 'total_amount', invoiceDate: 'invoice_date', remark: 'remark'
      }
      for (const [key, col] of Object.entries(fieldMap)) {
        if (data[key as keyof Invoice] !== undefined) {
          fields.push(`${col} = ?`)
          if (key === 'invoiceAmount') {
            values.push(merged.invoiceAmount)
            continue
          }
          if (key === 'taxAmount') {
            values.push(merged.taxAmount)
            continue
          }
          if (key === 'totalAmount') {
            values.push(merged.totalAmount)
            continue
          }
          values.push(data[key as keyof Invoice])
        }
      }
      if (fields.length === 0) return
      values.push(id)
      db.run(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`, values)
      await saveToStorage()
    } catch (error) {
      throw normalizeUniqueConstraintError(error, INVOICE_NO_CONFLICT_MESSAGE)
    }
  },

  async delete(id: number): Promise<void> {
    const db = getDb()
    if (!db) throw new Error('Database not initialized')
    const existing = await invoiceService.getById(id)
    if (!existing) {
      throw new Error('发票记录不存在')
    }
    db.run('DELETE FROM invoices WHERE id = ?', [id])
    await saveToStorage()
  }
}





