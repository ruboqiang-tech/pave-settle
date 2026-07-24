import { calculateCurrentAmount, calculateCumulative, calculateSettlementTotal, roundAmount, roundQuantity } from '@/utils/calculations'

export interface SettlementChainSettlement {
  id: number
  projectId: number
  startDate: string
  endDate: string
  createdAt: string
  status?: string
  previousCumulative: number
  currentAmount: number
  currentCumulative: number
  materialAdjustment: number
  changeAmount: number
  deductionAmount: number
  surchargeAmount: number
}

export interface SettlementChainDetail {
  id: number
  settlementId: number
  boqId: number
  previousCumulative: number
  currentQuantity: number
  currentCumulative: number
  unitPrice: number
  currentAmount: number
}

export interface SettlementChainBoqSnapshot {
  id: number
  contractId: number
  itemCode: string
  itemName: string
  remark: string
  unit: string
  quantity: number
  unitPrice: number
}

type SettlementChainBoqLike = Partial<SettlementChainBoqSnapshot> & Record<string, unknown>

export function toSettlementChainBoqSnapshot(source: SettlementChainBoqLike): SettlementChainBoqSnapshot {
  return {
    id: Number(source.id ?? 0),
    contractId: Number(source.contractId ?? source.contract_id ?? 0),
    itemCode: String(source.itemCode ?? source.item_code ?? ''),
    itemName: String(source.itemName ?? source.item_name ?? ''),
    remark: String(source.remark ?? ''),
    unit: String(source.unit ?? ''),
    quantity: Number(source.quantity ?? 0),
    unitPrice: Number(source.unitPrice ?? source.unit_price ?? 0),
  }
}

export function buildSettlementChainBoqMap<T extends SettlementChainBoqLike>(
  items: Iterable<T>,
): Map<number, SettlementChainBoqSnapshot> {
  const snapshots = Array.from(items, item => toSettlementChainBoqSnapshot(item))
    .filter(item => item.id > 0)

  return new Map(snapshots.map(item => [item.id, item]))
}

export function isSettlementChainEffectiveStatus(status?: string): boolean {
  if (!status) return true
  return status === 'confirmed' || status === 'approved'
}

export function syncSettlementDetailsWithBoq<
  TDetail extends SettlementChainDetail & {
    contractId?: number
    itemCode?: string
    itemName?: string
    remark?: string
    unit?: string
    contractQuantity?: number
  },
>(
  details: TDetail[],
  boqMap: Map<number, SettlementChainBoqSnapshot>,
): TDetail[] {
  return details.map(detail => {
    const boq = boqMap.get(detail.boqId)
    if (!boq) return detail

    const currentQuantity = roundQuantity(detail.currentQuantity)
    const unitPrice = roundAmount(boq.unitPrice)

    return {
      ...detail,
      contractId: boq.contractId,
      itemCode: boq.itemCode,
      itemName: boq.itemName,
      remark: boq.remark,
      unit: boq.unit,
      contractQuantity: roundQuantity(boq.quantity),
      unitPrice,
      currentAmount: calculateCurrentAmount(currentQuantity, unitPrice),
    }
  })
}

function toSortableTime(value: string): number {
  if (!value) return Number.MAX_SAFE_INTEGER
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp
}

export function sortSettlementsForChain<T extends SettlementChainSettlement>(settlements: T[]): T[] {
  return [...settlements].sort((left, right) => {
    const compareStart = toSortableTime(left.startDate) - toSortableTime(right.startDate)
    if (compareStart !== 0) return compareStart

    const compareEnd = toSortableTime(left.endDate) - toSortableTime(right.endDate)
    if (compareEnd !== 0) return compareEnd

    const compareCreated = toSortableTime(left.createdAt) - toSortableTime(right.createdAt)
    if (compareCreated !== 0) return compareCreated

    return left.id - right.id
  })
}

export function normalizeSettlementChain<
  TSettlement extends SettlementChainSettlement,
  TDetail extends SettlementChainDetail,
>(
  settlements: TSettlement[],
  detailMap: Map<number, TDetail[]>,
): {
  settlements: TSettlement[]
  details: Map<number, TDetail[]>
} {
  const normalizedSettlements: TSettlement[] = []
  const normalizedDetails = new Map<number, TDetail[]>()
  const effectiveBoqCumulativeMap = new Map<number, number>()
  let effectiveAmountCumulative = 0

  for (const settlement of sortSettlementsForChain(settlements)) {
    const details = detailMap.get(settlement.id) ?? []
    const normalizedSettlementDetails = details.map(detail => {
      const previousCumulative = roundQuantity(effectiveBoqCumulativeMap.get(detail.boqId) ?? 0)
      const currentQuantity = roundQuantity(detail.currentQuantity)
      const currentCumulative = roundQuantity(previousCumulative + currentQuantity)
      const currentAmount = calculateCurrentAmount(currentQuantity, detail.unitPrice)

      return {
        ...detail,
        previousCumulative,
        currentQuantity,
        currentCumulative,
        currentAmount,
      }
    })

    const settlementTotals = calculateSettlementTotal(
      normalizedSettlementDetails.map(detail => ({
        boqId: detail.boqId,
        itemCode: '',
        itemName: '',
        unit: '',
        contractQuantity: 0,
        previousCumulative: detail.previousCumulative,
        currentQuantity: detail.currentQuantity,
        currentCumulative: detail.currentCumulative,
        noTaxUnitPrice: 0,
        unitPrice: detail.unitPrice,
        currentAmount: detail.currentAmount,
      })),
      settlement.materialAdjustment,
      settlement.changeAmount,
      settlement.surchargeAmount,
      settlement.deductionAmount,
    )

    const previousCumulative = roundAmount(effectiveAmountCumulative)
    const currentAmount = roundAmount(settlementTotals.totalAmount)
    const currentCumulative = calculateCumulative(previousCumulative, currentAmount)

    if (isSettlementChainEffectiveStatus(settlement.status)) {
      for (const detail of normalizedSettlementDetails) {
        effectiveBoqCumulativeMap.set(detail.boqId, detail.currentCumulative)
      }
      effectiveAmountCumulative = currentCumulative
    }

    normalizedSettlements.push({
      ...settlement,
      previousCumulative,
      currentAmount,
      currentCumulative,
    })
    normalizedDetails.set(settlement.id, normalizedSettlementDetails)
  }

  return {
    settlements: normalizedSettlements,
    details: normalizedDetails,
  }
}

export function hasSettlementChainDiff(left: SettlementChainSettlement, right: SettlementChainSettlement): boolean {
  return (
    roundAmount(left.previousCumulative) !== roundAmount(right.previousCumulative)
    || roundAmount(left.currentAmount) !== roundAmount(right.currentAmount)
    || roundAmount(left.currentCumulative) !== roundAmount(right.currentCumulative)
  )
}

export function hasSettlementDetailChainDiff(left: SettlementChainDetail, right: SettlementChainDetail): boolean {
  return (
    roundQuantity(left.previousCumulative) !== roundQuantity(right.previousCumulative)
    || roundQuantity(left.currentQuantity) !== roundQuantity(right.currentQuantity)
    || roundQuantity(left.currentCumulative) !== roundQuantity(right.currentCumulative)
    || roundAmount(left.currentAmount) !== roundAmount(right.currentAmount)
  )
}
