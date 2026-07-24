import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@/types'

const {
  dbExecMock,
  dbRunMock,
  getDbMock,
  getLastInsertIdMock,
  getRowNumberMock,
  getRowStringMock,
  execToObjectsMock,
  saveToStorageMock,
  withTransactionMock,
} = vi.hoisted(() => ({
  dbExecMock: vi.fn(),
  dbRunMock: vi.fn(),
  getDbMock: vi.fn(),
  getLastInsertIdMock: vi.fn(),
  getRowNumberMock: vi.fn((row: Record<string, unknown>, key: string) => Number(row[key] ?? 0)),
  getRowStringMock: vi.fn((row: Record<string, unknown>, key: string, defaultValue = '') => String(row[key] ?? defaultValue)),
  execToObjectsMock: vi.fn((rows: Array<Record<string, unknown>>) => rows),
  saveToStorageMock: vi.fn(),
  withTransactionMock: vi.fn(async (operation: (database: { exec: typeof dbExecMock; run: typeof dbRunMock; prepare: ReturnType<typeof vi.fn> }) => Promise<unknown> | unknown) => {
    const database = {
      exec: dbExecMock,
      run: dbRunMock,
      prepare: vi.fn(),
    }
    dbRunMock('BEGIN TRANSACTION')
    try {
      const result = await operation(database)
      dbRunMock('COMMIT')
      return result
    } catch (error) {
      dbRunMock('ROLLBACK')
      throw error
    }
  }),
}))

vi.mock('./db-core', () => ({
  execToObjects: execToObjectsMock,
  getDb: getDbMock,
  getGlobalDb: getDbMock,
  getLastInsertId: getLastInsertIdMock,
  getRowNumber: getRowNumberMock,
  getRowString: getRowStringMock,
  saveToStorage: saveToStorageMock,
  saveGlobalToStorage: saveToStorageMock,
  withTransaction: withTransactionMock,
  withGlobalTransaction: withTransactionMock,
}))

import { projectService } from './project.service'

function makeProjectInput(): Omit<Project, 'id' | 'createdAt'> {
  return {
    code: 'XM-001',
    name: '????',
    projectType: 'highway',
    location: '????',
    ownerUnit: '????',
    generalContractor: '????',
    startDate: '2026-04-01',
    plannedEndDate: '2026-12-31',
    actualEndDate: '2026-10-01',
    status: 'preparing',
  }
}

function makeDbHandle() {
  return {
    exec: dbExecMock,
    run: dbRunMock,
    prepare: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getDbMock.mockReturnValue(makeDbHandle())
})

describe('project.service', () => {
  it('creates a project and persists the actual end date', async () => {
    const input = makeProjectInput()
    dbExecMock.mockReturnValue([])
    getLastInsertIdMock.mockReturnValue(42)

    const result = await projectService.create(input)

    expect(dbRunMock).toHaveBeenCalledTimes(1)
    expect(dbRunMock.mock.calls[0][0]).toContain('INSERT INTO projects')
    expect(dbRunMock.mock.calls[0][1]).toEqual([
      input.code,
      input.name,
      input.projectType,
      input.location,
      input.ownerUnit,
      input.generalContractor,
      input.startDate,
      input.plannedEndDate,
      input.actualEndDate,
      input.status,
      'medium',
    ])
    expect(getLastInsertIdMock).toHaveBeenCalledTimes(1)
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ...input,
      id: 42,
    })
    expect(result.createdAt).toEqual(expect.any(String))
  })

  it('rejects duplicate project codes on create with a clear error', async () => {
    dbExecMock.mockReturnValue([{ columns: ['id'], values: [[1]] }])

    await expect(projectService.create(makeProjectInput())).rejects.toThrow('项目编码已存在')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate project codes on update with a clear error', async () => {
    dbExecMock.mockReturnValue([{ columns: ['id'], values: [[2]] }])

    await expect(projectService.update(1, { code: 'XM-002' })).rejects.toThrow('项目编码已存在')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('maps a UNIQUE violation on create to a project code error', async () => {
    const input = makeProjectInput()
    dbExecMock.mockReturnValue([])
    dbRunMock.mockImplementation(() => {
      throw new Error('UNIQUE constraint failed: projects.code')
    })

    await expect(projectService.create(input)).rejects.toThrow('项目编码已存在')
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('deletes project rows together with related attachment rows', async () => {
    dbRunMock.mockImplementation(() => undefined)
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('SELECT id FROM settlements WHERE project_id = ?')) {
        return [{ values: [[101], [102]] }]
      }
      if (sql.includes('SELECT id FROM contracts WHERE project_id = ?')) {
        return [{ values: [[201]] }]
      }
      return []
    })

    await projectService.delete(1)

    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM settlement_attachments WHERE settlement_id IN (?,?)', [101, 102])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM contract_attachments WHERE contract_id IN (?)', [201])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM settlements WHERE project_id = ?', [1])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM contracts WHERE project_id = ?', [1])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM project_cost_entries WHERE project_id = ?', [1])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM projects WHERE id = ?', [1])
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
  })
})
