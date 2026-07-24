import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  exportSettlementSpreadsheetMock,
  loadSettlementEditorSnapshotMock,
  revertSettlementEditorToDraftMock,
  saveSettlementEditorMock,
  buildSettlementSavePayloadMock,
} = vi.hoisted(() => ({
  exportSettlementSpreadsheetMock: vi.fn(),
  loadSettlementEditorSnapshotMock: vi.fn(),
  revertSettlementEditorToDraftMock: vi.fn(),
  saveSettlementEditorMock: vi.fn(),
  buildSettlementSavePayloadMock: vi.fn(),
}))

vi.mock('@/services/settlement-editor.service', () => ({
  loadSettlementEditorSnapshot: loadSettlementEditorSnapshotMock,
  revertSettlementEditorToDraft: revertSettlementEditorToDraftMock,
  saveSettlementEditor: saveSettlementEditorMock,
}))

vi.mock('@/services/spreadsheet.service', () => ({
  exportSettlementSpreadsheet: exportSettlementSpreadsheetMock,
}))

vi.mock('./settlement-detail.helpers', async () => {
  const actual = await vi.importActual<typeof import('./settlement-detail.helpers')>('./settlement-detail.helpers')
  return {
    ...actual,
    buildSettlementSavePayload: buildSettlementSavePayloadMock,
  }
})

import {
  exportSettlementDetail,
  getSettlementDetailListRoute,
  loadSettlementDetailPage,
  saveSettlementDetail,
  undoSettlementDetailConfirm,
} from './settlement-detail.controller'
import { createSettlementDraft } from './settlement-detail.helpers'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('settlement-detail.controller', () => {
  it('loads settlement detail snapshot through settlement editor service', async () => {
    const snapshot = {
      pageTitle: '编辑结算单',
      projectName: '测试项目',
      selectedContractIds: [11],
      loadedContracts: [],
      contractCollections: {
        nameList: [],
        totalAmount: 0,
        amountMap: {},
        nameMap: {},
      },
      settlement: createSettlementDraft({ projectId: 1 }),
      details: [],
      detailsLoadedFromFallback: false,
    }
    loadSettlementEditorSnapshotMock.mockResolvedValue(snapshot)

    await expect(loadSettlementDetailPage({ settlementId: 21, seed: { projectId: 1 } })).resolves.toBe(snapshot)
  })

  it('reverts settlement confirm status with a unified success message', async () => {
    const reverted = { id: 21, status: 'draft' }
    revertSettlementEditorToDraftMock.mockResolvedValue(reverted)

    await expect(undoSettlementDetailConfirm(21)).resolves.toEqual({
      settlement: reverted,
      successMessage: '已撤销确认，可重新编辑',
    })
    expect(revertSettlementEditorToDraftMock).toHaveBeenCalledWith(21)
  })

  it('saves settlement detail payload and returns save semantics for new and existing settlements', async () => {
    const newSettlement = createSettlementDraft({ projectId: 1 })
    const existingSettlement = createSettlementDraft({ projectId: 1 })
    existingSettlement.id = 35
    const details = [{
      boqId: 1,
      contractId: 11,
      contractName: '合同A',
      itemCode: 'A-01',
      itemName: '清单项A',
      unit: 'm2',
      contractQuantity: 100,
      previousCumulative: 0,
      currentQuantity: 10,
      currentCumulative: 10,
      unitPrice: 2,
      currentAmount: 20,
    }]
    const payload = { settlement: { settlementNo: 'JS-001-01' }, details: [] }
    const pendingAttachments = [{
      fileName: 'test.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileData: 'base64',
    }]

    buildSettlementSavePayloadMock.mockReturnValue(payload)
    saveSettlementEditorMock
      .mockResolvedValueOnce({ settlement: { id: 88 }, details: [] })
      .mockResolvedValueOnce({ settlement: { id: 35 }, details: [] })

    await expect(saveSettlementDetail(newSettlement, details as never, 'confirmed', pendingAttachments)).resolves.toEqual({
      savedSettlementId: 88,
      isNewSettlement: true,
      successMessage: '结算单已确认',
    })

    await expect(saveSettlementDetail(existingSettlement, details as never, 'draft')).resolves.toEqual({
      savedSettlementId: 35,
      isNewSettlement: false,
      successMessage: '草稿已保存',
    })

    expect(buildSettlementSavePayloadMock).toHaveBeenNthCalledWith(1, newSettlement, details)
    expect(buildSettlementSavePayloadMock).toHaveBeenNthCalledWith(2, existingSettlement, details)
    expect(saveSettlementEditorMock).toHaveBeenNthCalledWith(1, payload, pendingAttachments)
    expect(saveSettlementEditorMock).toHaveBeenNthCalledWith(2, payload, [])
    expect(newSettlement.id).toBe(88)
  })

  it('restores the original settlement status when save fails', async () => {
    const settlement = createSettlementDraft({ projectId: 1 })
    settlement.id = 35
    settlement.status = 'draft'
    const details = [{
      boqId: 1,
      contractId: 11,
      contractName: '鍚堝悓A',
      itemCode: 'A-01',
      itemName: '娓呭崟椤笰',
      unit: 'm2',
      contractQuantity: 100,
      previousCumulative: 0,
      currentQuantity: 10,
      currentCumulative: 10,
      unitPrice: 2,
      currentAmount: 20,
    }]
    const payload = { settlement: { settlementNo: 'JS-FAIL' }, details: [] }

    buildSettlementSavePayloadMock.mockReturnValue(payload)
    saveSettlementEditorMock.mockRejectedValueOnce(new Error('save failed'))

    await expect(saveSettlementDetail(settlement, details as never, 'confirmed')).rejects.toThrow('save failed')

    expect(settlement.status).toBe('draft')
  })

  it('exports settlement spreadsheet with a unified success message', async () => {
    const saveResult = { canceled: false, fileName: '结算单.xlsx', method: 'browser-download' }
    const payload = {
      settlement: {
        settlementNo: 'JS-001-01',
        settlementType: 'interim' as const,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        changeAmount: 0,
        materialAdjustment: 0,
        surchargeAmount: 0,
        deductionAmount: 0,
        currentAmount: 20,
        previousCumulative: 0,
        currentCumulative: 20,
      },
      projectName: '测试项目',
      contractNames: ['合同A'],
      contractAmount: 200,
      settlementRatio: 10,
      details: [],
    }
    exportSettlementSpreadsheetMock.mockResolvedValue(saveResult)

    await expect(exportSettlementDetail(payload)).resolves.toEqual({
      type: 'success',
      data: saveResult,
      successMessage: '已开始下载：结算单.xlsx',
    })
    expect(exportSettlementSpreadsheetMock).toHaveBeenCalledWith(payload)
  })

  it('returns warning when settlement export is canceled', async () => {
    const payload = {
      settlement: {
        settlementNo: 'JS-001-01',
        settlementType: 'interim' as const,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        changeAmount: 0,
        materialAdjustment: 0,
        surchargeAmount: 0,
        deductionAmount: 0,
        currentAmount: 20,
        previousCumulative: 0,
        currentCumulative: 20,
      },
      contractNames: [],
      contractAmount: 0,
      settlementRatio: 0,
      details: [],
    }
    exportSettlementSpreadsheetMock.mockResolvedValue({
      canceled: true,
      fileName: '结算单.xlsx',
      method: 'file-system-access',
    })

    await expect(exportSettlementDetail(payload)).resolves.toEqual({
      type: 'warning',
      message: '已取消导出',
    })
  })

  it('builds settlement list route', () => {
    expect(getSettlementDetailListRoute()).toBe('/settlements')
  })
})
