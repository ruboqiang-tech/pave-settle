import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  dbExecMock,
  dbRunMock,
  execToObjectsMock,
  getDbMock,
  getRowNumberMock,
  getRowStringMock,
  saveToStorageMock,
  withTransactionMock,
} = vi.hoisted(() => ({
  dbExecMock: vi.fn(),
  dbRunMock: vi.fn(),
  execToObjectsMock: vi.fn((rows: Array<Record<string, unknown>>) => rows),
  getDbMock: vi.fn(),
  getRowNumberMock: vi.fn((row: Record<string, unknown>, key: string, fallback = 0) => Number(row[key] ?? fallback)),
  getRowStringMock: vi.fn((row: Record<string, unknown>, key: string, fallback = '') => String(row[key] ?? fallback)),
  saveToStorageMock: vi.fn(),
  withTransactionMock: vi.fn(async (operation: (database: { run: typeof dbRunMock; exec: typeof dbExecMock }) => Promise<unknown> | unknown) => {
    return operation({
      run: dbRunMock,
      exec: dbExecMock,
    })
  }),
}))

vi.mock('./db-core', () => ({
  execToObjects: execToObjectsMock,
  getDb: getDbMock,
  getRowNumber: getRowNumberMock,
  getRowString: getRowStringMock,
  saveToStorage: saveToStorageMock,
  withTransaction: withTransactionMock,
}))

import { projectCostService } from './project-cost.service'

function makeDbHandle() {
  return {
    exec: dbExecMock,
    run: dbRunMock,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getDbMock.mockReturnValue(makeDbHandle())
})

describe('projectCostService', () => {
  it('lists project cost entries by project and phase', async () => {
    dbExecMock.mockReturnValue([
      {
        id: 10,
        project_id: 3,
        phase: 'budget',
        category: 'material',
        item_name: '沥青混合料',
        spec: 'AC-13',
        unit: 't',
        quantity: 2,
        unit_cost: 500,
        amount: 1000,
        occurred_on: '2026-03-01',
        note: '预算',
        created_at: '2026-03-01 10:00:00',
      },
    ])

    await expect(projectCostService.listByProjectAndPhase(3, 'budget')).resolves.toEqual([
      {
        id: 10,
        projectId: 3,
        phase: 'budget',
        category: 'material',
        itemName: '沥青混合料',
        spec: 'AC-13',
        unit: 't',
        quantity: 2,
        unitCost: 500,
        amount: 1000,
        occurredOn: '2026-03-01',
        note: '预算',
        createdAt: '2026-03-01 10:00:00',
      },
    ])
  })

  it('replaces one project cost phase and derives amount from quantity and unit cost', async () => {
    dbExecMock.mockReturnValue([])

    await projectCostService.saveByProjectAndPhase(3, 'actual', [
      {
        category: 'machine',
        itemName: '摊铺机',
        spec: '',
        unit: '台班',
        quantity: 2,
        unitCost: 1500,
        amount: 0,
        occurredOn: '2026-06-01',
        note: '完工核算',
      },
    ])

    expect(withTransactionMock).toHaveBeenCalledTimes(1)
    expect(dbRunMock).toHaveBeenCalledWith(
      'DELETE FROM project_cost_entries WHERE project_id = ? AND phase = ?',
      [3, 'actual'],
    )
    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO project_cost_entries'),
      [
        3,
        'actual',
        'machine',
        '摊铺机',
        '',
        '台班',
        2,
        1500,
        3000,
        '2026-06-01',
        '完工核算',
      ],
    )
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
  })
})
