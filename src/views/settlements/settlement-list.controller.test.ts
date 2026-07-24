import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  deleteSettlementAndReloadListMock,
  loadSettlementListSnapshotMock,
} = vi.hoisted(() => ({
  deleteSettlementAndReloadListMock: vi.fn(),
  loadSettlementListSnapshotMock: vi.fn(),
}))

vi.mock('@/services/settlement-list.service', () => ({
  deleteSettlementAndReloadList: deleteSettlementAndReloadListMock,
  loadSettlementListSnapshot: loadSettlementListSnapshotMock,
}))

import {
  buildSettlementCreateRoute,
  deleteSettlementListSettlement,
  getSettlementListDetailRoute,
  loadSettlementListPage,
} from './settlement-list.controller'

const emptySnapshot = {
  projects: [],
  contracts: [],
  settlements: [],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('settlement-list.controller', () => {
  it('loads settlement list page snapshot through settlement list service', async () => {
    loadSettlementListSnapshotMock.mockResolvedValue(emptySnapshot)

    await expect(loadSettlementListPage()).resolves.toBe(emptySnapshot)
    expect(loadSettlementListSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('deletes a settlement with unified success message', async () => {
    deleteSettlementAndReloadListMock.mockResolvedValue(emptySnapshot)

    await expect(deleteSettlementListSettlement(6)).resolves.toEqual({
      snapshot: emptySnapshot,
      successMessage: '结算单已删除',
    })

    expect(deleteSettlementAndReloadListMock).toHaveBeenCalledWith(6)
  })

  it('builds settlement create route from create form state', () => {
    expect(buildSettlementCreateRoute({
      projectId: 3,
      contractIds: [9, 12],
      settlementType: 'interim',
      dateRange: ['2026-04-01', '2026-04-30'],
    })).toBe('/settlements/create?projectId=3&contractIds=9,12&type=interim&start=2026-04-01&end=2026-04-30')
  })

  it('builds settlement detail route', () => {
    expect(getSettlementListDetailRoute(5)).toBe('/settlements/5')
  })
})
