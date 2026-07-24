import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Contract, Project } from '@/types'

vi.mock('@/services/db-core', () => ({
  getDb: vi.fn(),
  getGlobalDb: vi.fn(),
  saveToStorage: vi.fn(),
  saveGlobalToStorage: vi.fn(),
  withTransaction: vi.fn(),
  withGlobalTransaction: vi.fn(),
}))

vi.mock('@/services/system-settings.service', () => ({
  systemSettingsService: {
    getProjectScaleThresholds: vi.fn().mockResolvedValue({ small: 5000000, large: 20000000 }),
    setProjectScaleThresholds: vi.fn().mockResolvedValue(undefined),
  }
}))

const shared = vi.hoisted(() => ({
  route: {
    params: { id: '1' },
    query: {},
    fullPath: '/projects/1',
  },
  router: {
    push: vi.fn(),
    replace: vi.fn(),
  },
  message: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
  mocks: {
    loadProjectDetailPage: vi.fn(),
    deleteProjectDetailContract: vi.fn(),
    createProjectDetailContract: vi.fn(),
    saveProjectDetailContract: vi.fn(),
    saveProjectDetailBasics: vi.fn(),
    loadProjectDetailAttachmentCount: vi.fn(),
    importProjectDetailBoq: vi.fn(),
    downloadProjectDetailBoqTemplate: vi.fn(),
    exportProjectDetailBoq: vi.fn(),
    undoSettlementDetailConfirm: vi.fn(),
    saveSettlementDetail: vi.fn(),
    exportSettlementDetail: vi.fn(),
    loadSettlementDetailPage: vi.fn(),
    settlementDetailAttachmentAdapter: {},
    projectDetailAttachmentAdapter: {},
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => shared.route,
  useRouter: () => shared.router,
}))

vi.mock('element-plus', () => ({
  ElMessage: shared.message,
}))

vi.mock('./project-detail.controller', () => ({
  loadProjectDetailPage: shared.mocks.loadProjectDetailPage,
  loadProjectDetailAttachmentCount: shared.mocks.loadProjectDetailAttachmentCount,
  saveProjectDetailContract: shared.mocks.saveProjectDetailContract,
  createProjectDetailContract: shared.mocks.createProjectDetailContract,
  deleteProjectDetailContract: shared.mocks.deleteProjectDetailContract,
  importProjectDetailBoq: shared.mocks.importProjectDetailBoq,
  downloadProjectDetailBoqTemplate: shared.mocks.downloadProjectDetailBoqTemplate,
  exportProjectDetailBoq: shared.mocks.exportProjectDetailBoq,
  saveProjectDetailBasics: shared.mocks.saveProjectDetailBasics,
  projectDetailAttachmentAdapter: shared.mocks.projectDetailAttachmentAdapter,
}))

vi.mock('./settlement-detail.controller', () => ({
  loadSettlementDetailPage: shared.mocks.loadSettlementDetailPage,
  saveSettlementDetail: shared.mocks.saveSettlementDetail,
  exportSettlementDetail: shared.mocks.exportSettlementDetail,
  undoSettlementDetailConfirm: shared.mocks.undoSettlementDetailConfirm,
  settlementDetailAttachmentAdapter: shared.mocks.settlementDetailAttachmentAdapter,
}))

import { useProjectDetail } from './useProjectDetail'

function makeProject(): Project {
  return {
    id: 1,
    code: 'XM-001',
    name: 'Project A',
    projectType: 'highway',
    location: '',
    ownerUnit: '',
    generalContractor: '',
    startDate: '2026-01-01',
    plannedEndDate: '2026-12-31',
    actualEndDate: '',
    status: 'settling',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeContract(id: number, contractNo: string): Contract {
  return {
    id,
    projectId: 1,
    contractNo,
    contractName: 'Contract ' + id,
    contractDate: '2026-01-02',
    noTaxAmount: 0,
    contractTaxRate: 0,
    taxAmount: 0,
    contractAmount: 0,
    amountSource: 'manual',
    summary: '',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useProjectDetail', () => {
  it('refreshes next contract number after saving a contract number change', async () => {
    const contract1 = makeContract(11, 'HT-001-01')
    const contract2 = makeContract(12, 'HT-001-02')
    const updatedContract2 = makeContract(12, 'HT-001-10')


    shared.mocks.loadProjectDetailPage.mockResolvedValue({
      project: makeProject(),
      contracts: [contract1, contract2],
      settlements: [],
      contractEntries: [
        { contract: contract1, items: [], attachmentCount: 0 },
        { contract: contract2, items: [], attachmentCount: 0 },
      ],
      nextContractNo: 'HT-001-03',
    })
    shared.mocks.saveProjectDetailContract.mockResolvedValue({
      type: 'success',
      data: {
        contract: updatedContract2,
        boqItems: [],
        settlements: [],
      },
      successMessage: 'saved',
    })

    const state = useProjectDetail()
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    state.editForms[12].contractNo = 'HT-001-10'
    state.setFormRef(12, {
      validate: vi.fn().mockResolvedValue(true),
      clearValidate: vi.fn(),
    } as never)

    await state.saveContract(contract2)
    expect(shared.mocks.saveProjectDetailContract).toHaveBeenCalledTimes(1)

    expect(state.contracts.value.map(contract => contract.contractNo)).toEqual(['HT-001-01', 'HT-001-10'])
    expect(state.nextContractNo.value).toBe('HT-001-11')
  })

  it('refreshes next contract number after deleting a contract', async () => {
    const contract1 = makeContract(11, 'HT-001-01')
    const contract2 = makeContract(12, 'HT-001-02')

    shared.mocks.loadProjectDetailPage.mockResolvedValue({
      project: makeProject(),
      contracts: [contract1, contract2],
      settlements: [],
      contractEntries: [
        { contract: contract1, items: [], attachmentCount: 0 },
        { contract: contract2, items: [], attachmentCount: 0 },
      ],
      nextContractNo: 'HT-001-03',
    })

    shared.mocks.deleteProjectDetailContract.mockResolvedValue({
      type: 'success',
      data: [],
      successMessage: 'deleted',
    })

    const state = useProjectDetail()
    await nextTick()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(state.nextContractNo.value).toBe('HT-001-03')

    await state.deleteContract(12)

    expect(state.contracts.value.map(contract => contract.contractNo)).toEqual(['HT-001-01'])
    expect(state.nextContractNo.value).toBe('HT-001-02')
  })
})

