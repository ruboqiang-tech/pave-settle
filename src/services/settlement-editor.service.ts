import {
  settlementAttachmentService,
} from './attachment.service'
import {
  boqService,
  contractService,
} from './contract.service'
import { projectService } from './project.service'
import {
  settlementDetailService,
  settlementService,
} from './settlement.service'
import { isSettlementChainEffectiveStatus, sortSettlementsForChain } from './settlement-chain'
import type { BillOfQuantities, Contract, Settlement, SettlementDetail, SettlementDetailRow } from '@/types'
import { generateSettlementNo, getNextSettlementSequence, roundAmount } from '@/utils/calculations'
import type { SettlementSavePayload, SettlementSaveResult } from './settlement.service'
import {
  buildContractCollections,
  buildPreviousCumulativeMap,
  buildSettlementDraftForChain,
  createSettlementDetailRowFromBoq,
  createSettlementDraft,
  mapStoredDetailsToRows,
  recalculateSettlement,
  type SettlementDraft,
  type ContractCollections,
  type SettlementDraftSeed,
} from '@/views/settlements/settlement-detail.helpers'

interface ContractBoqBundle {
  contract: Contract
  items: BillOfQuantities[]
}

export interface SettlementEditorLoadInput {
  settlementId?: number
  routeContractIds?: number[]
  seed?: SettlementDraftSeed
}

export interface SettlementEditorSnapshot {
  pageTitle: string
  projectName: string
  selectedContractIds: number[]
  loadedContracts: Contract[]
  contractCollections: ContractCollections
  settlement: SettlementDraft
  details: SettlementDetailRow[]
  detailsLoadedFromFallback: boolean
}

export interface PendingSettlementAttachmentInput {
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
}

type SettlementSnapshot = {
  settlement: SettlementSavePayload['settlement']
  details: SettlementSavePayload['details']
}

function buildBoqContractIdMap(bundles: ContractBoqBundle[]): Record<number, number> {
  return bundles.reduce<Record<number, number>>((map, bundle) => {
    for (const item of bundle.items) {
      map[item.id] = bundle.contract.id
    }
    return map
  }, {})
}

async function loadContractBoqBundles(contracts: Contract[]): Promise<ContractBoqBundle[]> {
  return Promise.all(contracts.map(async contract => ({
    contract,
    items: await boqService.getByContractId(contract.id),
  })))
}

async function resolveContracts(
  projectId: number,
  settlement: SettlementDraft,
  settlementId: number,
  routeContractIds: number[],
): Promise<{ contracts: Contract[]; selectedContractIds: number[] }> {
  if (settlementId <= 0 && settlement.contractIds.length === 0 && routeContractIds.length > 0) {
    settlement.contractIds = [...routeContractIds]
  }

  if (settlement.contractIds.length === 0) {
    const contracts = await contractService.getAllByProjectId(projectId)
    const selectedContractIds = contracts.map(contract => contract.id)
    settlement.contractIds = [...selectedContractIds]
    return { contracts, selectedContractIds }
  }

  const contracts = await Promise.all(
    settlement.contractIds.map(contractId => contractService.getById(contractId)),
  )

  return {
    contracts: contracts.filter((contract): contract is Contract => contract !== null),
    selectedContractIds: [...settlement.contractIds],
  }
}

async function loadPreviousCumulativeMap(previousSettlements: Settlement[]): Promise<Record<number, number>> {
  const previousDetails = await Promise.all(
    previousSettlements.map(item => settlementDetailService.getBySettlementId(item.id)),
  )
  return buildPreviousCumulativeMap(previousDetails.flat())
}

async function buildFallbackDetails(
  settlement: SettlementDraft,
  bundles: ContractBoqBundle[],
  projectCode: string,
  isNew: boolean,
): Promise<SettlementDetailRow[]> {
  const allSettlements = await settlementService.getByProjectId(settlement.projectId)
  const currentSettlementKey = settlement.id > 0 ? settlement.id : Number.MAX_SAFE_INTEGER
  const currentCreatedAt = allSettlements.find(item => item.id === settlement.id)?.createdAt || new Date().toISOString()
  const orderedSettlements = sortSettlementsForChain([
    ...allSettlements.filter(item => item.id !== settlement.id),
    buildSettlementDraftForChain(settlement, currentSettlementKey, settlement.projectId, currentCreatedAt),
  ])
  const currentIndex = orderedSettlements.findIndex(item => item.id === currentSettlementKey)
  const previousSettlements = orderedSettlements
    .slice(0, currentIndex)
    .filter(item => item.id !== currentSettlementKey && isSettlementChainEffectiveStatus(item.status))

  if (isNew) {
    settlement.previousCumulative = roundAmount(
      previousSettlements.reduce((sum, item) => sum + Number(item.currentAmount || 0), 0),
    )
    settlement.settlementNo = generateSettlementNo(
      projectCode || 'XM',
      settlement.settlementType,
      getNextSettlementSequence(allSettlements.map(item => item.settlementNo)),
    )
  }

  const previousCumulativeMap = await loadPreviousCumulativeMap(previousSettlements)
  return bundles.flatMap(bundle =>
    bundle.items.map(item =>
      createSettlementDetailRowFromBoq(item, bundle.contract.contractName, previousCumulativeMap[item.id] || 0),
    ),
  )
}

async function mapExistingDetailsToRowsWithBundles(
  existingDetails: SettlementDetail[],
  bundles: ContractBoqBundle[],
  contractNameMap: Record<number, string>,
): Promise<SettlementDetailRow[]> {
  return mapStoredDetailsToRows(existingDetails, contractNameMap, buildBoqContractIdMap(bundles))
}

function toSettlementSaveInput(settlement: Settlement): SettlementSavePayload['settlement'] {
  const { id: _id, createdAt: _createdAt, ...rest } = settlement
  return {
    ...rest,
    contractIds: [...settlement.contractIds],
  }
}

function toSettlementDetailSaveInput(details: SettlementDetail[]): SettlementSavePayload['details'] {
  return details.map(detail => {
    const { id: _id, ...rest } = detail
    return { ...rest }
  })
}

async function loadSettlementSnapshot(settlementId: number): Promise<SettlementSnapshot | null> {
  const existingSettlement = await settlementService.getById(settlementId)
  if (!existingSettlement) return null

  const existingDetails = await settlementDetailService.getStoredBySettlementId(settlementId)
  return {
    settlement: toSettlementSaveInput(existingSettlement),
    details: toSettlementDetailSaveInput(existingDetails),
  }
}

async function cleanupCreatedSettlementAttachments(attachmentIds: number[]): Promise<void> {
  for (const attachmentId of attachmentIds.slice().reverse()) {
    try {
      await settlementAttachmentService.delete(attachmentId)
    } catch (cleanupError) {
      console.warn('Failed to rollback settlement attachment creation', cleanupError)
    }
  }
}

async function rollbackSavedSettlement(
  settlementId: number,
  previousSnapshot: SettlementSnapshot | null,
): Promise<void> {
  if (!previousSnapshot) {
    await settlementService.delete(settlementId)
    return
  }

  await settlementService.saveWithDetails({
    settlementId,
    settlement: previousSnapshot.settlement,
    details: previousSnapshot.details,
  })
}

export async function loadSettlementEditorSnapshot(
  input: SettlementEditorLoadInput,
): Promise<SettlementEditorSnapshot | null> {
  const settlementId = Number(input.settlementId ?? 0)
  const settlement = createSettlementDraft(input.seed)
  let pageTitle = '新建结算单'

  if (settlementId > 0) {
    pageTitle = '编辑结算单'
    const existing = await settlementService.getById(settlementId)
    if (existing) {
      Object.assign(settlement, existing)
    }
  }

  const projectId = settlement.projectId
  if (projectId <= 0) return null

  const project = await projectService.getById(projectId)
  const projectName = project?.name || ''

  const { contracts, selectedContractIds } = await resolveContracts(
    projectId,
    settlement,
    settlementId,
    input.routeContractIds || [],
  )
  const contractCollections = buildContractCollections(contracts)
  const bundles = await loadContractBoqBundles(contracts)

  let detailsLoadedFromFallback = false
  let details: SettlementDetailRow[] = []

  if (settlementId > 0 && settlement.id > 0) {
    const existingDetails = await settlementDetailService.getBySettlementId(settlementId)
    if (existingDetails.length > 0) {
      details = await mapExistingDetailsToRowsWithBundles(
        existingDetails,
        bundles,
        contractCollections.nameMap,
      )
    } else {
      detailsLoadedFromFallback = settlement.currentAmount > 0
      details = await buildFallbackDetails(settlement, bundles, project?.code || 'XM', false)
    }
  } else {
    details = await buildFallbackDetails(settlement, bundles, project?.code || 'XM', true)
  }

  recalculateSettlement(settlement, details)

  return {
    pageTitle,
    projectName,
    selectedContractIds,
    loadedContracts: contracts,
    contractCollections,
    settlement,
    details,
    detailsLoadedFromFallback,
  }
}

export async function saveSettlementEditor(
  payload: SettlementSavePayload,
  pendingAttachments: PendingSettlementAttachmentInput[] = [],
): Promise<SettlementSaveResult> {
  const previousSnapshot = payload.settlementId
    ? await loadSettlementSnapshot(payload.settlementId)
    : null
  const result = await settlementService.saveWithDetails(payload)
  const createdAttachmentIds: number[] = []

  try {
    for (const attachment of pendingAttachments) {
      const createdAttachment = await settlementAttachmentService.create({
        settlementId: result.settlement.id,
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
        fileData: attachment.fileData,
      }, { skipSave: true })
      createdAttachmentIds.push(createdAttachment.id)
    }

    if (pendingAttachments.length > 0) {
      const { saveToStorage } = await import('./db-core')
      await saveToStorage()
    }
  } catch (error) {
    await cleanupCreatedSettlementAttachments(createdAttachmentIds)
    try {
      await rollbackSavedSettlement(result.settlement.id, previousSnapshot)
    } catch (rollbackError) {
      throw new Error(`结算单附件保存失败，且回滚未完成：${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`)
    }
    throw error
  }

  return result
}

export async function revertSettlementEditorToDraft(settlementId: number): Promise<Settlement | null> {
  return settlementService.updateStatus(settlementId, 'draft')
}
