import { contractAttachmentManagerService } from '@/services/attachment-manager.service'
import {
  createProjectContractWithBoq,
  deleteProjectContractAndReloadSettlements,
  loadProjectDetailSnapshot,
  updateProjectBasics,
  updateProjectContractWithBoq,
  type ProjectContractMutationResult,
  type ProjectDetailSnapshot,
} from '@/services/project-detail.service'
import {
  downloadProjectBoqImportTemplate,
  exportProjectBoqSpreadsheet,
  importProjectBoqCsvRows,
} from '@/services/spreadsheet.service'
import type { Contract, Project, Settlement } from '@/types'
import { buildSaveFileSuccessMessage, type SaveFileResult } from '@/utils/file-download'
import {
  getFilledBoqItems,
  parseImportedBoqRows,
  validateBoqItems,
} from '@/utils/boq'
import type {
  ContractEditForm,
  EditableBoqItem,
  ProjectEditForm,
} from './project-detail.helpers'

export const projectDetailAttachmentAdapter = contractAttachmentManagerService

export type ProjectDetailControllerResult<T> =
  | {
    type: 'success'
    data: T
    successMessage: string
  }
  | {
    type: 'warning'
    message: string
  }

function resolveEditableBoqItems(items: EditableBoqItem[]): ProjectDetailControllerResult<EditableBoqItem[]> {
  const filledItems = getFilledBoqItems(items) as EditableBoqItem[]
  const validationError = validateBoqItems(filledItems)
  if (validationError) {
    return {
      type: 'warning',
      message: validationError,
    }
  }

  return {
    type: 'success',
    data: filledItems,
    successMessage: '',
  }
}

export async function loadProjectDetailPage(projectId: number): Promise<ProjectDetailSnapshot | null> {
  return loadProjectDetailSnapshot(projectId)
}

export async function loadProjectDetailAttachmentCount(contractId: number): Promise<number> {
  const attachments = await contractAttachmentManagerService.getList(contractId)
  return attachments.length
}

export async function saveProjectDetailContract(
  projectId: number,
  contractId: number,
  form: ContractEditForm,
  items: EditableBoqItem[],
): Promise<ProjectDetailControllerResult<ProjectContractMutationResult>> {
  const normalizedItems = resolveEditableBoqItems(items)
  if (normalizedItems.type === 'warning') {
    return normalizedItems
  }

  const data = await updateProjectContractWithBoq(contractId, {
    projectId,
    contractNo: form.contractNo,
    contractName: form.contractName,
    contractDate: form.contractDate,
    summary: form.summary,
    boqItems: normalizedItems.data,
  })

  return {
    type: 'success',
    data,
    successMessage: '合同已保存',
  }
}

export async function createProjectDetailContract(
  projectId: number,
  form: ContractEditForm,
  items: EditableBoqItem[],
): Promise<ProjectDetailControllerResult<ProjectContractMutationResult>> {
  const normalizedItems = resolveEditableBoqItems(items)
  if (normalizedItems.type === 'warning') {
    return normalizedItems
  }

  const data = await createProjectContractWithBoq({
    projectId,
    contractNo: form.contractNo,
    contractName: form.contractName,
    contractDate: form.contractDate,
    summary: form.summary,
    boqItems: normalizedItems.data,
  })

  return {
    type: 'success',
    data,
    successMessage: '合同已创建',
  }
}

export async function deleteProjectDetailContract(
  projectId: number,
  contractId: number,
): Promise<ProjectDetailControllerResult<Settlement[]>> {
  const data = await deleteProjectContractAndReloadSettlements(projectId, contractId)
  return {
    type: 'success',
    data,
    successMessage: '合同已删除',
  }
}

export async function importProjectDetailBoq(
  file: File,
  contractId: number,
  sortStart: number,
): Promise<ProjectDetailControllerResult<EditableBoqItem[]>> {
  const rows = await importProjectBoqCsvRows<Record<string, unknown>>(file)
  if (rows.length === 0) {
    return {
      type: 'warning',
      message: 'CSV 中没有数据',
    }
  }

  const data = parseImportedBoqRows(rows, {
    contractId,
    sortStart,
  }) as EditableBoqItem[]

  return {
    type: 'success',
    data,
    successMessage: `成功导入 ${data.length} 项`,
  }
}

export async function downloadProjectDetailBoqTemplate(): Promise<ProjectDetailControllerResult<SaveFileResult>> {
  const result = await downloadProjectBoqImportTemplate()
  if (result.canceled) {
    return {
      type: 'warning',
      message: '已取消下载模板',
    }
  }

  return {
    type: 'success',
    data: result,
    successMessage: buildSaveFileSuccessMessage(result, '模板下载'),
  }
}

export async function exportProjectDetailBoq(
  project: Project | null,
  contract: Contract,
  items: EditableBoqItem[],
): Promise<ProjectDetailControllerResult<SaveFileResult>> {
  if (items.length === 0) {
    return {
      type: 'warning',
      message: '无清单数据',
    }
  }

  const result = await exportProjectBoqSpreadsheet({
    projectCode: project?.code,
    projectName: project?.name,
    contractNo: contract.contractNo,
    contractName: contract.contractName,
    items,
  })
  if (result.canceled) {
    return {
      type: 'warning',
      message: '已取消导出',
    }
  }

  return {
    type: 'success',
    data: result,
    successMessage: buildSaveFileSuccessMessage(result),
  }
}

export async function saveProjectDetailBasics(
  projectId: number,
  form: ProjectEditForm,
): Promise<ProjectDetailControllerResult<Project>> {
  const data = await updateProjectBasics(projectId, form)
  return {
    type: 'success',
    data,
    successMessage: '项目已更新',
  }
}

export function getProjectDetailSettlementRoute(settlementId: number): string {
  return `/settlements/${settlementId}`
}

export function getProjectDetailListRoute(): string {
  return '/projects'
}
