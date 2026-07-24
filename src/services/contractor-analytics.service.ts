import type { Project } from '@/types'
import { roundAmount } from '@/utils/calculations'
import {
  createContractAmountMap,
  createInvoicedAmountMap,
  createReceivedAmountMap,
  createSettledAmountMap,
  type BusinessSnapshot,
} from './analytics-core.service'

export interface ContractorProjectSummary {
  projectId: number
  projectName: string
  projectCode: string
  status: Project['status']
  contractAmount: number
  settledAmount: number
  receivedAmount: number
  unreceivedAmount: number
  invoicedAmount: number
  settlementRatio: string
  receiveRatio: string
}

export interface ContractorSummaryRow {
  contractorName: string
  projectCount: number
  contractAmount: number
  settledAmount: number
  receivedAmount: number
  unreceivedAmount: number
  invoicedAmount: number
  invoiceGap: number
  settlementRatio: string
  receiveRatio: string
  projects: ContractorProjectSummary[]
}

export interface ContractorOverallSummary {
  totalContractors: number
  totalProjects: number
  totalContractAmount: number
  totalSettled: number
  totalReceived: number
  totalUnreceived: number
  totalInvoiced: number
}

interface ContractorAggregate {
  projectCount: number
  contractAmount: number
  settledAmount: number
  receivedAmount: number
  invoicedAmount: number
  projects: ContractorProjectSummary[]
}

export function buildContractorSummary(snapshot: BusinessSnapshot): ContractorSummaryRow[] {
  const contractAmountMap = createContractAmountMap(snapshot.contracts)
  const settledAmountMap = createSettledAmountMap(snapshot.settlements)
  const receivedAmountMap = createReceivedAmountMap(snapshot.payments)
  const invoicedAmountMap = createInvoicedAmountMap(snapshot.invoices)

  const map = new Map<string, ContractorAggregate>()

  for (const project of snapshot.projects) {
    const contractor = project.generalContractor || '未填写总包单位'
    const cAmount = contractAmountMap.get(project.id) ?? 0
    const sAmount = settledAmountMap.get(project.id) ?? 0
    const rAmount = receivedAmountMap.get(project.id) ?? 0
    const iAmount = invoicedAmountMap.get(project.id) ?? 0

    const existing = map.get(contractor) ?? {
      projectCount: 0,
      contractAmount: 0,
      settledAmount: 0,
      receivedAmount: 0,
      invoicedAmount: 0,
      projects: [],
    }
    existing.projectCount += 1
    existing.contractAmount += cAmount
    existing.settledAmount += sAmount
    existing.receivedAmount += rAmount
    existing.invoicedAmount += iAmount
    existing.projects.push({
      projectId: project.id,
      projectName: project.name,
      projectCode: project.code,
      status: project.status,
      contractAmount: cAmount,
      settledAmount: sAmount,
      receivedAmount: rAmount,
      unreceivedAmount: roundAmount(Math.max(0, sAmount - rAmount)),
      invoicedAmount: iAmount,
      settlementRatio: (cAmount > 0 ? (sAmount / cAmount) * 100 : 0).toFixed(1),
      receiveRatio: (sAmount > 0 ? (rAmount / sAmount) * 100 : 0).toFixed(1),
    })
    map.set(contractor, existing)
  }

  return Array.from(map.entries()).map(([contractorName, data]) => {
    const settleRatio = data.contractAmount > 0 ? (data.settledAmount / data.contractAmount) * 100 : 0
    const receiveRatio = data.settledAmount > 0 ? (data.receivedAmount / data.settledAmount) * 100 : 0
    return {
      contractorName,
      projectCount: data.projectCount,
      contractAmount: roundAmount(data.contractAmount),
      settledAmount: roundAmount(data.settledAmount),
      receivedAmount: roundAmount(data.receivedAmount),
      unreceivedAmount: roundAmount(Math.max(0, data.settledAmount - data.receivedAmount)),
      invoicedAmount: roundAmount(data.invoicedAmount),
      invoiceGap: roundAmount(Math.max(0, data.settledAmount - data.invoicedAmount)),
      settlementRatio: settleRatio.toFixed(1),
      receiveRatio: receiveRatio.toFixed(1),
      projects: data.projects,
    }
  }).sort((left, right) => right.contractAmount - left.contractAmount)
}

export function buildContractorOverallSummary(rows: ContractorSummaryRow[]): ContractorOverallSummary {
  return {
    totalContractors: rows.length,
    totalProjects: rows.reduce((sum, row) => sum + row.projectCount, 0),
    totalContractAmount: roundAmount(rows.reduce((sum, row) => sum + row.contractAmount, 0)),
    totalSettled: roundAmount(rows.reduce((sum, row) => sum + row.settledAmount, 0)),
    totalReceived: roundAmount(rows.reduce((sum, row) => sum + row.receivedAmount, 0)),
    totalUnreceived: roundAmount(rows.reduce((sum, row) => sum + row.unreceivedAmount, 0)),
    totalInvoiced: roundAmount(rows.reduce((sum, row) => sum + row.invoicedAmount, 0)),
  }
}
