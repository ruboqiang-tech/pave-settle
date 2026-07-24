import type { BusinessSnapshot } from '@/services/analytics.service'
import {
  deleteReceivePayment,
  loadPaymentLedgerSnapshot,
  saveLedgerInvoice,
  saveReceivePayment,
  voidLedgerInvoice,
  type InvoiceLedgerUpsertInput,
  type ReceivePaymentUpsertInput,
} from '@/services/payment-ledger.service'
import type { InvoiceFormState, PaymentFormState } from './payment-list.helpers'

export interface PaymentListMutationResult {
  snapshot: BusinessSnapshot
  successMessage: string
}

function toReceivePaymentInput(form: PaymentFormState): ReceivePaymentUpsertInput {
  return {
    ...form,
    projectId: form.projectId || 0,
  }
}

function toInvoiceLedgerInput(form: InvoiceFormState): InvoiceLedgerUpsertInput {
  return {
    ...form,
    projectId: form.projectId || 0,
  }
}

export async function loadPaymentListSnapshot(): Promise<BusinessSnapshot> {
  return loadPaymentLedgerSnapshot()
}

export async function savePaymentListPayment(
  form: PaymentFormState,
  editId?: number | null,
): Promise<PaymentListMutationResult> {
  const snapshot = await saveReceivePayment(toReceivePaymentInput(form), editId)
  return {
    snapshot,
    successMessage: editId != null ? '收款记录已更新' : '收款记录已新增',
  }
}

export async function deletePaymentListPayment(id: number): Promise<PaymentListMutationResult> {
  const snapshot = await deleteReceivePayment(id)
  return {
    snapshot,
    successMessage: '收款记录已删除',
  }
}

export async function savePaymentListInvoice(
  form: InvoiceFormState,
  editId?: number | null,
): Promise<PaymentListMutationResult> {
  const snapshot = await saveLedgerInvoice(toInvoiceLedgerInput(form), editId)
  return {
    snapshot,
    successMessage: editId != null ? '发票已更新' : '发票已新增',
  }
}

export async function voidPaymentListInvoice(id: number): Promise<PaymentListMutationResult> {
  const snapshot = await voidLedgerInvoice(id)
  return {
    snapshot,
    successMessage: '发票已作废',
  }
}
