import type { FormRules } from 'element-plus'
import { roundAmount } from '@/utils/calculations'
import type { Contract, Project, Settlement, SettlementStatus, SettlementType } from '@/types'
import {
  settlementStatusOptions,
  settlementStatusTextMap,
  settlementStatusTypeMap,
  settlementTypeOptions,
  settlementTypeTextMap,
} from '@/utils/format'

export {
  settlementStatusOptions,
  settlementStatusTextMap,
  settlementStatusTypeMap,
  settlementTypeOptions,
  settlementTypeTextMap,
}

export interface SettlementCreateFormState {
  projectId: number | undefined
  contractIds: number[]
  settlementType: SettlementType
  dateRange: string[] | null
}

export interface SettlementListFilters {
  searchQuery: string
  status: SettlementStatus | ''
  settlementType: SettlementType | ''
  projectId: number | undefined
}

export interface SettlementListRow extends Settlement {
  projectName: string
  contractNames: string[]
  contractNamesText: string
  contractCount: number
}

export interface SettlementListSummary {
  totalCount: number
  draftCount: number
  effectiveCount: number
  approvedCount: number
  effectiveAmount: number
}

export const createRules: FormRules = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  contractIds: [{ required: true, type: 'array', min: 1, message: '请至少选择一份合同', trigger: 'change' }],
  settlementType: [{ required: true, message: '请选择结算类型', trigger: 'change' }],
  dateRange: [{ required: true, message: '请选择结算期间', trigger: 'change' }],
}

function isEffectiveSettlement(status: SettlementStatus) {
  return status === 'confirmed' || status === 'approved'
}

export function createSettlementCreateForm(): SettlementCreateFormState {
  return {
    projectId: undefined,
    contractIds: [],
    settlementType: 'interim',
    dateRange: null,
  }
}

export function buildSettlementListRows(
  settlements: Settlement[],
  projects: Project[],
  contracts: Contract[],
): SettlementListRow[] {
  const projectNameMap = new Map(projects.map(project => [project.id, project.name]))
  const contractNameMap = new Map(contracts.map(contract => [contract.id, `${contract.contractNo} - ${contract.contractName}`]))

  return settlements.map(settlement => {
    const contractNames = settlement.contractIds
      .map(contractId => contractNameMap.get(contractId))
      .filter((value): value is string => typeof value === 'string' && value.length > 0)

    return {
      ...settlement,
      projectName: projectNameMap.get(settlement.projectId) || '-',
      contractNames,
      contractNamesText: contractNames.join(' / '),
      contractCount: contractNames.length,
    }
  })
}

export function filterSettlementRows(rows: SettlementListRow[], filters: SettlementListFilters): SettlementListRow[] {
  const query = filters.searchQuery.trim().toLowerCase()

  return rows.filter(row => {
    const matchesQuery = !query || [row.settlementNo, row.projectName, row.contractNamesText]
      .some(value => String(value || '').toLowerCase().includes(query))
    const matchesStatus = !filters.status || row.status === filters.status
    const matchesType = !filters.settlementType || row.settlementType === filters.settlementType
    const matchesProject = filters.projectId === undefined || row.projectId === filters.projectId
    return matchesQuery && matchesStatus && matchesType && matchesProject
  })
}

export function buildSettlementListSummary(rows: SettlementListRow[]): SettlementListSummary {
  const effectiveRows = rows.filter(row => isEffectiveSettlement(row.status))

  return {
    totalCount: rows.length,
    draftCount: rows.filter(row => row.status === 'draft').length,
    effectiveCount: effectiveRows.length,
    approvedCount: rows.filter(row => row.status === 'approved').length,
    effectiveAmount: roundAmount(effectiveRows.reduce((sum, row) => sum + row.currentAmount, 0)),
  }
}
