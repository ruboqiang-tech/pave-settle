import { loadBusinessSnapshot, type BusinessSnapshot } from './analytics.service'
import { invoiceService } from './invoice.service'
import { paymentService } from './payment.service'
import { mutateAndReloadSnapshot } from './snapshot-mutation'
import type { Invoice, Payment } from '@/types'

export interface ReceivePaymentUpsertInput {
  projectId: number
  paymentDate: string
  amount: number
  paymentMethod: string
  referenceNo: string
  description: string
}

export interface InvoiceLedgerUpsertInput {
  projectId: number
  invoiceNo: string
  invoiceType: Invoice['invoiceType']
  invoiceAmount: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  invoiceDate: string
  remark: string
}

async function reloadLedgerSnapshot(): Promise<BusinessSnapshot> {
  return loadBusinessSnapshot()
}

export async function loadPaymentLedgerSnapshot(): Promise<BusinessSnapshot> {
  return reloadLedgerSnapshot()
}

export async function saveReceivePayment(
  input: ReceivePaymentUpsertInput,
  paymentId?: number | null,
): Promise<BusinessSnapshot> {
  return mutateAndReloadSnapshot(
    () => {
      const payload = {
        ...input,
        paymentType: 'receive' as const,
      }

      return paymentId != null
        ? paymentService.update(paymentId, payload)
        : paymentService.create(payload)
    },
    reloadLedgerSnapshot,
  )
}

export async function deleteReceivePayment(paymentId: number): Promise<BusinessSnapshot> {
  return mutateAndReloadSnapshot(
    () => paymentService.delete(paymentId),
    reloadLedgerSnapshot,
  )
}

export async function saveLedgerInvoice(
  input: InvoiceLedgerUpsertInput,
  invoiceId?: number | null,
): Promise<BusinessSnapshot> {
  return mutateAndReloadSnapshot(
    () => (invoiceId != null ? invoiceService.update(invoiceId, input) : invoiceService.create(input)),
    reloadLedgerSnapshot,
  )
}

export async function voidLedgerInvoice(invoiceId: number): Promise<BusinessSnapshot> {
  return mutateAndReloadSnapshot(
    () => invoiceService.delete(invoiceId),
    reloadLedgerSnapshot,
  )
}
