import type { BillOfQuantities, Contract, Project, Settlement } from '@/types'
import { prepareBoqItemsForSave, recalculateBoqRow } from '@/utils/boq'
import { getNextContractNo } from '@/utils/numbering'
import { contractAttachmentService } from './attachment.service'
import { boqService, contractService } from './contract.service'
import { projectService } from './project.service'
import { settlementService } from './settlement.service'

export interface ProjectDetailContractSnapshotEntry {
  contract: Contract
  items: BillOfQuantities[]
  attachmentCount: number
}

export interface ProjectDetailSnapshot {
  project: Project
  contracts: Contract[]
  settlements: Settlement[]
  contractEntries: ProjectDetailContractSnapshotEntry[]
  nextContractNo: string
}

export interface ProjectContractUpsertInput {
  projectId: number
  contractNo: string
  contractName: string
  contractDate: string
  summary: string
  boqItems: Partial<BillOfQuantities>[]
}

export interface ProjectContractMutationResult {
  contract: Contract
  boqItems: BillOfQuantities[]
  settlements: Settlement[]
}

export interface ProjectBasicsUpdateInput {
  code: string
  name: string
  location: string
  ownerUnit: string
  generalContractor: string
  status: Project['status']
  plannedEndDate: string
  difficulty: Project['difficulty']
}

function normalizeBoqItems(items: BillOfQuantities[]): BillOfQuantities[] {
  return items.map(item => {
    const normalized = { ...item }
    recalculateBoqRow(normalized)
    return normalized as BillOfQuantities
  })
}

async function restoreContractSnapshot(contract: Contract): Promise<void> {
  await contractService.update(contract.id, {
    projectId: contract.projectId,
    contractNo: contract.contractNo,
    contractName: contract.contractName,
    contractDate: contract.contractDate,
    noTaxAmount: contract.noTaxAmount,
    contractTaxRate: contract.contractTaxRate,
    taxAmount: contract.taxAmount,
    contractAmount: contract.contractAmount,
    amountSource: contract.amountSource,
    summary: contract.summary,
  })
}

async function loadPersistedContract(contractId: number): Promise<Contract> {
  const contract = await contractService.getById(contractId)
  if (!contract) {
    throw new Error('合同保存后读取失败')
  }
  return contract
}

async function buildProjectContractMutationResult(
  contractId: number,
  projectId: number,
  boqItems: BillOfQuantities[],
): Promise<ProjectContractMutationResult> {
  return {
    contract: await loadPersistedContract(contractId),
    boqItems,
    settlements: await settlementService.getByProjectId(projectId),
  }
}

export async function loadProjectDetailSnapshot(projectId: number): Promise<ProjectDetailSnapshot | null> {
  const project = await projectService.getById(projectId)
  if (!project) return null

  const [contracts, settlements] = await Promise.all([
    contractService.getAllByProjectId(projectId),
    settlementService.getByProjectId(projectId),
  ])
  const contractEntries = await Promise.all(contracts.map(async contract => {
    const [items, attachments] = await Promise.all([
      boqService.getByContractId(contract.id),
      contractAttachmentService.getByContractId(contract.id),
    ])

    return {
      contract,
      items: normalizeBoqItems(items),
      attachmentCount: attachments.length,
    }
  }))

  return {
    project,
    contracts,
    settlements,
    contractEntries,
    nextContractNo: getNextContractNo(contracts.map(contract => contract.contractNo), project.code),
  }
}

export async function updateProjectContractWithBoq(
  contractId: number,
  input: ProjectContractUpsertInput,
): Promise<ProjectContractMutationResult> {
  const originalContract = await contractService.getById(contractId)
  if (!originalContract) {
    throw new Error('合同不存在')
  }

  let contractUpdated = false
  try {
    await contractService.update(contractId, {
      contractNo: input.contractNo,
      contractName: input.contractName,
      contractDate: input.contractDate,
      summary: input.summary,
    })
    contractUpdated = true

    const result = await boqService.saveByContractId(
      contractId,
      prepareBoqItemsForSave(contractId, input.boqItems),
    )

    return buildProjectContractMutationResult(contractId, input.projectId, result.items)
  } catch (error) {
    if (contractUpdated) {
      await restoreContractSnapshot(originalContract)
    }
    throw error
  }
}

export async function createProjectContractWithBoq(
  input: ProjectContractUpsertInput,
): Promise<ProjectContractMutationResult> {
  const created = await contractService.create({
    projectId: input.projectId,
    contractNo: input.contractNo,
    contractName: input.contractName,
    contractDate: input.contractDate,
    noTaxAmount: 0,
    contractTaxRate: 0,
    taxAmount: 0,
    contractAmount: 0,
    amountSource: 'auto',
    summary: input.summary,
  })

  try {
    let boqItems: BillOfQuantities[] = []
    if (input.boqItems.length > 0) {
      const result = await boqService.saveByContractId(
        created.id,
        prepareBoqItemsForSave(created.id, input.boqItems),
      )
      boqItems = result.items
    }

    return buildProjectContractMutationResult(created.id, input.projectId, boqItems)
  } catch (error) {
    await contractService.delete(created.id)
    throw error
  }
}

export async function deleteProjectContractAndReloadSettlements(
  projectId: number,
  contractId: number,
): Promise<Settlement[]> {
  await contractService.delete(contractId)
  return settlementService.getByProjectId(projectId)
}

export async function updateProjectBasics(
  projectId: number,
  input: ProjectBasicsUpdateInput,
): Promise<Project> {
  await projectService.update(projectId, input)
  const project = await projectService.getById(projectId)
  if (!project) {
    throw new Error('项目更新后读取失败')
  }
  return project
}
