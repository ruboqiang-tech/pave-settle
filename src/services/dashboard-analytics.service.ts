import type { Project, Settlement } from '@/types'
import { roundAmount } from '@/utils/calculations'
import {
  createContractAmountMap,
  createReceivedAmountMap,
  createSettledAmountMap,
  isSettledStatus,
  monthKey,
  yearKey,
  type BusinessSnapshot,
} from './analytics-core.service'

export interface DashboardStats {
  totalProjects: number
  inProgressProjects: number
  settlingProjects: number
  completedProjects: number
  totalContractAmount: number
  totalSettledAmount: number
  currentMonthSettlement: number
  totalSettlements: number
  totalReceived: number
  totalUnreceived: number
}

export interface DashboardActiveProject extends Project {
  settlementRatio: string
  settledAmount: number
  receivedAmount: number
}

export interface DashboardProjectChartItem {
  name: string
  settledAmount: number
  receivedAmount: number
}

export type TrendGranularity = 'month' | 'year'

function trendKey(dateText: string, granularity: TrendGranularity): string {
  return granularity === 'year' ? yearKey(dateText) : monthKey(dateText)
}

export function buildDashboardStats(snapshot: BusinessSnapshot): DashboardStats {
  const contractAmountMap = createContractAmountMap(snapshot.contracts)
  const settledAmountMap = createSettledAmountMap(snapshot.settlements)
  const totalContractAmount = roundAmount(Array.from(contractAmountMap.values()).reduce((sum, value) => sum + value, 0))
  const totalSettledAmount = roundAmount(Array.from(settledAmountMap.values()).reduce((sum, value) => sum + value, 0))
  const totalReceived = roundAmount(snapshot.payments
    .filter(payment => payment.paymentType === 'receive')
    .reduce((sum, payment) => sum + payment.amount, 0))

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentMonthSettlement = roundAmount(snapshot.settlements
    .filter(settlement => isSettledStatus(settlement.status) && monthKey(settlement.createdAt) === currentMonth)
    .reduce((sum, settlement) => sum + settlement.currentAmount, 0))

  return {
    totalProjects: snapshot.projects.length,
    inProgressProjects: snapshot.projects.filter(project => project.status === 'in_progress').length,
    settlingProjects: snapshot.projects.filter(project => project.status === 'settling').length,
    completedProjects: snapshot.projects.filter(project => project.status === 'completed').length,
    totalContractAmount,
    totalSettledAmount,
    currentMonthSettlement,
    totalSettlements: snapshot.settlements.filter(settlement => isSettledStatus(settlement.status)).length,
    totalReceived,
    totalUnreceived: roundAmount(totalSettledAmount - totalReceived),
  }
}

export function buildDashboardActiveProjects(snapshot: BusinessSnapshot): DashboardActiveProject[] {
  const contractAmountMap = createContractAmountMap(snapshot.contracts)
  const settledAmountMap = createSettledAmountMap(snapshot.settlements)
  const receivedAmountMap = createReceivedAmountMap(snapshot.payments)

  return snapshot.projects
    .filter(project => project.status !== 'completed')
    .map(project => {
      const contractAmount = contractAmountMap.get(project.id) ?? 0
      const settledAmount = settledAmountMap.get(project.id) ?? 0
      const receivedAmount = receivedAmountMap.get(project.id) ?? 0
      return {
        ...project,
        settlementRatio: (contractAmount > 0 ? (settledAmount / contractAmount) * 100 : 0).toFixed(1),
        settledAmount,
        receivedAmount,
      }
    })
    .slice(0, 5)
}

export function buildDashboardRecentSettlements(snapshot: BusinessSnapshot): Settlement[] {
  return [...snapshot.settlements]
    .sort((left, right) => {
      const createdAtDiff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      if (createdAtDiff !== 0) return createdAtDiff
      return right.id - left.id
    })
    .slice(0, 5)
}

export function buildDashboardChartProjects(snapshot: BusinessSnapshot): DashboardProjectChartItem[] {
  const settledAmountMap = createSettledAmountMap(snapshot.settlements)
  const receivedAmountMap = createReceivedAmountMap(snapshot.payments)

  return snapshot.projects.map(project => ({
    name: project.name,
    settledAmount: settledAmountMap.get(project.id) ?? 0,
    receivedAmount: receivedAmountMap.get(project.id) ?? 0,
  }))
}

export function buildTrendPeriods(count = 6, granularity: TrendGranularity = 'month'): string[] {
  const periods: string[] = []
  const now = new Date()
  for (let index = count - 1; index >= 0; index -= 1) {
    if (granularity === 'year') {
      periods.push(String(now.getFullYear() - index))
    } else {
      const current = new Date(now.getFullYear(), now.getMonth() - index, 1)
      periods.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`)
    }
  }
  return periods
}

export function buildTrendMonths(count = 6): string[] {
  return buildTrendPeriods(count, 'month')
}

export function buildTrendSettlements(
  snapshot: BusinessSnapshot,
  periods: string[],
  granularity: TrendGranularity = 'month',
): number[] {
  return periods.map(period =>
    roundAmount(snapshot.settlements
      .filter(settlement => isSettledStatus(settlement.status) && trendKey(settlement.createdAt, granularity) === period)
      .reduce((sum, settlement) => sum + settlement.currentAmount, 0))
  )
}

export function buildTrendReceipts(
  snapshot: BusinessSnapshot,
  periods: string[],
  granularity: TrendGranularity = 'month',
): number[] {
  return periods.map(period =>
    roundAmount(snapshot.payments
      .filter(payment => payment.paymentType === 'receive' && trendKey(payment.paymentDate, granularity) === period)
      .reduce((sum, payment) => sum + payment.amount, 0))
  )
}
