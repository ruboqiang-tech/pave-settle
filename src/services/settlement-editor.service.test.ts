import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BillOfQuantities, Contract, Project, Settlement, SettlementDetail } from '@/types'

const {
  boqServiceMock,
  contractServiceMock,
  projectServiceMock,
  settlementAttachmentServiceMock,
  settlementDetailServiceMock,
  settlementServiceMock,
} = vi.hoisted(() => ({
  boqServiceMock: {
    getByContractId: vi.fn(),
  },
  contractServiceMock: {
    getAllByProjectId: vi.fn(),
    getById: vi.fn(),
  },
  projectServiceMock: {
    getById: vi.fn(),
  },
  settlementAttachmentServiceMock: {
    create: vi.fn(),
    delete: vi.fn(),
  },
  settlementDetailServiceMock: {
    getBySettlementId: vi.fn(),
    getStoredBySettlementId: vi.fn(),
  },
  settlementServiceMock: {
    delete: vi.fn(),
    getById: vi.fn(),
    getByProjectId: vi.fn(),
    saveWithDetails: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('./contract.service', () => ({
  boqService: boqServiceMock,
  contractService: contractServiceMock,
}))

vi.mock('./project.service', () => ({
  projectService: projectServiceMock,
}))

vi.mock('./attachment.service', () => ({
  settlementAttachmentService: settlementAttachmentServiceMock,
}))

vi.mock('./settlement.service', () => ({
  settlementDetailService: settlementDetailServiceMock,
  settlementService: settlementServiceMock,
}))

import {
  loadSettlementEditorSnapshot,
  revertSettlementEditorToDraft,
  saveSettlementEditor,
} from './settlement-editor.service'

function makeProject(): Project {
  return {
    id: 1,
    code: 'XM-001',
    name: '椤圭洰A',
    projectType: 'highway',
    location: '娴嬭瘯鍦扮偣',
    ownerUnit: '涓氫富A',
    generalContractor: '鎬诲寘A',
    startDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    actualEndDate: '',
    status: 'settling',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeContract(): Contract {
  return {
    id: 11,
    projectId: 1,
    contractNo: 'HT-001-01',
    contractName: '鍚堝悓A',

    contractDate: '2026-01-02',
    noTaxAmount: 200,
    contractTaxRate: 9,
    taxAmount: 18,
    contractAmount: 218,
    amountSource: 'auto',
    summary: '',
  }
}

function makeBoq(): BillOfQuantities {
  return {
    id: 31,
    contractId: 11,
    itemCode: 'A-01',
    itemName: '娓呭崟椤笰',
    remark: '妗ュご鎼帴',
    unit: 'm2',
    quantity: 100,
    taxRate: 9,
    noTaxUnitPrice: 2,
    unitPrice: 2.18,
    noTaxTotalPrice: 200,
    taxAmount: 18,
    totalPrice: 218,
    category: '',
    chapterCode: '',
    sortOrder: 1,
  }
}

function makeSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: 21,
    projectId: 1,
    contractIds: [11],
    settlementNo: 'JS-001-01',
    settlementType: 'interim',
    startDate: '2026-02-01',
    endDate: '2026-02-28',
    previousCumulative: 0,
    currentAmount: 20,
    currentCumulative: 20,
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
    ...overrides,
  }
}

function makeStoredDetail(overrides: Partial<SettlementDetail> = {}): SettlementDetail {
  return {
    id: 41,
    settlementId: 21,
    boqId: 31,
    contractId: 11,
    itemCode: 'A-01',
    itemName: '娓呭崟椤笰',
    remark: '妗ュご鎼帴',
    unit: 'm2',
    contractQuantity: 100,
    previousCumulative: 0,
    currentQuantity: 10,
    currentCumulative: 10,
    unitPrice: 2.18,
    currentAmount: 21.8,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('settlement-editor.service', () => {
  it('loads an existing settlement editor snapshot from stored details', async () => {
    const project = makeProject()
    const contract = makeContract()
    const boq = makeBoq()
    const settlement = makeSettlement()
    const detail = makeStoredDetail()

    settlementServiceMock.getById.mockResolvedValue(settlement)
    projectServiceMock.getById.mockResolvedValue(project)
    contractServiceMock.getById.mockResolvedValue(contract)
    boqServiceMock.getByContractId.mockResolvedValue([boq])
    settlementDetailServiceMock.getBySettlementId.mockResolvedValue([detail])

    const snapshot = await loadSettlementEditorSnapshot({
      settlementId: settlement.id,
      seed: { projectId: project.id },
    })

    expect(snapshot).toMatchObject({
      pageTitle: '编辑结算单',
      projectName: project.name,
      selectedContractIds: [contract.id],
      loadedContracts: [contract],
      detailsLoadedFromFallback: false,
    })
    expect(snapshot?.contractCollections.totalAmount).toBe(contract.contractAmount)
    expect(snapshot?.details[0]).toMatchObject({
      boqId: boq.id,
      contractId: contract.id,
      contractName: contract.contractName,
      remark: boq.remark,
      currentQuantity: detail.currentQuantity,
      currentAmount: detail.currentAmount,
    })
  })

  it('builds a new settlement snapshot from boq fallback when no stored details exist', async () => {
    const project = makeProject()
    const contract = makeContract()
    const boq = makeBoq()
    const previousSettlement = makeSettlement()
    const laterDraftSettlement = makeSettlement({
      id: 22,
      settlementNo: 'JS-001-05',
      settlementType: 'interim',

      startDate: '2026-03-01',
      endDate: '2026-03-31',
      currentAmount: 7,
      currentCumulative: 27,
      status: 'draft',
      createdAt: '2026-03-31T00:00:00.000Z',
    })
    const previousDetail = makeStoredDetail({
      settlementId: previousSettlement.id,
      currentQuantity: 5,
      currentCumulative: 5,
      currentAmount: 10.9,
    })

    projectServiceMock.getById.mockResolvedValue(project)
    contractServiceMock.getAllByProjectId.mockResolvedValue([contract])
    boqServiceMock.getByContractId.mockResolvedValue([boq])
    settlementServiceMock.getByProjectId.mockResolvedValue([previousSettlement, laterDraftSettlement])
    settlementDetailServiceMock.getBySettlementId.mockResolvedValue([previousDetail])

    const snapshot = await loadSettlementEditorSnapshot({
      seed: {
        projectId: project.id,
        settlementType: 'interim',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      },
    })

    const expectedPrefix = 'JS-001-06'


    expect(snapshot).toMatchObject({
      pageTitle: '新建结算单',
      projectName: project.name,
      selectedContractIds: [contract.id],
      detailsLoadedFromFallback: false,
    })
    expect(snapshot?.settlement.projectId).toBe(project.id)
    expect(snapshot?.settlement.previousCumulative).toBe(previousSettlement.currentAmount)
    expect(snapshot?.settlement.currentAmount).toBe(0)
    expect(snapshot?.settlement.currentCumulative).toBe(previousSettlement.currentAmount)
    expect(snapshot?.settlement.settlementNo).toBe(expectedPrefix)
    expect(snapshot?.details[0]).toMatchObject({
      boqId: boq.id,
      contractId: contract.id,
      remark: boq.remark,
      previousCumulative: previousDetail.currentQuantity,
      currentQuantity: 0,
      currentAmount: 0,
    })
  })
  it('uses 001 when existing settlement numbers are all manual', async () => {
    const project = makeProject()
    const contract = makeContract()
    const boq = makeBoq()
    const manualSettlement = makeSettlement({
      settlementNo: '甲方-结算-001',
      currentAmount: 12,
      currentCumulative: 12,
    })

    projectServiceMock.getById.mockResolvedValue(project)
    contractServiceMock.getAllByProjectId.mockResolvedValue([contract])
    boqServiceMock.getByContractId.mockResolvedValue([boq])
    settlementServiceMock.getByProjectId.mockResolvedValue([manualSettlement])
    settlementDetailServiceMock.getBySettlementId.mockResolvedValue([])

    const snapshot = await loadSettlementEditorSnapshot({
      seed: {
        projectId: project.id,
        settlementType: 'interim',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
    })

    expect(snapshot?.settlement.settlementNo).toBe('JS-001-01')

    expect(snapshot?.settlement.previousCumulative).toBe(manualSettlement.currentAmount)
  })

  it('ignores legacy settlement numbers for sequencing and starts from 01', async () => {
    const project = makeProject()
    const contract = makeContract()
    const boq = makeBoq()
    const legacySettlement = makeSettlement({
      settlementNo: 'LEGACY-SETTLEMENT-001',
      currentAmount: 12,
      currentCumulative: 12,
    })


    projectServiceMock.getById.mockResolvedValue(project)
    contractServiceMock.getAllByProjectId.mockResolvedValue([contract])
    boqServiceMock.getByContractId.mockResolvedValue([boq])
    settlementServiceMock.getByProjectId.mockResolvedValue([legacySettlement])
    settlementDetailServiceMock.getBySettlementId.mockResolvedValue([])

    const snapshot = await loadSettlementEditorSnapshot({
      seed: {
        projectId: project.id,
        settlementType: 'interim',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
      },
    })

    expect(snapshot?.settlement.settlementNo).toBe('JS-001-01')
    expect(snapshot?.settlement.previousCumulative).toBe(legacySettlement.currentAmount)
  })


  it('saves settlement editor payload and persists pending attachments', async () => {
    const savePayload = {
      settlement: {
        projectId: 1,
        contractIds: [11],
        settlementNo: 'JS-NEW',

        settlementType: 'interim' as const,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        previousCumulative: 0,
        currentAmount: 10,
        currentCumulative: 10,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
        changeRemark: '',
        materialRemark: '',
        surchargeRemark: '',
        deductionRemark: '',
        remark: '',
        status: 'draft' as const,
      },
      details: [],
    }
    const savedResult = {
      settlement: makeSettlement({ id: 88, settlementNo: 'JS-NEW' }),

      details: [],
    }
    const pendingAttachments = [
      {
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        fileData: 'base64-data',
      },
    ]

    settlementServiceMock.saveWithDetails.mockResolvedValue(savedResult)
    settlementAttachmentServiceMock.create.mockResolvedValue({
      id: 301,
      settlementId: savedResult.settlement.id,
      fileName: 'test.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileData: '',
      uploadedAt: '',
    })

    await expect(saveSettlementEditor(savePayload, pendingAttachments)).resolves.toEqual(savedResult)

    expect(settlementServiceMock.saveWithDetails).toHaveBeenCalledWith(savePayload)
    expect(settlementAttachmentServiceMock.create).toHaveBeenCalledWith({
      settlementId: savedResult.settlement.id,
      fileName: 'test.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileData: 'base64-data',
    }, { skipSave: true })
  })

  it('rolls back a newly created settlement when attachment persistence fails', async () => {
    const savePayload = {
      settlement: {
        projectId: 1,
        contractIds: [11],
        settlementNo: 'JS-NEW',
        settlementType: 'interim' as const,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        previousCumulative: 0,
        currentAmount: 10,
        currentCumulative: 10,
        materialAdjustment: 0,
        changeAmount: 0,
        deductionAmount: 0,
        surchargeAmount: 0,
        changeRemark: '',
        materialRemark: '',
        surchargeRemark: '',
        deductionRemark: '',
        remark: '',
        status: 'draft' as const,
      },
      details: [],
    }
    const savedResult = {
      settlement: makeSettlement({ id: 188, settlementNo: 'JS-NEW', status: 'draft' }),
      details: [],
    }


    settlementServiceMock.saveWithDetails.mockResolvedValue(savedResult)
    settlementAttachmentServiceMock.create.mockRejectedValue(new Error('附件保存失败'))

    await expect(saveSettlementEditor(savePayload, [{
      fileName: 'test.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileData: 'base64-data',
    }])).rejects.toThrow('附件保存失败')

    expect(settlementServiceMock.delete).toHaveBeenCalledWith(savedResult.settlement.id)
    expect(settlementAttachmentServiceMock.delete).not.toHaveBeenCalled()
  })

  it('restores previous settlement snapshot and cleans created attachments on edit failure', async () => {
    const existingSettlement = makeSettlement({ id: 66, settlementNo: 'JS-OLD', currentAmount: 20, currentCumulative: 20 })
    const existingDetail = makeStoredDetail({ settlementId: 66, currentAmount: 21.8, currentQuantity: 10, currentCumulative: 10 })
    const savePayload = {
      settlementId: 66,
      settlement: {
        ...toPlainSettlementInput(makeSettlement({ id: 66, settlementNo: 'JS-UPDATED', currentAmount: 30, currentCumulative: 30, status: 'draft' })),
      },
      details: [{

        settlementId: 66,
        boqId: 31,
        contractId: 11,
        itemCode: 'A-01',
        itemName: '清单项',
        remark: '更新后',
        unit: 'm2',
        contractQuantity: 100,
        previousCumulative: 0,
        currentQuantity: 12,
        currentCumulative: 12,
        unitPrice: 2.18,
        currentAmount: 26.16,
      }],
    }
    const updatedResult = {
      settlement: makeSettlement({ id: 66, settlementNo: 'JS-UPDATED', currentAmount: 30, currentCumulative: 30, status: 'draft' }),
      details: [],
    }


    settlementServiceMock.getById.mockResolvedValue(existingSettlement)
    settlementDetailServiceMock.getStoredBySettlementId.mockResolvedValue([existingDetail])
    settlementServiceMock.saveWithDetails
      .mockResolvedValueOnce(updatedResult)
      .mockResolvedValueOnce({ settlement: existingSettlement, details: [existingDetail] })
    settlementAttachmentServiceMock.create
      .mockResolvedValueOnce({ id: 501, settlementId: 66, fileName: 'ok.pdf', fileType: 'application/pdf', fileSize: 1, fileData: '', uploadedAt: '' })
      .mockRejectedValueOnce(new Error('第二个附件失败'))

    await expect(saveSettlementEditor(savePayload, [
      {
        fileName: 'ok.pdf',
        fileType: 'application/pdf',
        fileSize: 1,
        fileData: 'ok',
      },
      {
        fileName: 'bad.pdf',
        fileType: 'application/pdf',
        fileSize: 2,
        fileData: 'bad',
      },
    ])).rejects.toThrow('第二个附件失败')

    expect(settlementAttachmentServiceMock.delete).toHaveBeenCalledWith(501)
    expect(settlementServiceMock.saveWithDetails).toHaveBeenNthCalledWith(2, {
      settlementId: 66,
      settlement: toPlainSettlementInput(existingSettlement),
      details: [toPlainDetailInput(existingDetail)],
    })
    expect(settlementServiceMock.delete).not.toHaveBeenCalled()
  })

  it('reverts settlement editor status to draft through settlement service', async () => {
    const reverted = makeSettlement({ status: 'draft' })
    settlementServiceMock.updateStatus.mockResolvedValue(reverted)

    await expect(revertSettlementEditorToDraft(reverted.id)).resolves.toEqual(reverted)
    expect(settlementServiceMock.updateStatus).toHaveBeenCalledWith(reverted.id, 'draft')
  })
})

function toPlainSettlementInput(settlement: Settlement) {
  const { id: _id, createdAt: _createdAt, ...rest } = settlement
  return {
    ...rest,
    contractIds: [...settlement.contractIds],
  }
}

function toPlainDetailInput(detail: SettlementDetail) {
  const { id: _id, ...rest } = detail
  return { ...rest }
}

