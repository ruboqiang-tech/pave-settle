import { formatCurrency } from '@/utils/calculations'
import type { SettlementDetail } from '@/types'
import { boqService, contractService } from './contract.service'
import { projectService } from './project.service'
import { settlementDetailService, settlementService } from './settlement.service'
import {
  hasSettlementChainDiff,
  hasSettlementDetailChainDiff,
  normalizeSettlementChain,
} from './settlement-chain'
import { repairLegacySettlementDetailLinks, scanLegacySettlementDetailLinkIssues } from './settlement-link-repair.service'

export interface DataHealthDetail {
  id: string
  label: string
  value: string
  extra?: string
  route?: string
  projectId?: number
  settlementId?: number
}

export interface DataHealthIssue {
  id: 'settlement_chain_mismatch' | 'settlement_detail_boq_orphan' | 'settlement_without_details' | 'contract_without_boq'
  level: 'error' | 'warning'
  category: string
  title: string
  description: string
  count: number
  fixable: boolean
  details: DataHealthDetail[]
}

export async function scanDataHealth(): Promise<DataHealthIssue[]> {
  const [projects, settlements, contracts] = await Promise.all([
    projectService.getAll(),
    settlementService.getAll(),
    contractService.getAll(),
  ])

  const issues: DataHealthIssue[] = []
  const contractById = new Map(contracts.map(contract => [contract.id, contract]))
  const projectById = new Map(projects.map(project => [project.id, project]))

  const settlementDetailsMap = new Map<number, SettlementDetail[]>()
  const detailEntries = await Promise.all(
    settlements.map(async (settlement) => [settlement.id, await settlementDetailService.getBySettlementId(settlement.id)] as const)
  )
  for (const [id, details] of detailEntries) {
    settlementDetailsMap.set(id, details)
  }

  const chainMismatchDetails: DataHealthDetail[] = []
  for (const project of projects) {
    const projectSettlements = settlements.filter(settlement => settlement.projectId === project.id)
    if (projectSettlements.length === 0) continue

    const normalized = normalizeSettlementChain(
      projectSettlements,
      new Map(projectSettlements.map(settlement => [settlement.id, settlementDetailsMap.get(settlement.id) ?? []])),
    )

    const normalizedSettlementById = new Map(normalized.settlements.map(settlement => [settlement.id, settlement]))
    const normalizedDetailsBySettlementId = normalized.details

    for (const settlement of projectSettlements) {
      const normalizedSettlement = normalizedSettlementById.get(settlement.id)
      if (!normalizedSettlement) continue

      const storedDetails = settlementDetailsMap.get(settlement.id) ?? []
      const normalizedDetails = normalizedDetailsBySettlementId.get(settlement.id) ?? []
      const normalizedDetailById = new Map(normalizedDetails.map(detail => [detail.id, detail]))
      const detailMismatch = storedDetails.some(detail => {
        const normalizedDetail = normalizedDetailById.get(detail.id)
        return normalizedDetail ? hasSettlementDetailChainDiff(detail, normalizedDetail) : false
      })

      if (!hasSettlementChainDiff(settlement, normalizedSettlement) && !detailMismatch) {
        continue
      }

      chainMismatchDetails.push({
        id: `${settlement.id}`,
        label: settlement.settlementNo,
        value: `${project.name} · 应为上期 ${formatCurrency(normalizedSettlement.previousCumulative)} / 累计 ${formatCurrency(normalizedSettlement.currentCumulative)}`,
        extra: `当前为 ${formatCurrency(settlement.previousCumulative)} / ${formatCurrency(settlement.currentCumulative)}`,
        route: `/settlements/${settlement.id}`,
        projectId: settlement.projectId,
        settlementId: settlement.id,
      })
    }
  }

  if (chainMismatchDetails.length > 0) {
    issues.push({
      id: 'settlement_chain_mismatch',
      level: 'error',
      category: '结算链路',
      title: '累计结算链不一致',
      description: '结算单新增、编辑或删除后，部分上期累计/累计结算/明细累计没有按时间链同步回刷。',
      count: chainMismatchDetails.length,
      fixable: true,
      details: chainMismatchDetails,
    })
  }

  const orphanSettlementDetails = await scanLegacySettlementDetailLinkIssues()
  if (orphanSettlementDetails.length > 0) {
    const autoRepairableCount = orphanSettlementDetails.filter(detail => detail.matchedBoqId !== null).length
    issues.push({
      id: 'settlement_detail_boq_orphan',
      level: 'error',
      category: '清单关联',
      title: '结算明细挂着失效清单',
      description: autoRepairableCount === orphanSettlementDetails.length
        ? '这些结算明细仍引用已不存在的合同清单行，改单价后不会联动，系统可自动重绑并重算累计结算。'
        : '这些结算明细仍引用已不存在的合同清单行，其中可识别的部分可自动重绑，其余需要人工核对。',
      count: orphanSettlementDetails.length,
      fixable: autoRepairableCount > 0,
      details: orphanSettlementDetails.map(detail => ({
        id: `${detail.detailId}`,
        label: `${detail.settlementNo} / 明细 #${detail.detailId}`,
        value: `${detail.itemName || detail.itemCode || '未命名清单'} 路 原 BOQ #${detail.boqId} 已失效`,
        extra: detail.matchedBoqId
          ? `可自动重绑到 BOQ #${detail.matchedBoqId}`
          : '未找到唯一匹配清单，需要人工核对',
        route: `/settlements/${detail.settlementId}`,
        projectId: detail.projectId,
        settlementId: detail.settlementId,
      })),
    })
  }

  const settlementWithoutDetails = settlements
    .filter(settlement => settlement.status !== 'draft' && (settlementDetailsMap.get(settlement.id) ?? []).length === 0)
    .map(settlement => ({
      id: `${settlement.id}`,
      label: settlement.settlementNo,
      value: `${projectById.get(settlement.projectId)?.name || '未知项目'} · ${settlement.status === 'confirmed' ? '已确认' : settlement.status === 'approved' ? '已审批' : '草稿'}`,
      route: `/settlements/${settlement.id}`,
      projectId: settlement.projectId,
      settlementId: settlement.id,
    }))

  if (settlementWithoutDetails.length > 0) {
    issues.push({
      id: 'settlement_without_details',
      level: 'warning',
      category: '结算明细',
      title: '结算单缺少明细',
      description: '这些结算单主表已存在，但没有对应的工程量明细，查看和统计都会受影响。',
      count: settlementWithoutDetails.length,
      fixable: false,
      details: settlementWithoutDetails,
    })
  }

  const contractWithoutBoq: DataHealthDetail[] = []
  const boqResults = await Promise.all(
    contracts.map(async (contract) => ({ contract, boqItems: await boqService.getByContractId(contract.id) }))
  )
  for (const { contract, boqItems } of boqResults) {
    if (boqItems.length > 0) continue

    contractWithoutBoq.push({
      id: `${contract.id}`,
      label: `${contract.contractNo} - ${contract.contractName}`,
      value: projectById.get(contract.projectId)?.name || '未知项目',
      route: `/projects/${contract.projectId}`,
    })
  }

  if (contractWithoutBoq.length > 0) {
    issues.push({
      id: 'contract_without_boq',
      level: 'warning',
      category: '合同清单',
      title: '合同缺少清单',
      description: '这些合同尚未录入工程量清单，后续结算和统计会不完整。',
      count: contractWithoutBoq.length,
      fixable: false,
      details: contractWithoutBoq,
    })
  }

  return issues
}

export async function repairDataHealthIssue(issue: DataHealthIssue): Promise<void> {
  if (issue.id === 'settlement_detail_boq_orphan') {
    const result = await repairLegacySettlementDetailLinks()
    if (result.repairedCount === 0) {
      throw new Error('没有找到可自动修复的失效清单关联')
    }
    return
  }

  if (issue.id !== 'settlement_chain_mismatch') {
    throw new Error('该问题暂不支持自动修复')
  }

  const projectIds = Array.from(new Set(issue.details.map(detail => detail.projectId).filter((value): value is number => typeof value === 'number')))
  await Promise.all(projectIds.map(projectId => settlementService.recalculateProjectChain(projectId)))
}
