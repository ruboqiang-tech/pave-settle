import {
  contractAttachmentService,
  settlementAttachmentService,
} from './attachment.service'

export interface AttachmentManagerItem {
  id: number
  fileName: string
  fileType: string
  fileSize: number
  fileData?: string
  uploadedAt?: string
}

export interface AttachmentManagerCreateInput {
  entityId: number
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
}

export interface AttachmentManagerAdapter {
  getList(entityId: number): Promise<AttachmentManagerItem[]>
  getById(id: number): Promise<AttachmentManagerItem | null>
  create(data: AttachmentManagerCreateInput): Promise<AttachmentManagerItem>
  delete(id: number): Promise<void>
}

type ContractAttachmentCreateInput = {
  contractId: number
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
}

type SettlementAttachmentCreateInput = {
  settlementId: number
  fileName: string
  fileType: string
  fileSize: number
  fileData: string
}

interface AttachmentManagerSource<TCreateInput> {
  getList(entityId: number): Promise<AttachmentManagerItem[]>
  getById(id: number): Promise<AttachmentManagerItem | null>
  create(data: TCreateInput): Promise<AttachmentManagerItem>
  delete(id: number): Promise<void>
}

function createAttachmentManagerAdapter<TCreateInput>(
  source: AttachmentManagerSource<TCreateInput>,
  mapCreateInput: (data: AttachmentManagerCreateInput) => TCreateInput,
): AttachmentManagerAdapter {
  return {
    getList: entityId => source.getList(entityId),
    getById: id => source.getById(id),
    create: data => source.create(mapCreateInput(data)),
    delete: id => source.delete(id),
  }
}

export const contractAttachmentManagerService = createAttachmentManagerAdapter<ContractAttachmentCreateInput>(
  {
    getList: entityId => contractAttachmentService.getByContractId(entityId),
    getById: id => contractAttachmentService.getById(id),
    create: (data: ContractAttachmentCreateInput) => contractAttachmentService.create(data),
    delete: id => contractAttachmentService.delete(id),
  },
  data => ({
    contractId: data.entityId,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    fileData: data.fileData,
  }),
)

export const settlementAttachmentManagerService = createAttachmentManagerAdapter<SettlementAttachmentCreateInput>(
  {
    getList: entityId => settlementAttachmentService.getBySettlementId(entityId),
    getById: id => settlementAttachmentService.getById(id),
    create: (data: SettlementAttachmentCreateInput) => settlementAttachmentService.create(data),
    delete: id => settlementAttachmentService.delete(id),
  },
  data => ({
    settlementId: data.entityId,
    fileName: data.fileName,
    fileType: data.fileType,
    fileSize: data.fileSize,
    fileData: data.fileData,
  }),
)
