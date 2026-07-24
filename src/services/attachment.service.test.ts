import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  dbRunMock,
  getDbMock,
  getLastInsertIdMock,
  saveToStorageMock,
} = vi.hoisted(() => ({
  dbRunMock: vi.fn(),
  getDbMock: vi.fn(),
  getLastInsertIdMock: vi.fn(),
  saveToStorageMock: vi.fn(),
}))

vi.mock('./db-core', () => ({
  getDb: getDbMock,
  getLastInsertId: getLastInsertIdMock,
  saveToStorage: saveToStorageMock,
  execToObjects: vi.fn((rows: Array<Record<string, unknown>>) => rows),
}))

import { contractAttachmentService, settlementAttachmentService } from './attachment.service'

beforeEach(() => {
  vi.clearAllMocks()
  getDbMock.mockReturnValue({
    exec: vi.fn(),
    run: dbRunMock,
    prepare: vi.fn(() => ({
      bind: vi.fn(),
      step: vi.fn(() => false),
      getAsObject: vi.fn(),
      free: vi.fn(),
    })),
  })
})

describe('attachment.service', () => {
  it('stores contract attachment content in SQLite', async () => {
    getLastInsertIdMock.mockReturnValue(7)

    const result = await contractAttachmentService.create({
      contractId: 11,
      fileName: 'contract.txt',
      fileType: 'text/plain',
      fileSize: 12,
      fileData: 'YmFzZTY0',
    })

    expect(dbRunMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO contract_attachments'),
      [11, 'contract.txt', 'text/plain', 12, 'YmFzZTY0'],
    )
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      id: 7,
      contractId: 11,
      fileData: 'YmFzZTY0',
    })
  })

  it('returns inline contract attachment data directly', async () => {
    const statement = {
      bind: vi.fn(),
      step: vi.fn(() => true),
      getAsObject: vi.fn(() => ({
        id: 5,
        contract_id: 11,
        file_name: 'inline.txt',
        file_type: 'text/plain',
        file_size: 4,
        file_data: 'ZGVtbw==',
        uploaded_at: '2026-04-22T10:00:00.000Z',
      })),
      free: vi.fn(),
    }
    getDbMock.mockReturnValue({
      exec: vi.fn(),
      run: dbRunMock,
      prepare: vi.fn(() => statement),
    })

    const result = await contractAttachmentService.getById(5)

    expect(result).toMatchObject({
      id: 5,
      fileData: 'ZGVtbw==',
    })
  })

  it('returns attachment list metadata without file payload', async () => {
    const execMock = vi.fn(() => ([{
      id: 3,
      settlement_id: 8,
      file_name: 'summary.pdf',
      file_type: 'application/pdf',
      file_size: 256,
      uploaded_at: '2026-04-22T10:00:00.000Z',
    }]))
    getDbMock.mockReturnValue({
      exec: execMock,
      run: dbRunMock,
      prepare: vi.fn(),
    })

    const result = await settlementAttachmentService.getBySettlementId(8)

    expect(execMock).toHaveBeenCalled()
    expect(result).toEqual([
      {
        id: 3,
        settlementId: 8,
        fileName: 'summary.pdf',
        fileType: 'application/pdf',
        fileSize: 256,
        fileData: '',
        uploadedAt: '2026-04-22T10:00:00.000Z',
      },
    ])
  })

  it('deletes settlement attachment rows directly from SQLite', async () => {
    await settlementAttachmentService.delete(9)

    expect(dbRunMock).toHaveBeenCalledWith('DELETE FROM settlement_attachments WHERE id = ?', [9])
    expect(saveToStorageMock).toHaveBeenCalledTimes(1)
  })
})
