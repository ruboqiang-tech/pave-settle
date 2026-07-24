import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDbMock } = vi.hoisted(() => ({
  getDbMock: vi.fn(),
}))

vi.mock('./db-core', () => ({
  getDb: getDbMock,
}))

import { getDataSummary } from './integrity.service'

function createCountResult(value: number) {
  return [{
    columns: ['count'],
    values: [[value]],
  }]
}

describe('integrity.service', () => {
  beforeEach(() => {
    getDbMock.mockReset()
  })

  it('returns empty summary when the database is not initialized', async () => {
    getDbMock.mockReturnValue(null)

    await expect(getDataSummary()).resolves.toEqual({
      projects: 0,
      contracts: 0,
      boqItems: 0,
      confirmedSettlements: 0,
      payments: 0,
    })
  })

  it('reads summary counters from the current database connection', async () => {
    const execMock = vi.fn((sql: string) => {
      if (sql === 'SELECT COUNT(*) FROM projects') return createCountResult(3)
      if (sql === 'SELECT COUNT(*) FROM contracts') return createCountResult(4)
      if (sql === 'SELECT COUNT(*) FROM bill_of_quantities') return createCountResult(5)
      if (sql === "SELECT COUNT(*) FROM settlements WHERE status IN ('confirmed', 'approved')") return createCountResult(6)
      if (sql === 'SELECT COUNT(*) FROM payments') return createCountResult(7)
      return []
    })

    getDbMock.mockReturnValue({
      exec: execMock,
    })

    await expect(getDataSummary()).resolves.toEqual({
      projects: 3,
      contracts: 4,
      boqItems: 5,
      confirmedSettlements: 6,
      payments: 7,
    })
    expect(execMock).toHaveBeenCalledTimes(5)
  })
})
