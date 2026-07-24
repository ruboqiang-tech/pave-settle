import type { FormRules } from 'element-plus'
import type { BillOfQuantities, Contract, Project, ProjectStatus, Settlement } from '@/types'
import { formatAmount } from '@/utils/calculations'
import { formatQuantity } from '@/utils/format'
import { summarizeBoqAmounts } from '@/utils/boq'
import { buildTableSummary, createSummaryFormatters, type TableSummaryParams } from '@/utils/table-summary'

export type EditableBoqItem = Omit<BillOfQuantities, 'id'> & { id?: number }

export interface ContractEditForm {
  contractNo: string
  contractName: string
  contractDate: string
  summary: string
}

export interface ProjectEditForm {
  code: string
  name: string
  location: string
  ownerUnit: string
  generalContractor: string
  status: ProjectStatus
  plannedEndDate: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export const contractRules: FormRules = {
  contractNo: [{ required: true, message: '请输入合同编号', trigger: 'blur' }],
  contractName: [{ required: true, message: '请输入合同名称', trigger: 'blur' }],
  contractDate: [{ required: true, message: '请选择签订日期', trigger: 'change' }],
}

export function createContractEditForm(contract?: Partial<Contract>): ContractEditForm {
  return {
    contractNo: contract?.contractNo || '',
    contractName: contract?.contractName || '',
    contractDate: contract?.contractDate || '',
    summary: contract?.summary || '',
  }
}

export function createProjectEditForm(project: Project | null): ProjectEditForm {
  return {
    code: project?.code || '',
    name: project?.name || '',
    location: project?.location || '',
    ownerUnit: project?.ownerUnit || '',
    generalContractor: project?.generalContractor || '',
    status: project?.status || 'preparing',
    plannedEndDate: project?.plannedEndDate || '',
    difficulty: project?.difficulty || 'medium',
  }
}

export function getStatusType(status: ProjectStatus): 'info' | 'warning' | 'success' | undefined {
  const map: Record<ProjectStatus, 'info' | 'warning' | 'success' | undefined> = {
    preparing: 'info',
    in_progress: undefined,
    settling: 'warning',
    completed: 'success',
  }
  return map[status]
}

export function getStatusText(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    preparing: '准备中',
    in_progress: '施工中',
    settling: '结算中',
    completed: '已完工',
  }
  return map[status]
}

export function summarizeContractAmounts(items: EditableBoqItem[]) {
  return summarizeBoqAmounts(items)
}

export function buildBoqSummary(param: TableSummaryParams<Partial<BillOfQuantities>>) {
  return buildTableSummary(param, {
    label: '合计',
    formatters: {
      quantity: formatQuantity,
      ...createSummaryFormatters<Partial<BillOfQuantities>>(
        ['noTaxTotalPrice', 'taxAmount', 'totalPrice'],
        formatAmount,
      ),
    },
  })
}


export function buildSettlementSummary(param: TableSummaryParams<Settlement>) {
  return buildTableSummary(param, {
    labelColumnIndex: null,
    formatters: {
      ...createSummaryFormatters<Settlement>(['currentAmount', 'currentCumulative'], formatAmount),
    },
  })
}
