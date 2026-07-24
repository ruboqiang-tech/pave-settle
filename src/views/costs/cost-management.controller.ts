import type { CostPhase, ProjectCostEntry } from '@/services/costing.service'
import { projectCostService, type ProjectCostSaveInput } from '@/services/project-cost.service'
import {
  loadCostManagementSnapshot,
  type CostManagementSnapshot,
} from './cost-management.service'

export type CostManagementControllerResult<T> =
  | {
    type: 'success'
    data: T
    successMessage: string
  }
  | {
    type: 'warning'
    message: string
  }

function hasCostEntryContent(item: Partial<ProjectCostEntry>): boolean {
  return Boolean(
    item.itemName?.trim()
    || item.spec?.trim()
    || item.unit?.trim()
    || item.occurredOn?.trim()
    || item.note?.trim()
    || Number(item.quantity || 0) !== 0
    || Number(item.unitCost || 0) !== 0
    || Number(item.amount || 0) !== 0,
  )
}

function resolveEditableCostEntries(
  items: ProjectCostEntry[],
): CostManagementControllerResult<ProjectCostSaveInput[]> {
  const filledItems = items.filter(hasCostEntryContent)

  for (const item of filledItems) {
    if (!item.itemName?.trim()) {
      return {
        type: 'warning',
        message: '成本项目名称不能为空',
      }
    }
    if (Number(item.amount || 0) < 0) {
      return {
        type: 'warning',
        message: '成本金额不能小于 0',
      }
    }
  }

  return {
    type: 'success',
    data: filledItems.map(item => ({
      id: item.id,
      category: item.category,
      itemName: item.itemName?.trim() || '',
      spec: item.spec?.trim() || '',
      unit: item.unit?.trim() || '',
      quantity: Number(item.quantity || 0),
      unitCost: Number(item.unitCost || 0),
      amount: Number(item.amount || 0),
      occurredOn: item.occurredOn || '',
      note: item.note?.trim() || '',
    })),
    successMessage: '',
  }
}

export async function loadCostManagementPage(projectId?: number): Promise<CostManagementSnapshot> {
  return loadCostManagementSnapshot(projectId)
}

export async function saveCostManagementPhase(
  projectId: number,
  phase: CostPhase,
  items: ProjectCostEntry[],
): Promise<CostManagementControllerResult<ProjectCostEntry[]>> {
  const normalizedItems = resolveEditableCostEntries(items)
  if (normalizedItems.type === 'warning') {
    return normalizedItems
  }

  const data = await projectCostService.saveByProjectAndPhase(projectId, phase, normalizedItems.data)

  return {
    type: 'success',
    data,
    successMessage: phase === 'budget' ? '成本预算已保存' : '成本核算已保存',
  }
}
