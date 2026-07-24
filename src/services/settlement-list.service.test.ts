import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  contractServiceMock,
  projectServiceMock,
  settlementServiceMock,
  getDbMock,
} = vi.hoisted(() => ({
  contractServiceMock: {
    getAll: vi.fn(),
  },
  projectServiceMock: {
    getAll: vi.fn(),
  },
  settlementServiceMock: {
    getAll: vi.fn(),
    delete: vi.fn(),
  },
  getDbMock: vi.fn(),
}))

vi.mock('./contract.service', () => ({
  contractService: contractServiceMock,
}))

vi.mock('./project.service', () => ({
  projectService: projectServiceMock,
}))

vi.mock('./settlement.service', () => ({
  settlementService: settlementServiceMock,
}))

vi.mock('./db-core', () => ({
  getDb: getDbMock,
}))

import {
  deleteSettlementAndReloadList,
  getSettlementDeletePreview,
  loadSettlementListSnapshot,
} from './settlement-list.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('settlement-list.service', () => {
  it('loads projects, contracts and settlements as a snapshot', async () => {
    const projects = [{ id: 1, name: '项目A' }]
    const contracts = [{ id: 11, contractName: '合同A' }]
    const settlements = [{ id: 21, settlementNo: 'JS-001-01' }]

    projectServiceMock.getAll.mockResolvedValue(projects)
    contractServiceMock.getAll.mockResolvedValue(contracts)
    settlementServiceMock.getAll.mockResolvedValue(settlements)

    await expect(loadSettlementListSnapshot()).resolves.toEqual({
      projects,
      contracts,
      settlements,
    })
  })

  it('deletes a settlement and reloads the list snapshot', async () => {
    const projects = [{ id: 1, name: '项目A' }]
    const contracts = [{ id: 11, contractName: '合同A' }]
    const settlements = [{ id: 22, settlementNo: 'JS-001-02' }]

    projectServiceMock.getAll.mockResolvedValue(projects)
    contractServiceMock.getAll.mockResolvedValue(contracts)
    settlementServiceMock.getAll.mockResolvedValue(settlements)

    await expect(deleteSettlementAndReloadList(21)).resolves.toEqual({
      projects,
      contracts,
      settlements,
    })

    expect(settlementServiceMock.delete).toHaveBeenCalledWith(21)
  })

  describe('getSettlementDeletePreview', () => {
    it('returns detail and attachment counts from db', async () => {
      const dbHandle = {
        exec: vi.fn()
          .mockReturnValueOnce([{ values: [[3]] }])
          .mockReturnValueOnce([{ values: [[2]] }]),
      }
      getDbMock.mockReturnValue(dbHandle)

      const result = await getSettlementDeletePreview(42)

      expect(result).toEqual({ detailCount: 3, attachmentCount: 2 })
      expect(dbHandle.exec).toHaveBeenCalledTimes(2)
      expect(dbHandle.exec.mock.calls[0][1]).toEqual([42])
      expect(dbHandle.exec.mock.calls[1][1]).toEqual([42])
    })

    it('returns zeros when db is unavailable', async () => {
      getDbMock.mockReturnValue(null)

      const result = await getSettlementDeletePreview(42)

      expect(result).toEqual({ detailCount: 0, attachmentCount: 0 })
    })

    it('returns zeros when query result is empty', async () => {
      const dbHandle = {
        exec: vi.fn().mockReturnValue([]),
      }
      getDbMock.mockReturnValue(dbHandle)

      const result = await getSettlementDeletePreview(42)

      expect(result).toEqual({ detailCount: 0, attachmentCount: 0 })
    })
  })
})
