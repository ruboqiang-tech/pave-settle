import type {
  SettlementDetailUpsertInput as SettlementDetailSaveInput,
  SettlementSavePayload,
  SettlementUpsertInput as SettlementSaveSettlementInput,
} from '@/services/settlement.service'
import type {
  BillOfQuantities,
  Contract,
  CostAdjustmentData,
  Settlement,
  SettlementDetail,
  SettlementDetailRow,
  SettlementStatus,
  SettlementType,
} from '@/types'
import { roundAmount, roundQuantity } from '@/utils/calculations'

export interface SettlementDraft extends SettlementSaveSettlementInput {
  id: number
}

export interface SettlementDraftSeed {
  projectId?: number
  settlementType?: SettlementType
  startDate?: string
  endDate?: string
}

export interface DetailGroup {
  contractId: number
  contractName: string
  contractAmount: number
  items: SettlementDetailRow[]
}

export interface ContractCollections {
  amountMap: Record<number, number>
  nameMap: Record<number, string>
  nameList: string[]
  totalAmount: number
}

export const saveSuccessMessageMap: Record<SettlementStatus, string> = {
  draft: '草稿已保存',
  confirmed: '结算单已确认',
  approved: '结算单已审批',
}

export function createSettlementDraft(seed: SettlementDraftSeed = {}): SettlementDraft {
  return {
    id: 0,
    projectId: seed.projectId || 0,
    contractIds: [],
    settlementNo: '',
    settlementType: seed.settlementType || 'interim',
    startDate: seed.startDate || '',
    endDate: seed.endDate || '',
    previousCumulative: 0,
    currentAmount: 0,
    currentCumulative: 0,
    materialAdjustment: 0,
    changeAmount: 0,
    deductionAmount: 0,
    surchargeAmount: 0,
    changeRemark: '',
    materialRemark: '',
    surchargeRemark: '',
    deductionRemark: '',
    remark: '',
    status: 'draft',
  }
}

export function getSettlementDateRange(settlement: Pick<SettlementDraft, 'startDate' | 'endDate'>): string[] {
  return [settlement.startDate, settlement.endDate]
}

export function applySettlementDateRange(
  settlement: Pick<SettlementDraft, 'startDate' | 'endDate'>,
  range: string[] | null | undefined,
): void {
  const [startDate = '', endDate = ''] = range ?? []
  settlement.startDate = startDate
  settlement.endDate = endDate
}

export function createCostAdjustmentData(settlement: SettlementDraft): CostAdjustmentData {
  return {
    changeAmount: settlement.changeAmount,
    changeRemark: settlement.changeRemark,
    materialAdjustment: settlement.materialAdjustment,
    materialRemark: settlement.materialRemark,
    surchargeAmount: settlement.surchargeAmount,
    surchargeRemark: settlement.surchargeRemark,
    deductionAmount: settlement.deductionAmount,
    deductionRemark: settlement.deductionRemark,
  }
}

export function syncCostAdjustmentFromSettlement(settlement: SettlementDraft, target: CostAdjustmentData): void {
  target.changeAmount = settlement.changeAmount
  target.changeRemark = settlement.changeRemark
  target.materialAdjustment = settlement.materialAdjustment
  target.materialRemark = settlement.materialRemark
  target.surchargeAmount = settlement.surchargeAmount
  target.surchargeRemark = settlement.surchargeRemark
  target.deductionAmount = settlement.deductionAmount
  target.deductionRemark = settlement.deductionRemark
}

export function applyCostAdjustmentToSettlement(settlement: SettlementDraft, adjustment: CostAdjustmentData): void {
  settlement.changeAmount = adjustment.changeAmount
  settlement.changeRemark = adjustment.changeRemark
  settlement.materialAdjustment = adjustment.materialAdjustment
  settlement.materialRemark = adjustment.materialRemark
  settlement.surchargeAmount = adjustment.surchargeAmount
  settlement.surchargeRemark = adjustment.surchargeRemark
  settlement.deductionAmount = adjustment.deductionAmount
  settlement.deductionRemark = adjustment.deductionRemark
}

export function buildContractCollections(contracts: Contract[]): ContractCollections {
  const amountMap: Record<number, number> = {}
  const nameMap: Record<number, string> = {}
  const nameList = contracts.map(contract => {
    amountMap[contract.id] = roundAmount(contract.contractAmount)
    nameMap[contract.id] = contract.contractName
    return `${contract.contractNo} - ${contract.contractName}`
  })

  return {
    amountMap,
    nameMap,
    nameList,
    totalAmount: roundAmount(contracts.reduce((sum, contract) => sum + Number(contract.contractAmount || 0), 0)),
  }
}

export function buildGroupedDetails(details: SettlementDetailRow[], contractAmountMap: Record<number, number>): DetailGroup[] {
  const map = new Map<number, DetailGroup>()

  for (const item of details) {
    const contractId = item.contractId || 0
    if (!map.has(contractId)) {
      map.set(contractId, {
        contractId,
        contractName: item.contractName || '未知合同',
        contractAmount: contractAmountMap[contractId] || 0,
        items: [],
      })
    }
    map.get(contractId)?.items.push(item)
  }

  return Array.from(map.values())
}

export function getGroupCurrentAmount(group: DetailGroup): number {
  return roundAmount(group.items.reduce((sum, item) => sum + Number(item.currentAmount || 0), 0))
}

export function recalculateSettlementDetailRow(row: SettlementDetailRow): void {
  row.currentCumulative = roundQuantity(Number(row.previousCumulative || 0) + Number(row.currentQuantity || 0))
  row.currentAmount = roundAmount(Number(row.currentQuantity || 0) * Number(row.unitPrice || 0))
}

export function recalculateSettlement(settlement: SettlementDraft, details: SettlementDetailRow[]): void {
  const baseAmount = roundAmount(details.reduce((sum, item) => sum + Number(item.currentAmount || 0), 0))
  const total = baseAmount
    + Number(settlement.changeAmount || 0)
    + Number(settlement.materialAdjustment || 0)
    + Number(settlement.surchargeAmount || 0)
    - Number(settlement.deductionAmount || 0)

  settlement.currentAmount = roundAmount(total)
  settlement.currentCumulative = roundAmount(Number(settlement.previousCumulative || 0) + settlement.currentAmount)
}

export function mapStoredDetailsToRows(
  details: SettlementDetail[],
  contractNameMap: Record<number, string>,
  boqContractIdMap: Record<number, number>,
): SettlementDetailRow[] {
  return details.map(detail => {
    const contractId = detail.contractId || boqContractIdMap[detail.boqId] || 0

    return {
      boqId: detail.boqId,
      contractId,
      contractName: contractNameMap[contractId] || '未知合同',
      itemCode: detail.itemCode || '',
      itemName: detail.itemName || '',
      remark: detail.remark || '',
      note: (detail as any).note || '',
      unit: detail.unit || '',
      contractQuantity: detail.contractQuantity,
      previousCumulative: detail.previousCumulative,
      currentQuantity: detail.currentQuantity,
      currentCumulative: detail.currentCumulative,
      noTaxUnitPrice: (detail as any).noTaxUnitPrice || 0,
      unitPrice: detail.unitPrice,
      currentAmount: detail.currentAmount,
    }
  })
}

export function createSettlementDetailRowFromBoq(
  item: BillOfQuantities,
  contractName: string,
  previousCumulative: number,
): SettlementDetailRow {
  const normalizedPreviousCumulative = roundQuantity(previousCumulative)

  return {
    boqId: item.id,
    contractId: item.contractId,
    contractName,
    itemCode: item.itemCode,
    itemName: item.itemName,
    remark: item.remark,
    note: item.note || '',
    unit: item.unit,
    contractQuantity: item.quantity,
    previousCumulative: normalizedPreviousCumulative,
    currentQuantity: 0,
    currentCumulative: normalizedPreviousCumulative,
    noTaxUnitPrice: item.noTaxUnitPrice,
    unitPrice: item.unitPrice,
    currentAmount: 0,
  }
}

export function validateSettlementDraftForSave(
  settlement: Pick<SettlementDraft, 'startDate' | 'endDate' | 'settlementNo' | 'status'>,
): string | null {
  if (settlement.startDate && settlement.endDate && settlement.startDate > settlement.endDate) {
    return `开始日期（${settlement.startDate}）不能晚于结束日期（${settlement.endDate}）`
  }
  if (settlement.status !== 'draft' && !settlement.settlementNo.trim()) {
    return '确认/审批状态下结算单号不能为空'
  }
  return null
}

export function buildPreviousCumulativeMap(details: SettlementDetail[]): Record<number, number> {
  return details.reduce<Record<number, number>>((map, detail) => {
    map[detail.boqId] = roundQuantity((map[detail.boqId] || 0) + Number(detail.currentQuantity || 0))
    return map
  }, {})
}

export function buildSettlementSavePayload(
  settlement: SettlementDraft,
  details: SettlementDetailRow[],
): SettlementSavePayload {
  const settlementId = settlement.id > 0 ? settlement.id : undefined

  return {
    settlementId,
    settlement: {
      projectId: settlement.projectId,
      contractIds: [...settlement.contractIds],
      settlementNo: settlement.settlementNo,
      settlementType: settlement.settlementType,
      startDate: settlement.startDate,
      endDate: settlement.endDate,
      previousCumulative: settlement.previousCumulative,
      currentAmount: settlement.currentAmount,
      currentCumulative: settlement.currentCumulative,
      materialAdjustment: settlement.materialAdjustment,
      changeAmount: settlement.changeAmount,
      deductionAmount: settlement.deductionAmount,
      surchargeAmount: settlement.surchargeAmount,
      changeRemark: settlement.changeRemark,
      materialRemark: settlement.materialRemark,
      surchargeRemark: settlement.surchargeRemark,
      deductionRemark: settlement.deductionRemark,
      remark: settlement.remark,
      status: settlement.status,
    },
    details: details.map<SettlementDetailSaveInput>(detail => ({
      settlementId: settlement.id || 0,
      boqId: detail.boqId,
      contractId: detail.contractId,
      itemCode: detail.itemCode,
      itemName: detail.itemName,
      remark: detail.remark,
      unit: detail.unit,
      contractQuantity: detail.contractQuantity,
      previousCumulative: detail.previousCumulative,
      currentQuantity: detail.currentQuantity,
      currentCumulative: detail.currentCumulative,
      unitPrice: detail.unitPrice,
      currentAmount: detail.currentAmount,
      note: detail.note,
    })),
  }
}

export function buildSettlementDraftForChain(
  settlement: SettlementDraft,
  currentSettlementKey: number,
  projectId: number,
  createdAt: string,
): Settlement {
  return {
    id: currentSettlementKey,
    projectId,
    contractIds: [...settlement.contractIds],
    settlementNo: settlement.settlementNo,
    settlementType: settlement.settlementType,
    startDate: settlement.startDate,
    endDate: settlement.endDate,
    previousCumulative: settlement.previousCumulative,
    currentAmount: settlement.currentAmount,
    currentCumulative: settlement.currentCumulative,
    materialAdjustment: settlement.materialAdjustment,
    changeAmount: settlement.changeAmount,
    deductionAmount: settlement.deductionAmount,
    surchargeAmount: settlement.surchargeAmount,
    changeRemark: settlement.changeRemark,
    materialRemark: settlement.materialRemark,
    surchargeRemark: settlement.surchargeRemark,
    deductionRemark: settlement.deductionRemark,
    remark: settlement.remark,
    status: settlement.status,
    createdAt,
  }
}
