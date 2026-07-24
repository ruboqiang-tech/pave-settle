import type { Contract, Invoice, Payment, Project, Settlement } from '@/types'
import { roundAmount } from '@/utils/calculations'
import { contractService } from './contract.service'
import { invoiceService } from './invoice.service'
import { paymentService } from './payment.service'
import { projectService } from './project.service'
import { settlementService } from './settlement.service'

export interface BusinessSnapshot {
  projects: Project[]
  contracts: Contract[]
  settlements: Settlement[]
  payments: Payment[]
  invoices: Invoice[]
}

export function createEmptyBusinessSnapshot(): BusinessSnapshot {
  return {
    projects: [],
    contracts: [],
    settlements: [],
    payments: [],
    invoices: [],
  }
}

export async function loadBusinessSnapshot(): Promise<BusinessSnapshot> {
  const [projects, contracts, settlements, payments, invoices] = await Promise.all([
    projectService.getAll(),
    contractService.getAll(),
    settlementService.getAll(),
    paymentService.getAll(),
    invoiceService.getAll(),
  ])

  return { projects, contracts, settlements, payments, invoices }
}

export function getProjectNameMap(snapshot: BusinessSnapshot): Map<number, string> {
  return new Map(snapshot.projects.map(project => [project.id, project.name]))
}

export function isSettledStatus(status: Settlement['status']): boolean {
  return status === 'confirmed' || status === 'approved'
}

export function monthKey(dateText: string): string {
  return dateText.slice(0, 7)
}

export function yearKey(dateText: string): string {
  return dateText.slice(0, 4)
}

export function matchesProject(projectId: number, filterProjectId?: number): boolean {
  return filterProjectId === undefined || projectId === filterProjectId
}

export function withinDateRange(dateText: string, dateRange?: readonly [string, string] | null): boolean {
  if (!dateRange || dateRange.length !== 2) return true
  const [start, end] = dateRange
  return dateText >= start && dateText <= end
}

export function sumRows<T>(rows: T[], getter: (row: T) => number): number {
  return roundAmount(rows.reduce((sum, row) => sum + getter(row), 0))
}

export function createContractAmountMap(contracts: Contract[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const contract of contracts) {
    totals.set(contract.projectId, (totals.get(contract.projectId) ?? 0) + contract.contractAmount)
  }
  return totals
}

export function createContractNoTaxAmountMap(contracts: Contract[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const contract of contracts) {
    totals.set(contract.projectId, (totals.get(contract.projectId) ?? 0) + contract.noTaxAmount)
  }
  return totals
}

export function createContractTaxAmountMap(contracts: Contract[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const contract of contracts) {
    totals.set(contract.projectId, (totals.get(contract.projectId) ?? 0) + contract.taxAmount)
  }
  return totals
}

export function createSettledAmountMap(settlements: Settlement[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const settlement of settlements) {
    if (!isSettledStatus(settlement.status)) continue
    totals.set(settlement.projectId, roundAmount((totals.get(settlement.projectId) ?? 0) + settlement.currentAmount))
  }
  return totals
}

export function createReceivedAmountMap(payments: Payment[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const payment of payments) {
    if (payment.paymentType !== 'receive') continue
    totals.set(payment.projectId, roundAmount((totals.get(payment.projectId) ?? 0) + payment.amount))
  }
  return totals
}

export function createInvoicedAmountMap(invoices: Invoice[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const invoice of invoices) {
    totals.set(invoice.projectId, roundAmount((totals.get(invoice.projectId) ?? 0) + invoice.totalAmount))
  }
  return totals
}
