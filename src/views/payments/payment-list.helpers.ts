import { buildInvoiceLedgerSummary, createEmptyBusinessSnapshot, type BusinessSnapshot, type InvoiceLedgerSummary } from '@/services/analytics.service'
import type { FormRules } from 'element-plus'
import type { Invoice, InvoiceType, Payment } from '@/types'
import { formatCurrency } from '@/utils/calculations'
import { invoiceTypeOptions, paymentMethodOptions } from '@/utils/format'
import { buildTableSummary, type TableSummaryParams } from '@/utils/table-summary'

export { invoiceTypeOptions, paymentMethodOptions }

export type PaymentFormState = {
  projectId: number | undefined
  paymentDate: string
  amount: number
  paymentMethod: string
  referenceNo: string
  description: string
}

export type InvoiceFormState = {
  projectId: number | undefined
  invoiceNo: string
  invoiceType: InvoiceType
  invoiceAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  invoiceDate: string
  remark: string
}

export type ActiveDateRange = [string, string] | null

export interface InvoiceAmountResult {
  noTaxAmount: number
  taxAmount: number
  totalAmount: number
}

export const emptySnapshot: BusinessSnapshot = createEmptyBusinessSnapshot()

export const paymentRules: FormRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  paymentDate: [{ required: true, message: '请选择收款日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入收款金额', trigger: 'blur' }],
  paymentMethod: [{ required: true, message: '请选择收款方式', trigger: 'change' }],
}

export const invoiceRules: FormRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  invoiceNo: [{ required: true, message: '请输入发票号码', trigger: 'blur' }],
  invoiceType: [{ required: true, message: '请选择发票类型', trigger: 'change' }],
  invoiceDate: [{ required: true, message: '请选择开票日期', trigger: 'change' }],
  invoiceAmount: [{ required: true, message: '请输入不含税价', trigger: 'blur' }],
  totalAmount: [{ required: true, message: '请输入价税合计', trigger: 'blur' }],
}

export function createPaymentForm(projectId?: number): PaymentFormState {
  return {
    projectId,
    paymentDate: '',
    amount: 0,
    paymentMethod: '银行转账',
    referenceNo: '',
    description: '',
  }
}

export function createInvoiceForm(projectId?: number): InvoiceFormState {
  return {
    projectId,
    invoiceNo: '',
    invoiceType: 'special',
    invoiceAmount: 0,
    taxRate: 9,
    taxAmount: 0,
    totalAmount: 0,
    invoiceDate: '',
    remark: '',
  }
}

export function createPaymentFormFromRow(row: Payment): PaymentFormState {
  return {
    projectId: row.projectId,
    paymentDate: row.paymentDate,
    amount: row.amount,
    paymentMethod: row.paymentMethod,
    referenceNo: row.referenceNo,
    description: row.description,
  }
}

export function createInvoiceFormFromRow(row: Invoice): InvoiceFormState {
  return {
    projectId: row.projectId,
    invoiceNo: row.invoiceNo,
    invoiceType: row.invoiceType,
    invoiceAmount: row.invoiceAmount,
    taxRate: row.taxRate,
    taxAmount: row.taxAmount,
    totalAmount: row.totalAmount,
    invoiceDate: row.invoiceDate,
    remark: row.remark,
  }
}

export function applyInvoiceAmountResult(form: InvoiceFormState, result: InvoiceAmountResult): void {
  form.invoiceAmount = result.noTaxAmount
  form.taxAmount = result.taxAmount
  form.totalAmount = result.totalAmount
}

export function getFilterDateLabel(dateRange: ActiveDateRange): string {
  if (!dateRange || dateRange.length !== 2) return '全部日期'
  return `${dateRange[0]} 至 ${dateRange[1]}`
}

export function buildPaymentTableSummary(param: TableSummaryParams<Payment>) {
  return buildTableSummary(param, {
    formatters: {
      amount: total => formatCurrency(total),
    },
  })
}

export function buildInvoiceTableSummary(param: TableSummaryParams<Invoice>) {
  const summary: InvoiceLedgerSummary = buildInvoiceLedgerSummary(param.data)
  return buildTableSummary(param, {
    formatters: {
      invoiceAmount: () => formatCurrency(summary.noTaxAmount),
      taxAmount: () => formatCurrency(summary.taxAmount),
      totalAmount: () => formatCurrency(summary.totalAmount),
    },
  })
}
