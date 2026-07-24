import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  contractAttachmentManagerServiceMock,
  createProjectContractWithBoqMock,
  deleteProjectContractAndReloadSettlementsMock,
  downloadProjectBoqImportTemplateMock,
  exportProjectBoqSpreadsheetMock,
  getFilledBoqItemsMock,
  importProjectBoqCsvRowsMock,
  loadProjectDetailSnapshotMock,
  parseImportedBoqRowsMock,
  updateProjectBasicsMock,
  updateProjectContractWithBoqMock,
  validateBoqItemsMock,
} = vi.hoisted(() => ({
  contractAttachmentManagerServiceMock: {
    getList: vi.fn(),
  },
  createProjectContractWithBoqMock: vi.fn(),
  deleteProjectContractAndReloadSettlementsMock: vi.fn(),
  downloadProjectBoqImportTemplateMock: vi.fn(),
  exportProjectBoqSpreadsheetMock: vi.fn(),
  getFilledBoqItemsMock: vi.fn(),
  importProjectBoqCsvRowsMock: vi.fn(),
  loadProjectDetailSnapshotMock: vi.fn(),
  parseImportedBoqRowsMock: vi.fn(),
  updateProjectBasicsMock: vi.fn(),
  updateProjectContractWithBoqMock: vi.fn(),
  validateBoqItemsMock: vi.fn(),
}))

vi.mock('@/services/attachment-manager.service', () => ({
  contractAttachmentManagerService: contractAttachmentManagerServiceMock,
}))

vi.mock('@/services/project-detail.service', () => ({
  createProjectContractWithBoq: createProjectContractWithBoqMock,
  deleteProjectContractAndReloadSettlements: deleteProjectContractAndReloadSettlementsMock,
  loadProjectDetailSnapshot: loadProjectDetailSnapshotMock,
  updateProjectBasics: updateProjectBasicsMock,
  updateProjectContractWithBoq: updateProjectContractWithBoqMock,
}))

vi.mock('@/services/spreadsheet.service', () => ({
  downloadProjectBoqImportTemplate: downloadProjectBoqImportTemplateMock,
  exportProjectBoqSpreadsheet: exportProjectBoqSpreadsheetMock,
  importProjectBoqCsvRows: importProjectBoqCsvRowsMock,
}))

vi.mock('@/utils/boq', () => ({
  getFilledBoqItems: getFilledBoqItemsMock,
  parseImportedBoqRows: parseImportedBoqRowsMock,
  validateBoqItems: validateBoqItemsMock,
}))

import {
  createProjectDetailContract,
  deleteProjectDetailContract,
  downloadProjectDetailBoqTemplate,
  exportProjectDetailBoq,
  getProjectDetailListRoute,
  getProjectDetailSettlementRoute,
  importProjectDetailBoq,
  loadProjectDetailAttachmentCount,
  loadProjectDetailPage,
  saveProjectDetailBasics,
  saveProjectDetailContract,
} from './project-detail.controller'

beforeEach(() => {
  vi.clearAllMocks()
  getFilledBoqItemsMock.mockImplementation(items => items)
  validateBoqItemsMock.mockReturnValue('')
})

describe('project-detail.controller', () => {
  it('loads project snapshot and attachment count through delegated services', async () => {
    const snapshot = { project: { id: 1 }, contracts: [], settlements: [], contractEntries: [] }
    loadProjectDetailSnapshotMock.mockResolvedValue(snapshot)
    contractAttachmentManagerServiceMock.getList.mockResolvedValue([{ id: 1 }, { id: 2 }])

    await expect(loadProjectDetailPage(1)).resolves.toBe(snapshot)
    await expect(loadProjectDetailAttachmentCount(11)).resolves.toBe(2)
  })

  it('returns warning before saving contract when boq rows fail validation', async () => {
    validateBoqItemsMock.mockReturnValue('清单数据不完整')

    await expect(saveProjectDetailContract(1, 11, {
      contractNo: 'HT-001',
      contractName: '测试合同',
      contractDate: '2026-04-10',
      summary: '',
    }, [{ itemName: '测试项' }])).resolves.toEqual({
      type: 'warning',
      message: '清单数据不完整',
    })

    expect(updateProjectContractWithBoqMock).not.toHaveBeenCalled()
  })

  it('saves and creates project contracts with normalized boq rows', async () => {
    const mutationResult = { contract: { id: 11 }, boqItems: [{ id: 21 }], settlements: [] }
    updateProjectContractWithBoqMock.mockResolvedValue(mutationResult)
    createProjectContractWithBoqMock.mockResolvedValue(mutationResult)

    await expect(saveProjectDetailContract(1, 11, {
      contractNo: 'HT-001',
      contractName: '测试合同',
      contractDate: '2026-04-10',
      summary: '备注',
    }, [{ itemName: '测试项' }])).resolves.toEqual({
      type: 'success',
      data: mutationResult,
      successMessage: '合同已保存',
    })

    await expect(createProjectDetailContract(1, {
      contractNo: 'HT-002',
      contractName: '新合同',
      contractDate: '2026-04-11',
      summary: '',
    }, [{ itemName: '新清单' }])).resolves.toEqual({
      type: 'success',
      data: mutationResult,
      successMessage: '合同已创建',
    })

    expect(updateProjectContractWithBoqMock).toHaveBeenCalledWith(11, expect.objectContaining({
      projectId: 1,
      contractNo: 'HT-001',
      boqItems: [{ itemName: '测试项' }],
    }))
    expect(createProjectContractWithBoqMock).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 1,
      contractNo: 'HT-002',
      boqItems: [{ itemName: '新清单' }],
    }))
  })

  it('deletes project contract and saves project basics with unified success payload', async () => {
    const settlements = [{ id: 1 }]
    const project = { id: 1, name: '测试项目' }
    deleteProjectContractAndReloadSettlementsMock.mockResolvedValue(settlements)
    updateProjectBasicsMock.mockResolvedValue(project)

    await expect(deleteProjectDetailContract(1, 11)).resolves.toEqual({
      type: 'success',
      data: settlements,
      successMessage: '合同已删除',
    })
    await expect(saveProjectDetailBasics(1, {
      code: 'XM-001',
      name: '测试项目',
      location: '测试地点',
      ownerUnit: '业主单位',
      generalContractor: '总包单位',
      status: 'settling',
      plannedEndDate: '2026-12-31',
    })).resolves.toEqual({
      type: 'success',
      data: project,
      successMessage: '项目已更新',
    })
  })

  it('imports boq rows with warning on empty excel and success payload on valid rows', async () => {
    importProjectBoqCsvRowsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ itemName: '行1' }])
    parseImportedBoqRowsMock.mockReturnValue([{ itemName: '导入项' }])

    await expect(importProjectDetailBoq({} as File, 11, 2)).resolves.toEqual({
      type: 'warning',
      message: 'CSV 中没有数据',
    })
    await expect(importProjectDetailBoq({} as File, 11, 2)).resolves.toEqual({
      type: 'success',
      data: [{ itemName: '导入项' }],
      successMessage: '成功导入 1 项',
    })

    expect(parseImportedBoqRowsMock).toHaveBeenCalledWith([{ itemName: '行1' }], {
      contractId: 11,
      sortStart: 2,
    })
  })

  it('exports boq with warning on empty rows and delegates template download', async () => {
    const project = { code: 'XM-001', name: '测试项目' }
    const contract = { contractNo: 'HT-001', contractName: '测试合同' }
    const saveResult = { canceled: false, fileName: '清单.csv', method: 'browser-download' }

    await expect(exportProjectDetailBoq(project as never, contract as never, [])).resolves.toEqual({
      type: 'warning',
      message: '无清单数据',
    })

    exportProjectBoqSpreadsheetMock.mockResolvedValue(saveResult)
    await expect(exportProjectDetailBoq(project as never, contract as never, [{ itemName: '导出项' }] as never)).resolves.toEqual({
      type: 'success',
      data: saveResult,
      successMessage: '已开始下载：清单.csv',
    })

    downloadProjectBoqImportTemplateMock.mockResolvedValue(saveResult)
    await expect(downloadProjectDetailBoqTemplate()).resolves.toEqual({
      type: 'success',
      data: saveResult,
      successMessage: '已开始下载：清单.csv',
    })

    expect(exportProjectBoqSpreadsheetMock).toHaveBeenCalledWith({
      projectCode: 'XM-001',
      projectName: '测试项目',
      contractNo: 'HT-001',
      contractName: '测试合同',
      items: [{ itemName: '导出项' }],
    })
    expect(downloadProjectBoqImportTemplateMock).toHaveBeenCalledTimes(1)
  })

  it('treats canceled boq template download and export as warnings', async () => {
    const project = { code: 'XM-001', name: '测试项目' }
    const contract = { contractNo: 'HT-001', contractName: '测试合同' }
    const canceledResult = { canceled: true, fileName: '清单.csv', method: 'file-system-access' }

    exportProjectBoqSpreadsheetMock.mockResolvedValue(canceledResult)
    downloadProjectBoqImportTemplateMock.mockResolvedValue(canceledResult)

    await expect(exportProjectDetailBoq(project as never, contract as never, [{ itemName: '导出项' }] as never)).resolves.toEqual({
      type: 'warning',
      message: '已取消导出',
    })
    await expect(downloadProjectDetailBoqTemplate()).resolves.toEqual({
      type: 'warning',
      message: '已取消下载模板',
    })
  })

  it('builds project detail related routes', () => {
    expect(getProjectDetailSettlementRoute(8)).toBe('/settlements/8')
    expect(getProjectDetailListRoute()).toBe('/projects')
  })
})
