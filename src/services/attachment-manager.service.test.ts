import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  contractAttachmentServiceMock,
  settlementAttachmentServiceMock,
} = vi.hoisted(() => ({
  contractAttachmentServiceMock: {
    getByContractId: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  settlementAttachmentServiceMock: {
    getBySettlementId: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('./attachment.service', () => ({
  contractAttachmentService: contractAttachmentServiceMock,
  settlementAttachmentService: settlementAttachmentServiceMock,
}))

import {
  contractAttachmentManagerService,
  settlementAttachmentManagerService,
} from './attachment-manager.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('attachment-manager.service', () => {
  it('maps contract attachment manager calls to contract attachment service', async () => {
    const contractAttachment = {
      id: 1,
      contractId: 10,
      fileName: 'contract.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileData: 'demo',
      uploadedAt: '2026-04-09T00:00:00.000Z',
    }

    contractAttachmentServiceMock.getByContractId.mockResolvedValue([contractAttachment])
    contractAttachmentServiceMock.getById.mockResolvedValue(contractAttachment)
    contractAttachmentServiceMock.create.mockResolvedValue(contractAttachment)

    await expect(contractAttachmentManagerService.getList(10)).resolves.toEqual([contractAttachment])
    await expect(contractAttachmentManagerService.getById(1)).resolves.toEqual(contractAttachment)
    await expect(contractAttachmentManagerService.create({
      entityId: 10,
      fileName: 'contract.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileData: 'demo',
    })).resolves.toEqual(contractAttachment)

    await contractAttachmentManagerService.delete(1)

    expect(contractAttachmentServiceMock.getByContractId).toHaveBeenCalledWith(10)
    expect(contractAttachmentServiceMock.getById).toHaveBeenCalledWith(1)
    expect(contractAttachmentServiceMock.create).toHaveBeenCalledWith({
      contractId: 10,
      fileName: 'contract.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileData: 'demo',
    })
    expect(contractAttachmentServiceMock.delete).toHaveBeenCalledWith(1)
  })

  it('maps settlement attachment manager calls to settlement attachment service', async () => {
    const settlementAttachment = {
      id: 2,
      settlementId: 20,
      fileName: 'settlement.pdf',
      fileType: 'application/pdf',
      fileSize: 2048,
      fileData: 'demo',
      uploadedAt: '2026-04-09T00:00:00.000Z',
    }

    settlementAttachmentServiceMock.getBySettlementId.mockResolvedValue([settlementAttachment])
    settlementAttachmentServiceMock.getById.mockResolvedValue(settlementAttachment)
    settlementAttachmentServiceMock.create.mockResolvedValue(settlementAttachment)

    await expect(settlementAttachmentManagerService.getList(20)).resolves.toEqual([settlementAttachment])
    await expect(settlementAttachmentManagerService.getById(2)).resolves.toEqual(settlementAttachment)
    await expect(settlementAttachmentManagerService.create({
      entityId: 20,
      fileName: 'settlement.pdf',
      fileType: 'application/pdf',
      fileSize: 2048,
      fileData: 'demo',
    })).resolves.toEqual(settlementAttachment)

    await settlementAttachmentManagerService.delete(2)

    expect(settlementAttachmentServiceMock.getBySettlementId).toHaveBeenCalledWith(20)
    expect(settlementAttachmentServiceMock.getById).toHaveBeenCalledWith(2)
    expect(settlementAttachmentServiceMock.create).toHaveBeenCalledWith({
      settlementId: 20,
      fileName: 'settlement.pdf',
      fileType: 'application/pdf',
      fileSize: 2048,
      fileData: 'demo',
    })
    expect(settlementAttachmentServiceMock.delete).toHaveBeenCalledWith(2)
  })
})
