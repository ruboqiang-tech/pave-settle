import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contract } from '@/types'

const {
  settlementServiceMock,
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
  settlementServiceMock: {
    getByProjectId: vi.fn(),
    recalculateProjectChain: vi.fn(),
  },
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

vi.mock('./settlement.service', () => ({
  settlementService: settlementServiceMock,
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

import { contractService } from './contract.service'

function makeContractInput(): Omit<Contract, 'id'> {
  return {
    projectId: 1,
    contractNo: 'HT-001',
    contractName: '????',
    contractDate: '2026-04-01',
    noTaxAmount: 100,
    contractTaxRate: 9,
    taxAmount: 9,
    contractAmount: 109,
    amountSource: 'manual',
    summary: '??',
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
  settlementServiceMock.getByProjectId.mockResolvedValue([])
  settlementServiceMock.recalculateProjectChain.mockResolvedValue(undefined)
})

describe('contract.service', () => {
  it('creates a contract and persists it', async () => {
    const input = makeContractInput()
    dbExecMock.mockReturnValue([])
    getLastInsertIdMock.mockReturnValue(11)

    const result = await contractService.create(input)

    expect(dbRunMock).toHaveBeenCalledTimes(1)
    expect(dbRunMock.mock.calls[0][0]).toContain('INSERT INTO contracts')
    expect(dbRunMock.mock.calls[0][1]).toEqual([
      input.projectId,
      input.contractNo,
      input.contractName,
      input.contractDate,
      input.noTaxAmount,
      input.contractTaxRate,
      input.taxAmount,
      input.contractAmount,
      input.amountSource,
      input.summary,
    ])
    expect(getLastInsertIdMock).toHaveBeenCalledTimes(1)
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ...input,
      id: 11,
    })
  })

  it('rejects duplicate contract numbers on create with a clear error', async () => {
    dbExecMock.mockReturnValue([{ columns: ['1'], values: [[1]] }])

    await expect(contractService.create(makeContractInput())).rejects.toThrow('合同编号已存在')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate contract numbers on update with a clear error', async () => {
    dbExecMock.mockReturnValue([{ columns: ['1'], values: [[1]] }])

    await expect(contractService.update(11, { contractNo: 'HT-002' })).rejects.toThrow('合同编号已存在')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('maps a UNIQUE violation on create to a contract number error', async () => {
    const input = makeContractInput()
    dbExecMock.mockReturnValue([])
    dbRunMock.mockImplementation(() => {
      throw new Error('UNIQUE constraint failed: contracts.contract_no')
    })

    await expect(contractService.create(input)).rejects.toThrow('合同编号已存在')
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('deletes contract rows and related attachment rows', async () => {
    dbRunMock.mockImplementation(() => undefined)
    const statement = {
      bind: vi.fn(),
      step: vi.fn(() => true),
      getAsObject: vi.fn(() => ({
        id: 11,
        project_id: 1,
        contract_no: 'HT-001',
        contract_name: '测试合同',
        contract_date: '2026-04-01',
        no_tax_amount: 100,
        contract_tax_rate: 9,
        tax_amount: 9,
        contract_amount: 109,
        amount_source: 'manual',
        summary: '',
      })),
      free: vi.fn(),
    }
    getDbMock.mockReturnValue({
      exec: dbExecMock,
      run: dbRunMock,
      prepare: vi.fn(() => statement),
    })
    dbExecMock.mockImplementation(() => [])

    await contractService.delete(11)

    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM bill_of_quantities WHERE contract_id = ?', [11])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM contract_attachments WHERE contract_id = ?', [11])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM contracts WHERE id = ?', [11])
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(settlementServiceMock.recalculateProjectChain).toHaveBeenCalledWith(1)
  })
})
