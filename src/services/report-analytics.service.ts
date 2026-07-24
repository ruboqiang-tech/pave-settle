import type { Invoice, Payment, Project, Settlement } from '@/types'
import { roundAmount } from '@/utils/calculations'
import {
  createContractAmountMap,
  createContractNoTaxAmountMap,
  createContractTaxAmountMap,
  createInvoicedAmountMap,
  createReceivedAmountMap,
  createSettledAmountMap,
  getProjectNameMap,
  matchesProject,
  sumRows,
  withinDateRange,
  type BusinessSnapshot,
} from './analytics-core.service'

export interface ProjectSummaryRow {
  projectId: number
  projectCode: string
  projectName: string
  projectType: Project['projectType']
  status: Project['status']
  noTaxContractAmount: number
  contractAmount: number
  contractTaxAmount: number
  settledAmount: number
  settlementRatio: string
  unsettledAmount: number
}

export interface SettlementReportRow {
  settlementNo: string
  projectName: string
  settlementType: Settlement['settlementType']
  startDate: string
  endDate: string
  baseAmount: number
  adjustment: number
  deductionAmount: number
  currentAmount: number
  status: Settlement['status']
}

export interface ReceivableRow {
  projectId: number
  projectName: string
  noTaxContractAmount: number
  contractAmount: number
  contractTaxAmount: number
  settledAmount: number
  receivedAmount: number
  unreceivedAmount: number
  invoicedAmount: number
  invoiceGap: number
  settleRatio: string
  receiveRatio: string
}

export interface PaymentSummary {
  totalSettled: number
  totalReceived: number
  totalUnreceived: number
  totalInvoiced: number
}

export type LedgerDateRange = readonly [string, string] | null

export interface LedgerFilters {
  projectId?: number
  dateRange?: LedgerDateRange
}

export interface PaymentLedgerSummary {
  count: number
  totalAmount: number
}

export interface InvoiceLedgerSummary {
  count: number
  noTaxAmount: number
  taxAmount: number
  totalAmount: number
}

export function filterReceivePayments(snapshot: BusinessSnapshot, filters: LedgerFilters = {}): Payment[] {
  return snapshot.payments.filter(payment =>
    payment.paymentType === 'receive'
    && matchesProject(payment.projectId, filters.projectId)
    && withinDateRange(payment.paymentDate, filters.dateRange)
  )
}

export function filterInvoices(snapshot: BusinessSnapshot, filters: LedgerFilters = {}): Invoice[] {
  return snapshot.invoices.filter(invoice =>
    matchesProject(invoice.projectId, filters.projectId)
    && withinDateRange(invoice.invoiceDate, filters.dateRange)
  )
}

export function buildPaymentLedgerSummary(payments: Payment[]): PaymentLedgerSummary {
  return {
    count: payments.length,
    totalAmount: sumRows(payments, payment => Number(payment.amount || 0)),
  }
}

export function buildInvoiceLedgerSummary(invoices: Invoice[]): InvoiceLedgerSummary {
  return {
    count: invoices.length,
    noTaxAmount: sumRows(invoices, invoice => Number(invoice.invoiceAmount || 0)),
    taxAmount: sumRows(invoices, invoice => Number(invoice.taxAmount || 0)),
    totalAmount: sumRows(invoices, invoice => Number(invoice.totalAmount || 0)),
  }
}

export function buildProjectSummary(snapshot: BusinessSnapshot, filterProjectId?: number): ProjectSummaryRow[] {
  const contractAmountMap = createContractAmountMap(snapshot.contracts)
  const contractNoTaxAmountMap = createContractNoTaxAmountMap(snapshot.contracts)
  const contractTaxAmountMap = createContractTaxAmountMap(snapshot.contracts)
  const settledAmountMap = createSettledAmountMap(snapshot.settlements)

  return snapshot.projects
    .filter(project => filterProjectId === undefined || project.id === filterProjectId)
    .map(project => {
      const contractAmount = contractAmountMap.get(project.id) ?? 0
      const settledAmount = settledAmountMap.get(project.id) ?? 0
      return {
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        projectType: project.projectType,
        status: project.status,
        noTaxContractAmount: roundAmount(contractNoTaxAmountMap.get(project.id) ?? 0),
        contractAmount: roundAmount(contractAmount),
        contractTaxAmount: roundAmount(contractTaxAmountMap.get(project.id) ?? 0),
        settledAmount: roundAmount(settledAmount),
        settlementRatio: (contractAmount > 0 ? (settledAmount / contractAmount) * 100 : 0).toFixed(1),
        unsettledAmount: roundAmount(Math.max(0, contractAmount - settledAmount)),
      }
    })
}

export function buildSettlementReport(snapshot: BusinessSnapshot, filterProjectId?: number): SettlementReportRow[] {
  const projectNameMap = getProjectNameMap(snapshot)

  return snapshot.settlements
    .filter(settlement => filterProjectId === undefined || settlement.projectId === filterProjectId)
    .sort((left, right) => {
      const startDateDiff = left.startDate.localeCompare(right.startDate)
      if (startDateDiff !== 0) return startDateDiff
      const endDateDiff = left.endDate.localeCompare(right.endDate)
      if (endDateDiff !== 0) return endDateDiff
      return left.settlementNo.localeCompare(right.settlementNo)
    })
    .map(settlement => {
      const adjustment = settlement.materialAdjustment + settlement.changeAmount + settlement.surchargeAmount
      const baseAmount = roundAmount(Math.max(0, settlement.currentAmount - adjustment + settlement.deductionAmount))
      return {
        settlementNo: settlement.settlementNo,
        projectName: projectNameMap.get(settlement.projectId) ?? '-',
        settlementType: settlement.settlementType,
        startDate: settlement.startDate,
        endDate: settlement.endDate,
        baseAmount,
        adjustment: roundAmount(adjustment),
        deductionAmount: roundAmount(settlement.deductionAmount),
        currentAmount: roundAmount(settlement.currentAmount),
        status: settlement.status,
      }
    })
}

export function buildReceivableRows(snapshot: BusinessSnapshot, filterProjectId?: number): ReceivableRow[] {
  const invoicedAmountMap = createInvoicedAmountMap(snapshot.invoices)
  const receivedAmountMap = createReceivedAmountMap(snapshot.payments)

  return buildProjectSummary(snapshot, filterProjectId).map(project => {
    const receivedAmount = receivedAmountMap.get(project.projectId) ?? 0
    const invoicedAmount = invoicedAmountMap.get(project.projectId) ?? 0
    return {
      projectId: project.projectId,
      projectName: project.projectName,
      noTaxContractAmount: project.noTaxContractAmount,
      contractAmount: project.contractAmount,
      contractTaxAmount: project.contractTaxAmount,
      settledAmount: project.settledAmount,
      receivedAmount: roundAmount(receivedAmount),
      unreceivedAmount: roundAmount(Math.max(0, project.settledAmount - receivedAmount)),
      invoicedAmount: roundAmount(invoicedAmount),
      invoiceGap: roundAmount(Math.max(0, project.settledAmount - invoicedAmount)),
      settleRatio: project.settlementRatio,
      receiveRatio: (project.settledAmount > 0 ? (receivedAmount / project.settledAmount) * 100 : 0).toFixed(1),
    }
  })
}

export function buildReceivableSummary(rows: ReceivableRow[]) {
  const totalSettled = sumRows(rows, row => row.settledAmount)
  const totalReceived = sumRows(rows, row => row.receivedAmount)
  const totalInvoiced = sumRows(rows, row => row.invoicedAmount)

  return {
    totalSettled,
    totalReceived,
    totalUnreceived: roundAmount(Math.max(0, totalSettled - totalReceived)),
    totalInvoiced,
    receiveRatio: (totalSettled > 0 ? (totalReceived / totalSettled) * 100 : 0).toFixed(1),
  }
}

export function buildPaymentSummary(snapshot: BusinessSnapshot, filterProjectId?: number): PaymentSummary {
  const rows = buildReceivableRows(snapshot, filterProjectId)
  const totalSettled = sumRows(rows, row => row.settledAmount)
  const totalReceived = sumRows(rows, row => row.receivedAmount)
  const totalInvoiced = sumRows(rows, row => row.invoicedAmount)

  return {
    totalSettled,
    totalReceived,
    totalUnreceived: roundAmount(Math.max(0, totalSettled - totalReceived)),
    totalInvoiced,
  }
}
