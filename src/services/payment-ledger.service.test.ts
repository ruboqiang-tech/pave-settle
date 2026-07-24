import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  loadBusinessSnapshotMock,
  invoiceServiceMock,
  paymentServiceMock,
} = vi.hoisted(() => ({
  loadBusinessSnapshotMock: vi.fn(),
  invoiceServiceMock: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  paymentServiceMock: {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('./analytics.service', () => ({
  loadBusinessSnapshot: loadBusinessSnapshotMock,
}))

vi.mock('./invoice.service', () => ({
  invoiceService: invoiceServiceMock,
}))

vi.mock('./payment.service', () => ({
  paymentService: paymentServiceMock,
}))

import {
  deleteReceivePayment,
  loadPaymentLedgerSnapshot,
  saveLedgerInvoice,
  saveReceivePayment,
  voidLedgerInvoice,
} from './payment-ledger.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('payment-ledger.service', () => {
  it('loads payment ledger snapshot from analytics snapshot service', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(loadPaymentLedgerSnapshot()).resolves.toBe(snapshot)
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('creates a receive payment and reloads snapshot', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [{ id: 1 }], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(saveReceivePayment({
      projectId: 1,
      paymentDate: '2026-04-01',
      amount: 10,
      paymentMethod: 'transfer',
      referenceNo: 'SK-001',
      description: '收款',
    })).resolves.toBe(snapshot)

    expect(paymentServiceMock.create).toHaveBeenCalledWith({
      projectId: 1,
      paymentDate: '2026-04-01',
      amount: 10,
      paymentMethod: 'transfer',
      referenceNo: 'SK-001',
      description: '收款',
      paymentType: 'receive',
    })
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('updates a receive payment and reloads snapshot', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [{ id: 2 }], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(saveReceivePayment({
      projectId: 1,
      paymentDate: '2026-04-02',
      amount: 20,
      paymentMethod: 'cash',
      referenceNo: 'SK-002',
      description: '收款更新',
    }, 2)).resolves.toBe(snapshot)

    expect(paymentServiceMock.update).toHaveBeenCalledWith(2, {
      projectId: 1,
      paymentDate: '2026-04-02',
      amount: 20,
      paymentMethod: 'cash',
      referenceNo: 'SK-002',
      description: '收款更新',
      paymentType: 'receive',
    })
  })

  it('treats payment id 0 as update path instead of create path', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [{ id: 0 }], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(saveReceivePayment({
      projectId: 1,
      paymentDate: '2026-04-02',
      amount: 20,
      paymentMethod: 'cash',
      referenceNo: 'SK-000',
      description: '边界收款',
    }, 0)).resolves.toBe(snapshot)

    expect(paymentServiceMock.update).toHaveBeenCalledWith(0, {
      projectId: 1,
      paymentDate: '2026-04-02',
      amount: 20,
      paymentMethod: 'cash',
      referenceNo: 'SK-000',
      description: '边界收款',
      paymentType: 'receive',
    })
    expect(paymentServiceMock.create).not.toHaveBeenCalled()
  })

  it('deletes a receive payment and reloads snapshot', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(deleteReceivePayment(3)).resolves.toBe(snapshot)
    expect(paymentServiceMock.delete).toHaveBeenCalledWith(3)
  })

  it('creates or updates invoice entries and reloads snapshot', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [], invoices: [{ id: 4 }] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)
    const invoicePayload = {
      projectId: 1,
      invoiceNo: 'FP-001',
      invoiceType: 'special' as const,
      invoiceAmount: 10,
      taxRate: 9,
      taxAmount: 0.9,
      totalAmount: 10.9,
      invoiceDate: '2026-04-03',
      remark: '发票',
    }

    await expect(saveLedgerInvoice(invoicePayload)).resolves.toBe(snapshot)
    await expect(saveLedgerInvoice(invoicePayload, 4)).resolves.toBe(snapshot)

    expect(invoiceServiceMock.create).toHaveBeenCalledWith(invoicePayload)
    expect(invoiceServiceMock.update).toHaveBeenCalledWith(4, invoicePayload)
  })

  it('treats invoice id 0 as update path instead of create path', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [], invoices: [{ id: 0 }] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)
    const invoicePayload = {
      projectId: 1,
      invoiceNo: 'FP-000',
      invoiceType: 'special' as const,
      invoiceAmount: 10,
      taxRate: 9,
      taxAmount: 0.9,
      totalAmount: 10.9,
      invoiceDate: '2026-04-03',
      remark: '边界发票',
    }

    await expect(saveLedgerInvoice(invoicePayload, 0)).resolves.toBe(snapshot)

    expect(invoiceServiceMock.update).toHaveBeenCalledWith(0, invoicePayload)
    expect(invoiceServiceMock.create).not.toHaveBeenCalled()
  })

  it('voids invoice entries and reloads snapshot', async () => {
    const snapshot = { projects: [], contracts: [], settlements: [], payments: [], invoices: [] }
    loadBusinessSnapshotMock.mockResolvedValue(snapshot)

    await expect(voidLedgerInvoice(5)).resolves.toBe(snapshot)
    expect(invoiceServiceMock.delete).toHaveBeenCalledWith(5)
  })
})
