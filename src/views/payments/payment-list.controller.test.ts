import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  deleteReceivePaymentMock,
  loadPaymentLedgerSnapshotMock,
  saveLedgerInvoiceMock,
  saveReceivePaymentMock,
  voidLedgerInvoiceMock,
} = vi.hoisted(() => ({
  deleteReceivePaymentMock: vi.fn(),
  loadPaymentLedgerSnapshotMock: vi.fn(),
  saveLedgerInvoiceMock: vi.fn(),
  saveReceivePaymentMock: vi.fn(),
  voidLedgerInvoiceMock: vi.fn(),
}))

vi.mock('@/services/payment-ledger.service', () => ({
  deleteReceivePayment: deleteReceivePaymentMock,
  loadPaymentLedgerSnapshot: loadPaymentLedgerSnapshotMock,
  saveLedgerInvoice: saveLedgerInvoiceMock,
  saveReceivePayment: saveReceivePaymentMock,
  voidLedgerInvoice: voidLedgerInvoiceMock,
}))

import {
  deletePaymentListPayment,
  loadPaymentListSnapshot,
  savePaymentListInvoice,
  savePaymentListPayment,
  voidPaymentListInvoice,
} from './payment-list.controller'

const emptySnapshot = {
  projects: [],
  contracts: [],
  settlements: [],
  payments: [],
  invoices: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('payment-list.controller', () => {
  it('loads the payment list snapshot through payment ledger service', async () => {
    loadPaymentLedgerSnapshotMock.mockResolvedValue(emptySnapshot)

    await expect(loadPaymentListSnapshot()).resolves.toBe(emptySnapshot)
    expect(loadPaymentLedgerSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('saves a new payment with normalized project id and create message', async () => {
    saveReceivePaymentMock.mockResolvedValue(emptySnapshot)

    await expect(savePaymentListPayment({
      projectId: undefined,
      paymentDate: '2026-04-10',
      amount: 2,
      paymentMethod: '银行转账',
      referenceNo: 'SK-001',
      description: '测试收款',
    })).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '收款记录已新增',
    })

    expect(saveReceivePaymentMock).toHaveBeenCalledWith({
      projectId: 0,
      paymentDate: '2026-04-10',
      amount: 2,
      paymentMethod: '银行转账',
      referenceNo: 'SK-001',
      description: '测试收款',
    }, undefined)
  })

  it('saves an existing payment with update message', async () => {
    saveReceivePaymentMock.mockResolvedValue(emptySnapshot)

    await expect(savePaymentListPayment({
      projectId: 1,
      paymentDate: '2026-04-10',
      amount: 3,
      paymentMethod: '现金',
      referenceNo: 'SK-002',
      description: '更新收款',
    }, 9)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '收款记录已更新',
    })

    expect(saveReceivePaymentMock).toHaveBeenCalledWith({
      projectId: 1,
      paymentDate: '2026-04-10',
      amount: 3,
      paymentMethod: '现金',
      referenceNo: 'SK-002',
      description: '更新收款',
    }, 9)
  })

  it('treats payment edit id 0 as update message', async () => {
    saveReceivePaymentMock.mockResolvedValue(emptySnapshot)

    await expect(savePaymentListPayment({
      projectId: 1,
      paymentDate: '2026-04-10',
      amount: 3,
      paymentMethod: '现金',
      referenceNo: 'SK-000',
      description: '边界收款',
    }, 0)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '收款记录已更新',
    })

    expect(saveReceivePaymentMock).toHaveBeenCalledWith({
      projectId: 1,
      paymentDate: '2026-04-10',
      amount: 3,
      paymentMethod: '现金',
      referenceNo: 'SK-000',
      description: '边界收款',
    }, 0)
  })

  it('deletes a payment with unified success message', async () => {
    deleteReceivePaymentMock.mockResolvedValue(emptySnapshot)

    await expect(deletePaymentListPayment(11)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '收款记录已删除',
    })

    expect(deleteReceivePaymentMock).toHaveBeenCalledWith(11)
  })

  it('saves invoices with normalized project id and create-update messages', async () => {
    saveLedgerInvoiceMock.mockResolvedValue(emptySnapshot)
    const invoiceForm = {
      projectId: undefined,
      invoiceNo: 'FP-001',
      invoiceType: 'special' as const,
      invoiceAmount: 1.835,
      taxRate: 9,
      taxAmount: 0.165,
      totalAmount: 2,
      invoiceDate: '2026-04-10',
      remark: '测试发票',
    }

    await expect(savePaymentListInvoice(invoiceForm)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '发票已新增',
    })
    await expect(savePaymentListInvoice({ ...invoiceForm, projectId: 2 }, 7)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '发票已更新',
    })

    expect(saveLedgerInvoiceMock).toHaveBeenNthCalledWith(1, {
      ...invoiceForm,
      projectId: 0,
    }, undefined)
    expect(saveLedgerInvoiceMock).toHaveBeenNthCalledWith(2, {
      ...invoiceForm,
      projectId: 2,
    }, 7)
  })

  it('treats invoice edit id 0 as update message', async () => {
    saveLedgerInvoiceMock.mockResolvedValue(emptySnapshot)

    await expect(savePaymentListInvoice({
      projectId: 1,
      invoiceNo: 'FP-000',
      invoiceType: 'special',
      invoiceAmount: 1.835,
      taxRate: 9,
      taxAmount: 0.165,
      totalAmount: 2,
      invoiceDate: '2026-04-10',
      remark: '边界发票',
    }, 0)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '发票已更新',
    })

    expect(saveLedgerInvoiceMock).toHaveBeenCalledWith({
      projectId: 1,
      invoiceNo: 'FP-000',
      invoiceType: 'special',
      invoiceAmount: 1.835,
      taxRate: 9,
      taxAmount: 0.165,
      totalAmount: 2,
      invoiceDate: '2026-04-10',
      remark: '边界发票',
    }, 0)
  })

  it('voids invoices with unified success message', async () => {
    voidLedgerInvoiceMock.mockResolvedValue(emptySnapshot)

    await expect(voidPaymentListInvoice(5)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '发票已作废',
    })

    expect(voidLedgerInvoiceMock).toHaveBeenCalledWith(5)
  })
})
