import { beforeEach, describe, expect, it, vi } from 'vitest'

const { loadBusinessSnapshotMock } = vi.hoisted(() => ({
  loadBusinessSnapshotMock: vi.fn(),
}))

vi.mock('@/services/analytics.service', () => ({
  loadBusinessSnapshot: loadBusinessSnapshotMock,
}))

import {
  getDashboardProjectDetailRoute,
  getDashboardProjectsRoute,
  getDashboardSettlementDetailRoute,
  getDashboardSettlementsRoute,
  loadDashboardPage,
} from './dashboard.controller'

const emptySnapshot = {
  projects: [],
  contracts: [],
  settlements: [],
  payments: [],
  invoices: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('dashboard.controller', () => {
  it('loads dashboard page snapshot through analytics service', async () => {
    loadBusinessSnapshotMock.mockResolvedValue(emptySnapshot)

    await expect(loadDashboardPage()).resolves.toBe(emptySnapshot)
    expect(loadBusinessSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('builds dashboard navigation routes', () => {
    expect(getDashboardProjectsRoute()).toBe('/projects')
    expect(getDashboardProjectDetailRoute(3)).toBe('/projects/3')
    expect(getDashboardSettlementsRoute()).toBe('/settlements')
    expect(getDashboardSettlementDetailRoute(8)).toBe('/settlements/8')
  })
})
