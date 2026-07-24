import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillOfQuantities, Contract, Project, Settlement } from '@/types'

const {
  projectServiceMock,
  contractServiceMock,
  boqServiceMock,
  settlementServiceMock,
  contractAttachmentServiceMock,
  prepareBoqItemsForSaveMock,
  recalculateBoqRowMock,
} = vi.hoisted(() => ({
  projectServiceMock: {
    getById: vi.fn(),
    update: vi.fn(),
  },
  contractServiceMock: {
    getAll: vi.fn(),
    getAllByProjectId: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  boqServiceMock: {
    getByContractId: vi.fn(),
    saveByContractId: vi.fn(),
  },
  settlementServiceMock: {
    getByProjectId: vi.fn(),
  },
  contractAttachmentServiceMock: {
    getByContractId: vi.fn(),
  },
  prepareBoqItemsForSaveMock: vi.fn(),
  recalculateBoqRowMock: vi.fn(),
}))

vi.mock('./project.service', () => ({
  projectService: projectServiceMock,
}))

vi.mock('./contract.service', () => ({
  contractService: contractServiceMock,
  boqService: boqServiceMock,
}))

vi.mock('./settlement.service', () => ({
  settlementService: settlementServiceMock,
}))

vi.mock('./attachment.service', () => ({
  contractAttachmentService: contractAttachmentServiceMock,
}))

vi.mock('@/utils/boq', () => ({
  prepareBoqItemsForSave: prepareBoqItemsForSaveMock,
  recalculateBoqRow: recalculateBoqRowMock,
}))

import {
  createProjectContractWithBoq,
  deleteProjectContractAndReloadSettlements,
  loadProjectDetailSnapshot,
  updateProjectBasics,
  updateProjectContractWithBoq,
} from './project-detail.service'

function makeProject(): Project {
  return {
    id: 1,
    code: 'XM-001',
    name: '项目A',
    projectType: 'highway',
    location: '测试地点',
    ownerUnit: '业主A',
    generalContractor: '总包A',
    startDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    actualEndDate: '',
    status: 'settling',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: 11,
    projectId: 1,
    contractNo: 'HT-001-01',
    contractName: '合同A',
    contractDate: '2026-01-02',
    noTaxAmount: 2,
    contractTaxRate: 9,
    taxAmount: 0.18,
    contractAmount: 2.18,
    amountSource: 'auto',
    summary: '',
    ...overrides,
  }
}

function makeSettlement(): Settlement {
  return {
    id: 21,
    projectId: 1,
    contractIds: [11],
    settlementNo: 'JS-001-01',

    settlementType: 'interim',
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    previousCumulative: 0,
    currentAmount: 2.18,
    currentCumulative: 2.18,
    materialAdjustment: 0,
    changeAmount: 0,
    deductionAmount: 0,
    surchargeAmount: 0,
    changeRemark: '',
    materialRemark: '',
    surchargeRemark: '',
    deductionRemark: '',
    remark: '',
    status: 'confirmed',
    createdAt: '2026-02-28T00:00:00.000Z',
  }
}

function makeBoq(overrides: Partial<BillOfQuantities> = {}): BillOfQuantities {
  return {
    id: 31,
    contractId: 11,
    itemCode: 'A-01',
    itemName: '清单项A',
    remark: '桥头搭接',
    unit: 'm2',
    quantity: 1,
    taxRate: 9,
    noTaxUnitPrice: 2,
    unitPrice: 2.18,
    noTaxTotalPrice: 2,
    taxAmount: 0.18,
    totalPrice: 2.18,
    category: '',
    chapterCode: '',
    sortOrder: 1,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('project-detail.service', () => {
  it('returns null when project detail snapshot target does not exist', async () => {
    projectServiceMock.getById.mockResolvedValue(null)

    await expect(loadProjectDetailSnapshot(999)).resolves.toBeNull()

    expect(contractServiceMock.getAllByProjectId).not.toHaveBeenCalled()
    expect(settlementServiceMock.getByProjectId).not.toHaveBeenCalled()
  })

  it('loads a project detail snapshot with contract entries and attachment counts', async () => {
    const project = makeProject()
    const contract = makeContract()
    const settlement = makeSettlement()
    const boq = makeBoq()

    projectServiceMock.getById.mockResolvedValue(project)
    contractServiceMock.getAll.mockResolvedValue([{ ...contract, id: 99, projectId: 2, contractNo: 'HT-999' }])
    contractServiceMock.getAllByProjectId.mockResolvedValue([contract])
    settlementServiceMock.getByProjectId.mockResolvedValue([settlement])
    boqServiceMock.getByContractId.mockResolvedValue([boq])
    contractAttachmentServiceMock.getByContractId.mockResolvedValue([{ id: 1 }, { id: 2 }])

    const snapshot = await loadProjectDetailSnapshot(project.id)

    expect(snapshot).toEqual({
      project,
      contracts: [contract],
      settlements: [settlement],
      contractEntries: [{
        contract,
        items: [boq],
        attachmentCount: 2,
      }],
      nextContractNo: 'HT-001-02',
    })
    expect(recalculateBoqRowMock).toHaveBeenCalledTimes(1)
    expect(recalculateBoqRowMock).toHaveBeenCalledWith(expect.objectContaining({ id: boq.id }))
  })

  it('creates a contract with boq items and reloads settlements', async () => {
    const createdContract = makeContract({
      id: 12,
      contractNo: 'HT-NEW',
      contractName: 'New Contract',
      noTaxAmount: 0,
      taxAmount: 0,
      contractAmount: 0,
      contractTaxRate: 0,
    })
    const persistedContract = {
      ...createdContract,
      noTaxAmount: 2,
      taxAmount: 0.18,
      contractAmount: 2.18,
      contractTaxRate: 9,
    }
    const settlement = makeSettlement()
    const boq = makeBoq({ id: 41, contractId: 12 })
    const preparedItems = [{ itemName: '清单项A' }]

    contractServiceMock.create.mockResolvedValue(createdContract)
    prepareBoqItemsForSaveMock.mockReturnValue(preparedItems)
    boqServiceMock.saveByContractId.mockResolvedValue({
      items: [boq],
    })
    contractServiceMock.getById.mockResolvedValue(persistedContract)
    settlementServiceMock.getByProjectId.mockResolvedValue([settlement])

    const result = await createProjectContractWithBoq({
      projectId: 1,
      contractNo: 'HT-NEW',
      contractName: 'New Contract',
      contractDate: '2026-03-01',
      summary: '备注',
      boqItems: [boq],
    })

    expect(contractServiceMock.create).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 1,
      contractNo: 'HT-NEW',
      amountSource: 'auto',
    }))
    expect(prepareBoqItemsForSaveMock).toHaveBeenCalledWith(12, [boq])
    expect(boqServiceMock.saveByContractId).toHaveBeenCalledWith(12, preparedItems)
    expect(result).toEqual({
      contract: persistedContract,
      boqItems: [boq],
      settlements: [settlement],
    })
  })

  it('updates a contract with boq items and reloads settlements', async () => {
    const contract = makeContract()
    const settlement = makeSettlement()
    const boq = makeBoq()
    const preparedItems = [{ itemName: '清单项A-更新' }]

    prepareBoqItemsForSaveMock.mockReturnValue(preparedItems)
    boqServiceMock.saveByContractId.mockResolvedValue({
      items: [boq],
    })
    contractServiceMock.getById.mockResolvedValue(contract)
    settlementServiceMock.getByProjectId.mockResolvedValue([settlement])

    const result = await updateProjectContractWithBoq(contract.id, {
      projectId: 1,
      contractNo: contract.contractNo,
      contractName: contract.contractName,
      contractDate: contract.contractDate,
      summary: '更新备注',
      boqItems: [boq],
    })

    expect(contractServiceMock.update).toHaveBeenCalledWith(contract.id, {
      contractNo: contract.contractNo,
      contractName: contract.contractName,
      contractDate: contract.contractDate,
      summary: '更新备注',
    })
    expect(prepareBoqItemsForSaveMock).toHaveBeenCalledWith(contract.id, [boq])
    expect(boqServiceMock.saveByContractId).toHaveBeenCalledWith(contract.id, preparedItems)
    expect(result).toEqual({
      contract,
      boqItems: [boq],
      settlements: [settlement],
    })
  })

  it('throws when persisted contract cannot be reloaded after update', async () => {
    const contract = makeContract()
    contractServiceMock.getById
      .mockResolvedValueOnce(contract)
      .mockResolvedValueOnce(null)
    prepareBoqItemsForSaveMock.mockReturnValue([])
    boqServiceMock.saveByContractId.mockResolvedValue({
      items: [],
    })

    await expect(updateProjectContractWithBoq(contract.id, {
      projectId: 1,
      contractNo: contract.contractNo,
      contractName: contract.contractName,
      contractDate: contract.contractDate,
      summary: contract.summary,
      boqItems: [],
    })).rejects.toThrow('合同保存后读取失败')
  })

  it('deletes a contract and reloads project settlements', async () => {
    const settlements = [makeSettlement()]
    settlementServiceMock.getByProjectId.mockResolvedValue(settlements)

    await expect(deleteProjectContractAndReloadSettlements(1, 11)).resolves.toEqual(settlements)

    expect(contractServiceMock.delete).toHaveBeenCalledWith(11)
    expect(settlementServiceMock.getByProjectId).toHaveBeenCalledWith(1)
  })

  it('updates project basics and returns the refreshed project', async () => {
    const updatedProject = {
      ...makeProject(),
      name: '项目A-更新',
    }
    projectServiceMock.getById.mockResolvedValue(updatedProject)

    await expect(updateProjectBasics(1, {
      code: updatedProject.code,
      name: '项目A-更新',
      location: updatedProject.location,
      ownerUnit: updatedProject.ownerUnit,
      generalContractor: updatedProject.generalContractor,
      status: updatedProject.status,
      plannedEndDate: updatedProject.plannedEndDate,
    })).resolves.toEqual(updatedProject)

    expect(projectServiceMock.update).toHaveBeenCalledWith(1, expect.objectContaining({
      name: '项目A-更新',
    }))
  })

  it('throws when refreshed project cannot be reloaded after update', async () => {
    projectServiceMock.getById.mockResolvedValue(null)

    await expect(updateProjectBasics(1, {
      code: 'XM-001',
      name: '项目A-更新',
      location: '测试地点',
      ownerUnit: '业主A',
      generalContractor: '总包A',
      status: 'settling',
      plannedEndDate: '2026-12-31',
    })).rejects.toThrow('项目更新后读取失败')
  })

  it('rolls back contract creation when boq save fails', async () => {
    const createdContract = makeContract({ id: 12, contractNo: 'HT-NEW', contractName: '�º�ͬ' })
    contractServiceMock.create.mockResolvedValue(createdContract)
    prepareBoqItemsForSaveMock.mockReturnValue([{ itemName: 'new-boq' }])
    boqServiceMock.saveByContractId.mockRejectedValue(new Error('boom'))

    await expect(createProjectContractWithBoq({
      projectId: 1,
      contractNo: 'HT-NEW',
      contractName: '�º�ͬ',
      contractDate: '2026-03-01',
      summary: '��ע',
      boqItems: [{ id: 1 }],
    })).rejects.toThrow('boom')

    expect(contractServiceMock.delete).toHaveBeenCalledWith(createdContract.id)
    expect(settlementServiceMock.getByProjectId).not.toHaveBeenCalled()
  })

  it('restores the original contract when boq save fails during update', async () => {
    const contract = makeContract()
    contractServiceMock.getById.mockResolvedValue(contract)
    prepareBoqItemsForSaveMock.mockReturnValue([{ itemName: 'updated-boq' }])
    boqServiceMock.saveByContractId.mockRejectedValue(new Error('boom'))

    await expect(updateProjectContractWithBoq(contract.id, {
      projectId: 1,
      contractNo: 'HT-UPDATED',
      contractName: '��ͬ����',
      contractDate: '2026-03-02',
      summary: '���±�ע',
      boqItems: [{ id: 1 }],
    })).rejects.toThrow('boom')

    expect(contractServiceMock.update).toHaveBeenNthCalledWith(1, contract.id, {
      contractNo: 'HT-UPDATED',
      contractName: '��ͬ����',
      contractDate: '2026-03-02',
      summary: '���±�ע',
    })
    expect(contractServiceMock.update).toHaveBeenNthCalledWith(2, contract.id, expect.objectContaining({
      contractNo: contract.contractNo,
      contractName: contract.contractName,
      contractDate: contract.contractDate,
      summary: contract.summary,
    }))
    expect(settlementServiceMock.getByProjectId).not.toHaveBeenCalled()
  })
})


