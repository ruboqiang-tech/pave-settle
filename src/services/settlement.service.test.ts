import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settlement } from '@/types'

const {
  settlementChainMock,
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
  settlementChainMock: {
    buildSettlementChainBoqMap: vi.fn(),
    normalizeSettlementChain: vi.fn(),
    syncSettlementDetailsWithBoq: vi.fn(),
  },
  dbExecMock: vi.fn(),
  dbRunMock: vi.fn(),
  getDbMock: vi.fn(),
  getLastInsertIdMock: vi.fn(),
  getRowNumberMock: vi.fn((row: Record<string, unknown>, key: string) => Number(row[key] ?? 0)),
  getRowStringMock: vi.fn((row: Record<string, unknown>, key: string, defaultValue = '') => String(row[key] ?? defaultValue)),
  execToObjectsMock: vi.fn((rows: Array<Record<string, unknown>>) => rows),
  saveToStorageMock: vi.fn(),
  withTransactionMock: vi.fn(async (callback: () => Promise<unknown> | unknown) => {
    dbRunMock('BEGIN TRANSACTION')
    try {
      const result = await callback()
      dbRunMock('COMMIT')
      return result
    } catch (error) {
      dbRunMock('ROLLBACK')
      throw error
    }
  }),
}))

vi.mock('./settlement-chain', () => settlementChainMock)
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

import { settlementDetailService, settlementService } from './settlement.service'

function makeSettlementInput(): Omit<Settlement, 'id' | 'createdAt'> {
  return {
    projectId: 1,
    contractIds: [11],
    settlementNo: 'JS-001-01',
    settlementType: 'interim',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    previousCumulative: 0,
    currentAmount: 100,
    currentCumulative: 100,
    materialAdjustment: 0,
    changeAmount: 0,
    deductionAmount: 0,
    surchargeAmount: 0,
    changeRemark: '',
    materialRemark: '',
    surchargeRemark: '',
    deductionRemark: '',
    remark: '\u5907\u6ce8',
    status: 'draft',
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
  settlementChainMock.normalizeSettlementChain.mockImplementation((settlements: unknown[], details: Map<number, unknown[]>) => ({
    settlements,
    details,
  }))
})

describe('settlement.service', () => {
  it('creates a settlement and persists it', async () => {
    const input = makeSettlementInput()
    dbExecMock.mockReturnValue([])
    getLastInsertIdMock.mockReturnValue(21)

    const result = await settlementService.create(input)

    expect(dbRunMock).toHaveBeenCalledTimes(1)
    expect(dbRunMock.mock.calls[0][0]).toContain('INSERT INTO settlements')
    expect(dbRunMock.mock.calls[0][1]).toEqual([
      input.projectId,
      JSON.stringify(input.contractIds),
      input.settlementNo,
      input.settlementType,
      input.startDate,
      input.endDate,
      input.previousCumulative,
      input.currentAmount,
      input.currentCumulative,
      input.materialAdjustment,
      input.changeAmount,
      input.deductionAmount,
      input.surchargeAmount,
      input.changeRemark,
      input.materialRemark,
      input.surchargeRemark,
      input.deductionRemark,
      input.remark,
      input.status,
    ])
    expect(getLastInsertIdMock).toHaveBeenCalledTimes(1)
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ...input,
      id: 21,
    })
  })

  it('rejects duplicate settlement numbers on create with a clear error', async () => {
    dbExecMock.mockReturnValue([{ columns: ['1'], values: [[1]] }])

    await expect(settlementService.create(makeSettlementInput())).rejects.toThrow('\u7ed3\u7b97\u5355\u53f7\u5df2\u5b58\u5728')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rejects duplicate settlement numbers on update with a clear error', async () => {
    dbExecMock.mockReturnValue([{ columns: ['1'], values: [[1]] }])

    await expect(settlementService.update(21, { settlementNo: 'JS-001-02' })).rejects.toThrow('\u7ed3\u7b97\u5355\u53f7\u5df2\u5b58\u5728')
    expect(dbRunMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('maps a UNIQUE violation on create to a settlement number error', async () => {
    const input = makeSettlementInput()
    dbExecMock.mockReturnValue([])
    dbRunMock.mockImplementation(() => {
      throw new Error('UNIQUE constraint failed: settlements.settlement_no')
    })

    await expect(settlementService.create(input)).rejects.toThrow('\u7ed3\u7b97\u5355\u53f7\u5df2\u5b58\u5728')
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rolls back createBatch when an insert fails', async () => {
    dbRunMock.mockImplementation((sql: string) => {
      if (sql === 'BEGIN TRANSACTION') return
      if (String(sql).includes('INSERT INTO settlement_details')) {
        throw new Error('boom')
      }
    })

    await expect(settlementDetailService.createBatch([
      {
        settlementId: 1,
        boqId: 1,
        contractId: 1,
        itemCode: 'A-01',
        itemName: 'detail',
        remark: '',
        unit: 'm2',
        contractQuantity: 1,
        previousCumulative: 0,
        currentQuantity: 1,
        currentCumulative: 1,
        unitPrice: 1,
        currentAmount: 1,
      },
    ])).rejects.toThrow('boom')

    expect(dbRunMock).toHaveBeenCalledWith('BEGIN TRANSACTION')
    expect(dbRunMock).toHaveBeenCalledWith('ROLLBACK')
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rejects selecting contracts outside the settlement project when saving details', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ? LIMIT 1')) {
        return [{ id: 1 }]
      }
      if (sql.includes('FROM contracts WHERE project_id = ? AND id IN')) {
        return []
      }
      if (sql.includes('FROM settlements WHERE settlement_no')) {
        return []
      }
      return []
    })

    await expect(settlementService.saveWithDetails({
      settlement: {
        ...makeSettlementInput(),
        contractIds: [99],
      },
      details: [
        {
          settlementId: 0,
          boqId: 101,
          contractId: 99,
          itemCode: 'A-01',
          itemName: 'detail',
          remark: '',
          unit: 'm2',
          contractQuantity: 1,
          previousCumulative: 0,
          currentQuantity: 1,
          currentCumulative: 1,
          unitPrice: 1,
          currentAmount: 1,
        },
      ],
    })).rejects.toThrow('所选合同不存在、已删除，或不属于当前项目')

    expect(withTransactionMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rejects detail rows whose contract does not match boq ownership', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ? LIMIT 1')) {
        return [{ id: 1 }]
      }
      if (sql.includes('FROM contracts WHERE project_id = ? AND id IN')) {
        return [{ id: 11 }]
      }
      if (sql.includes('FROM bill_of_quantities WHERE id IN')) {
        return [{ id: 101, contract_id: 11 }]
      }
      if (sql.includes('FROM settlements WHERE settlement_no')) {
        return []
      }
      return []
    })

    await expect(settlementService.saveWithDetails({
      settlement: makeSettlementInput(),
      details: [
        {
          settlementId: 0,
          boqId: 101,
          contractId: 22,
          itemCode: 'A-01',
          itemName: 'detail',
          remark: '',
          unit: 'm2',
          contractQuantity: 1,
          previousCumulative: 0,
          currentQuantity: 1,
          currentCumulative: 1,
          unitPrice: 1,
          currentAmount: 1,
        },
      ],
    })).rejects.toThrow('结算明细合同与清单归属不一致')

    expect(withTransactionMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('rejects negative current quantities when saving details', async () => {
    dbExecMock.mockImplementation((sql: string) => {
      if (sql.includes('FROM projects WHERE id = ? LIMIT 1')) {
        return [{ id: 1 }]
      }
      if (sql.includes('FROM contracts WHERE project_id = ? AND id IN')) {
        return [{ id: 11 }]
      }
      if (sql.includes('FROM bill_of_quantities WHERE id IN')) {
        return [{ id: 101, contract_id: 11, quantity: 10 }]
      }
      if (sql.includes('SELECT * FROM settlements WHERE project_id = ? ORDER BY start_date')) {
        return []
      }
      if (sql.includes('FROM settlements WHERE settlement_no')) {
        return []
      }
      return []
    })

    await expect(settlementService.saveWithDetails({
      settlement: makeSettlementInput(),
      details: [
        {
          settlementId: 0,
          boqId: 101,
          contractId: 11,
          itemCode: 'A-01',
          itemName: 'detail',
          remark: '',
          unit: 'm2',
          contractQuantity: 10,
          previousCumulative: 0,
          currentQuantity: -1,
          currentCumulative: -1,
          unitPrice: 1,
          currentAmount: -1,
        },
      ],
    })).rejects.toThrow('结算明细本期工程量不能小于 0')

    expect(withTransactionMock).not.toHaveBeenCalled()
    expect(saveToStorageMock).not.toHaveBeenCalled()
  })

  it('deletes settlement rows and cleans stored attachment files', async () => {
    const statement = {
      bind: vi.fn(),
      step: vi.fn(() => true),
      getAsObject: vi.fn(() => ({
        id: 21,
        project_id: 9,
        contract_ids: '[11]',
        settlement_no: 'JS-001',
        settlement_type: 'interim',
        start_date: '2026-04-01',
        end_date: '2026-04-30',
        previous_cumulative: 0,
        current_amount: 100,
        current_cumulative: 100,
        material_adjustment: 0,
        change_amount: 0,
        deduction_amount: 0,
        surcharge_amount: 0,
        change_remark: '',
        material_remark: '',
        surcharge_remark: '',
        deduction_remark: '',
        remark: '',
        status: 'draft',
        created_at: '2026-04-20T10:00:00.000Z',
      })),
      free: vi.fn(),
    }
    getDbMock.mockReturnValue({
      exec: dbExecMock,
      run: dbRunMock,
      prepare: vi.fn(() => statement),
    })
    const recalculateSpy = vi.spyOn(settlementService, 'recalculateProjectChain').mockResolvedValue(undefined)

    await settlementService.delete(21)

    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM settlement_details WHERE settlement_id = ?', [21])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM settlement_attachments WHERE settlement_id = ?', [21])
    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM settlements WHERE id = ?', [21])
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(recalculateSpy).toHaveBeenCalledWith(9)
  })

})




