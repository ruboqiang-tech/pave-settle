import { describe, expect, it } from 'vitest'
import type { Invoice, Payment } from '@/types'
import {
  applyInvoiceAmountResult,
  buildInvoiceTableSummary,
  buildPaymentTableSummary,
  createInvoiceForm,
  createInvoiceFormFromRow,
  createPaymentForm,
  createPaymentFormFromRow,
  getFilterDateLabel,
} from './payment-list.helpers'

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    projectId: 10,
    paymentType: 'receive',
    paymentDate: '2026-04-01',
    amount: 2,
    paymentMethod: '银行转账',
    referenceNo: 'SK-001',
    description: '第1期回款',
    ...overrides,
  }
}

function createInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    projectId: 10,
    invoiceNo: 'FP-001',
    invoiceType: 'special',
    invoiceAmount: 1.835,
    taxRate: 9,
    taxAmount: 0.165,
    totalAmount: 2,
    invoiceDate: '2026-04-01',
    remark: '首张发票',
    createdAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('payment-list.helpers', () => {
  it('creates payment and invoice forms with sensible defaults and optional project preset', () => {
    expect(createPaymentForm(10)).toEqual({
      projectId: 10,
      paymentDate: '',
      amount: 0,
      paymentMethod: '银行转账',
      referenceNo: '',
      description: '',
    })

    expect(createInvoiceForm()).toEqual({
      projectId: undefined,
      invoiceNo: '',
      invoiceType: 'special',
      invoiceAmount: 0,
      taxRate: 9,
      taxAmount: 0,
      totalAmount: 0,
      invoiceDate: '',
      remark: '',
    })
  })

  it('maps existing payment and invoice rows into editable form state', () => {
    expect(createPaymentFormFromRow(createPayment())).toEqual({
      projectId: 10,
      paymentDate: '2026-04-01',
      amount: 2,
      paymentMethod: '银行转账',
      referenceNo: 'SK-001',
      description: '第1期回款',
    })

    expect(createInvoiceFormFromRow(createInvoice())).toEqual({
      projectId: 10,
      invoiceNo: 'FP-001',
      invoiceType: 'special',
      invoiceAmount: 1.835,
      taxRate: 9,
      taxAmount: 0.165,
      totalAmount: 2,
      invoiceDate: '2026-04-01',
      remark: '首张发票',
    })
  })

  it('applies invoice amount result back into the form and formats the active date label', () => {
    const form = createInvoiceForm(10)
    applyInvoiceAmountResult(form, {
      noTaxAmount: 1.835,
      taxAmount: 0.165,
      totalAmount: 2,
    })

    expect(form).toMatchObject({
      projectId: 10,
      invoiceAmount: 1.835,
      taxAmount: 0.165,
      totalAmount: 2,
    })
    expect(getFilterDateLabel(null)).toBe('全部日期')
    expect(getFilterDateLabel(['2026-04-01', '2026-04-30'])).toBe('2026-04-01 至 2026-04-30')
  })

  it('builds payment and invoice table summaries with aligned totals', () => {
    const paymentSummary = buildPaymentTableSummary({
      columns: [{}, { property: 'paymentDate' }, { property: 'amount' }],
      data: [
        createPayment({ id: 1, amount: 2 }),
        createPayment({ id: 2, amount: 3 }),
      ],
    })

    const invoiceSummary = buildInvoiceTableSummary({
      columns: [{}, { property: 'invoiceNo' }, { property: 'invoiceAmount' }, { property: 'taxAmount' }, { property: 'totalAmount' }],
      data: [
        createInvoice({ id: 1, invoiceAmount: 1.835, taxAmount: 0.165, totalAmount: 2 }),
        createInvoice({ id: 2, invoiceAmount: 2.752, taxAmount: 0.248, totalAmount: 3 }),
      ],
    })

    expect(paymentSummary).toEqual(['', '合计', '￥5.000'])
    expect(invoiceSummary).toEqual(['', '合计', '￥4.587', '￥0.413', '￥5.000'])
  })
})
