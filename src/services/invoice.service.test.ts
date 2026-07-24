import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Invoice } from '@/types'

const {
  dbExecMock,
  dbRunMock,
  getDbMock,
  getLastInsertIdMock,
  getRowNumberMock,
  getRowStringMock,
  execToObjectsMock,
  saveToStorageMock,
} = vi.hoisted(() => ({
  dbExecMock: vi.fn(),
  dbRunMock: vi.fn(),
  getDbMock: vi.fn(),
  getLastInsertIdMock: vi.fn(),
  getRowNumberMock: vi.fn((row: Record<string, unknown>, key: string) => Number(row[key] ?? 0)),
  getRowStringMock: vi.fn((row: Record<string, unknown>, key: string, defaultValue = '') => String(row[key] ?? defaultValue)),
  execToObjectsMock: vi.fn((rows: Array<Record<string, unknown>>) => rows),
  saveToStorageMock: vi.fn(),
}))

vi.mock('./db-core', () => ({
  execToObjects: execToObjectsMock,
  getDb: getDbMock,
  getLastInsertId: getLastInsertIdMock,
  getRowNumber: getRowNumberMock,
  getRowString: getRowStringMock,
  saveToStorage: saveToStorageMock,
}))

import { invoiceService } from './invoice.service'

function makeInvoiceInput(): Omit<Invoice, 'id' | 'createdAt'> {
  return {
    projectId: 1,
    invoiceNo: 'FP-001',
    invoiceType: 'special',
    invoiceAmount: 100,
    taxRate: 9,
    taxAmount: 9,
    totalAmount: 109,
    invoiceDate: '2026-04-01',
    remark: '\u5907\u6ce8',
  }
}

function makeDbHandle() {
  return {
    exec: dbExecMock,
    run: dbRunMock,
    prepare: vi.fn((sql: string) => {
      const invoiceRow = {
        id: 11,
        project_id: 1,
        invoice_no: 'FP-001',
        invoice_type: 'special',
        invoice_amount: 100,
        tax_rate: 9,
        tax_amount: 9,
        total_amount: 109,
        invoice_date: '2026-04-01',
        remark: '\u5907\u6ce8',
        created_at: '2026-04-01T00:00:00.000Z',
      }
      return {
        bind: vi.fn(),
        step: vi.fn(() => sql.includes('SELECT * FROM invoices WHERE id = ?')),
        getAsObject: vi.fn(() => invoiceRow),
        free: vi.fn(),
      }
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getDbMock.mockReturnValue(makeDbHandle())
})

describe('invoice.service', () => {
  it('creates an invoice and persists it', async () => {
    const input = {
      ...makeInvoiceInput(),
      invoiceAmount: 100.126,
      taxAmount: 9.007,
      totalAmount: 109.133,
    }
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      if (sql.includes('SELECT * FROM invoices WHERE id = ?')) {
        return []
      }
      if (sql.includes('FROM invoices WHERE invoice_no = ? LIMIT 1')) {
        return []
      }
      return []
    })
    getLastInsertIdMock.mockReturnValue(31)

    const result = await invoiceService.create(input)

    expect(dbRunMock).toHaveBeenCalledTimes(1)
    expect(dbRunMock.mock.calls[0][0]).toContain('INSERT INTO invoices')
    expect(dbRunMock.mock.calls[0][1]).toEqual([
      1,
      'FP-001',
      'special',
      100.126,
      9,
      9.007,
      109.133,
      '2026-04-01',
      '备注',
    ])
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ...input,
      id: 31,
      invoiceAmount: 100.126,
      taxAmount: 9.007,
      totalAmount: 109.133,
    })
  })

  it('updates invoice amounts with 3-digit precision', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      if (sql.includes('FROM invoices WHERE invoice_no = ? AND id <> ? LIMIT 1')) {
        return []
      }
      return []
    })

    await invoiceService.update(11, {
      invoiceAmount: 88.888,
      taxAmount: 8.001,
      totalAmount: 96.889,
    })

    expect(dbRunMock).toHaveBeenCalledWith(
      'UPDATE invoices SET invoice_amount = ?, tax_amount = ?, total_amount = ? WHERE id = ?',
      [88.888, 8.001, 96.889, 11],
    )
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate invoice numbers on create with a clear error', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      if (sql.includes('FROM invoices WHERE invoice_no = ? LIMIT 1')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      return []
    })

    await expect(invoiceService.create(makeInvoiceInput())).rejects.toThrow('\u53d1\u7968\u53f7\u7801\u5df2\u5b58\u5728')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate invoice numbers on update with a clear error', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      if (sql.includes('SELECT * FROM invoices WHERE id = ?')) {
        return [{ columns: ['id', 'project_id', 'invoice_no', 'invoice_type', 'invoice_amount', 'tax_rate', 'tax_amount', 'total_amount', 'invoice_date', 'remark', 'created_at'], values: [[11, 1, 'FP-001', 'special', 100, 9, 9, 109, '2026-04-01', '??', '2026-04-01T00:00:00.000Z']] }]
      }
      if (sql.includes('FROM invoices WHERE invoice_no = ? AND id <> ? LIMIT 1')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      return []
    })

    await expect(invoiceService.update(11, { invoiceNo: 'FP-002' })).rejects.toThrow('\u53d1\u7968\u53f7\u7801\u5df2\u5b58\u5728')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })
})
