import type { FormRules } from 'element-plus'
import type { BusinessSnapshot } from '@/services/analytics.service'
import { calculateSettlementRatio, roundAmount } from '@/utils/calculations'
import { getNextProjectCode } from '@/utils/numbering'
import type { Contract, Payment, Project, ProjectStatus, ProjectType, Settlement } from '@/types'
import {
  projectStatusOptions,
  projectStatusTextMap,
  projectStatusTypeMap,
  projectTypeOptions,
  projectTypeTextMap,
} from '@/utils/format'

export {
  projectStatusOptions,
  projectStatusTextMap,
  projectStatusTypeMap,
  projectTypeOptions,
  projectTypeTextMap,
}

export interface ProjectFormState {
  code: string
  name: string
  projectType: ProjectType
  location: string
  ownerUnit: string
  generalContractor: string
  startDate: string
  plannedEndDate: string
  status: ProjectStatus
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface ProjectListRow extends Project {
  contractAmount: number
  settledAmount: number
  receivedAmount: number
  unreceivedAmount: number
  settlementRatio: number
}

export interface ProjectListFilters {
  searchQuery: string
  status: ProjectStatus | ''
  projectType: ProjectType | ''
}

export interface ProjectListSummary {
  totalCount: number
  preparingCount: number
  inProgressCount: number
  settlingCount: number
  completedCount: number
  contractAmount: number
  settledAmount: number
  receivedAmount: number
  unreceivedAmount: number
}

export const projectRules: FormRules = {
  code: [{ required: true, message: '请输入项目编号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  projectType: [{ required: true, message: '请选择工程类型', trigger: 'change' }],
  startDate: [{ required: true, message: '请选择开工日期', trigger: 'change' }],
  status: [{ required: true, message: '请选择项目状态', trigger: 'change' }],
}

function isEffectiveSettlement(status: Settlement['status']) {
  return status === 'confirmed' || status === 'approved'
}

function sumProjectValues<T extends { projectId: number }>(
  rows: T[],
  getValue: (row: T) => number,
): Map<number, number> {
  const totals = new Map<number, number>()
  for (const row of rows) {
    totals.set(row.projectId, roundAmount((totals.get(row.projectId) ?? 0) + Number(getValue(row) || 0)))
  }
  return totals
}

export function createProjectForm(project?: Partial<Project>): ProjectFormState {
  return {
    code: project?.code || '',
    name: project?.name || '',
    projectType: project?.projectType || 'highway',
    location: project?.location || '',
    ownerUnit: project?.ownerUnit || '',
    generalContractor: project?.generalContractor || '',
    startDate: project?.startDate || '',
    plannedEndDate: project?.plannedEndDate || '',
    status: project?.status || 'preparing',
    difficulty: project?.difficulty || 'medium',
  }
}

export function suggestNextProjectCode(projects: Array<Pick<Project, 'code'>>): string {
  return getNextProjectCode(projects.map(project => project.code))
}

export function buildProjectListRows(
  snapshot: Pick<BusinessSnapshot, 'projects' | 'contracts' | 'settlements' | 'payments'>,
): ProjectListRow[] {
  const contractAmountMap = sumProjectValues(snapshot.contracts, (contract: Contract) => contract.contractAmount)
  const settledAmountMap = sumProjectValues(
    snapshot.settlements.filter(settlement => isEffectiveSettlement(settlement.status)),
    (settlement: Settlement) => settlement.currentAmount,
  )
  const receivedAmountMap = sumProjectValues(
    snapshot.payments.filter(payment => payment.paymentType === 'receive'),
    (payment: Payment) => payment.amount,
  )

  return snapshot.projects.map(project => {
    const contractAmount = roundAmount(contractAmountMap.get(project.id) ?? 0)
    const settledAmount = roundAmount(settledAmountMap.get(project.id) ?? 0)
    const receivedAmount = roundAmount(receivedAmountMap.get(project.id) ?? 0)

    return {
      ...project,
      contractAmount,
      settledAmount,
      receivedAmount,
      unreceivedAmount: roundAmount(settledAmount - receivedAmount),
      settlementRatio: calculateSettlementRatio(settledAmount, contractAmount),
    }
  })
}

export function filterProjectRows(rows: ProjectListRow[], filters: ProjectListFilters): ProjectListRow[] {
  const query = filters.searchQuery.trim().toLowerCase()

  return rows.filter(row => {
    const matchesQuery = !query || [row.name, row.code, row.ownerUnit, row.generalContractor]
      .some(value => String(value || '').toLowerCase().includes(query))
    const matchesStatus = !filters.status || row.status === filters.status
    const matchesType = !filters.projectType || row.projectType === filters.projectType
    return matchesQuery && matchesStatus && matchesType
  })
}

export function buildProjectListSummary(rows: ProjectListRow[]): ProjectListSummary {
  return {
    totalCount: rows.length,
    preparingCount: rows.filter(row => row.status === 'preparing').length,
    inProgressCount: rows.filter(row => row.status === 'in_progress').length,
    settlingCount: rows.filter(row => row.status === 'settling').length,
    completedCount: rows.filter(row => row.status === 'completed').length,
    contractAmount: roundAmount(rows.reduce((sum, row) => sum + row.contractAmount, 0)),
    settledAmount: roundAmount(rows.reduce((sum, row) => sum + row.settledAmount, 0)),
    receivedAmount: roundAmount(rows.reduce((sum, row) => sum + row.receivedAmount, 0)),
    unreceivedAmount: roundAmount(rows.reduce((sum, row) => sum + row.unreceivedAmount, 0)),
  }
}
