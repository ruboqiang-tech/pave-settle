import {
  loadBusinessSnapshot,
  type BusinessSnapshot,
} from '@/services/analytics.service'

export async function loadDashboardPage(): Promise<BusinessSnapshot> {
  return loadBusinessSnapshot()
}

export function getDashboardProjectsRoute(): string {
  return '/projects'
}

export function getDashboardProjectDetailRoute(projectId: number): string {
  return `/projects/${projectId}`
}

export function getDashboardSettlementsRoute(): string {
  return '/settlements'
}

export function getDashboardSettlementDetailRoute(settlementId: number): string {
  return `/settlements/${settlementId}`
}
