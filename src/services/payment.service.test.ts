import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payment } from '@/types'

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

import { paymentService } from './payment.service'

function makePaymentInput(): Omit<Payment, 'id'> {
  return {
    projectId: 1,
    paymentType: 'receive',
    paymentDate: '2026-04-01',
    amount: 100,
    paymentMethod: 'transfer',
    referenceNo: 'SK-001',
    description: '备注',
  }
}

function makeDbHandle(paymentExists = true) {
  return {
    exec: dbExecMock,
    run: dbRunMock,
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(),
      step: vi.fn(() => paymentExists && sql.includes('SELECT * FROM payments WHERE id = ?')),
      getAsObject: vi.fn(() => ({
        id: 11,
        project_id: 1,
        payment_type: 'receive',
        payment_date: '2026-04-01',
        amount: 100,
        payment_method: 'transfer',
        reference_no: 'SK-001',
        description: '备注',
      })),
      free: vi.fn(),
    })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getDbMock.mockReturnValue(makeDbHandle())
})

describe('payment.service', () => {
  it('creates a payment and normalizes the amount', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      return []
    })
    getLastInsertIdMock.mockReturnValue(31)

    const result = await paymentService.create({
      ...makePaymentInput(),
      amount: 100.126,
    })

    expect(dbRunMock).toHaveBeenCalledTimes(1)
    expect(dbRunMock.mock.calls[0][0]).toContain('INSERT INTO payments')
    expect(dbRunMock.mock.calls[0][1]).toEqual([
      1,
      'receive',
      '2026-04-01',
      100.126,
      'transfer',
      'SK-001',
      '备注',
    ])
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ...makePaymentInput(),
      amount: 100.126,
      id: 31,
    })
  })

  it('rejects invalid payment payloads', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      return []
    })

    await expect(paymentService.create({
      ...makePaymentInput(),
      amount: 0,
    })).rejects.toThrow('收付款金额必须大于 0')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('updates and deletes existing payments', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      if (sql.includes('SELECT * FROM payments WHERE id = ?')) {
        return [{ columns: ['id'], values: [[11]] }]
      }
      return []
    })

    await paymentService.update(11, { amount: 88.888, description: 'new' })
    await paymentService.delete(11)

    expect(dbRunMock).toHaveBeenCalledWith(
      'UPDATE payments SET amount = ?, description = ? WHERE id = ?',
      [88.888, 'new', 11],
    )
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM payments WHERE id = ?', [11])
    expect(saveToStorageMock).toHaveBeenCalledTimes(2)
  })

  it('rejects missing payments and unknown projects', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return []
      }
      if (sql.includes('SELECT * FROM payments WHERE id = ?')) {
        return []
      }
      return []
    })

    await expect(paymentService.create(makePaymentInput())).rejects.toThrow('所选项目不存在或已删除')

    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ?')) {
        return [{ columns: ['1'], values: [[1]] }]
      }
      if (sql.includes('SELECT * FROM payments WHERE id = ?')) {
        return []
      }
      return []
    })

    getDbMock.mockReturnValue(makeDbHandle(false))
    await expect(paymentService.update(999, { amount: 10 })).rejects.toThrow('收付款记录不存在')
    await expect(paymentService.delete(999)).rejects.toThrow('收付款记录不存在')
  })
})
