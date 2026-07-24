import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue', async importOriginal => {
  const actual = await importOriginal<typeof import('vue')>()
  return {
    ...actual,
    onMounted: (callback: () => unknown) => {
      void callback()
    },
  }
})

const {
  applyBrowserStorageActionMock,
  createDataCenterBackupMock,
  deleteDataCenterBackupMock,
  elMessageErrorMock,
  elMessageSuccessMock,
  elMessageWarningMock,
  elMessageBoxConfirmMock,
  getDbConfigMock,
  getLatestDataCenterVersionInfoMock,
  inspectPickedDatabaseDirectoryMock,
  isBrowserDirectoryPickerSupportedMock,
  isDirectoryPickerAbortErrorMock,
  loadDataCenterPageMock,
  pickBrowserDirectoryMock,
  setDbConfigMock,
  useDefaultMainDatabaseMock,
  useDefaultGlobalDatabaseMock,
  selectMainDatabaseMock,
  selectGlobalDatabaseMock,
  createGlobalNextToMainMock,
  pickAndConnectBrowserMainFileMock,
  pickAndConnectBrowserGlobalFileMock,
  disconnectBrowserMainFileMock,
  disconnectBrowserGlobalFileMock,
  isMainDatabaseConnectedMock,
  isGlobalDatabaseConnectedMock,
} = vi.hoisted(() => ({
  applyBrowserStorageActionMock: vi.fn(),
  createDataCenterBackupMock: vi.fn(),
  deleteDataCenterBackupMock: vi.fn(),
  elMessageErrorMock: vi.fn(),
  elMessageSuccessMock: vi.fn(),
  elMessageWarningMock: vi.fn(),
  elMessageBoxConfirmMock: vi.fn(),
  getDbConfigMock: vi.fn(),
  getLatestDataCenterVersionInfoMock: vi.fn(),
  inspectPickedDatabaseDirectoryMock: vi.fn(),
  isBrowserDirectoryPickerSupportedMock: vi.fn(),
  isDirectoryPickerAbortErrorMock: vi.fn(),
  loadDataCenterPageMock: vi.fn(),
  pickBrowserDirectoryMock: vi.fn(),
  setDbConfigMock: vi.fn(),
  useDefaultMainDatabaseMock: vi.fn(),
  useDefaultGlobalDatabaseMock: vi.fn(),
  selectMainDatabaseMock: vi.fn(),
  selectGlobalDatabaseMock: vi.fn(),
  createGlobalNextToMainMock: vi.fn(),
  pickAndConnectBrowserMainFileMock: vi.fn(),
  pickAndConnectBrowserGlobalFileMock: vi.fn(),
  disconnectBrowserMainFileMock: vi.fn(),
  disconnectBrowserGlobalFileMock: vi.fn(),
  isMainDatabaseConnectedMock: vi.fn(),
  isGlobalDatabaseConnectedMock: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessage: {
    success: elMessageSuccessMock,
    warning: elMessageWarningMock,
    error: elMessageErrorMock,
  },
  ElMessageBox: {
    confirm: elMessageBoxConfirmMock,
  },
}))

vi.mock('./data-center.controller', () => ({
  createDataCenterBackup: createDataCenterBackupMock,
  deleteDataCenterBackup: deleteDataCenterBackupMock,
  getLatestDataCenterVersionInfo: getLatestDataCenterVersionInfoMock,
  loadDataCenterPage: loadDataCenterPageMock,
}))

vi.mock('@/services/db-core', () => ({
  applyBrowserStorageAction: applyBrowserStorageActionMock,
  getDbConfig: getDbConfigMock,
  inspectPickedDatabaseDirectory: inspectPickedDatabaseDirectoryMock,
  setDbConfig: setDbConfigMock,
  useDefaultMainDatabase: useDefaultMainDatabaseMock,
  useDefaultGlobalDatabase: useDefaultGlobalDatabaseMock,
  selectMainDatabase: selectMainDatabaseMock,
  selectGlobalDatabase: selectGlobalDatabaseMock,
  createGlobalNextToMain: createGlobalNextToMainMock,
  pickAndConnectBrowserMainFile: pickAndConnectBrowserMainFileMock,
  pickAndConnectBrowserGlobalFile: pickAndConnectBrowserGlobalFileMock,
  disconnectBrowserMainFile: disconnectBrowserMainFileMock,
  disconnectBrowserGlobalFile: disconnectBrowserGlobalFileMock,
  isDatabaseConnected: () => true,
  isMainDatabaseConnected: isMainDatabaseConnectedMock,
  isGlobalDatabaseConnected: isGlobalDatabaseConnectedMock,
  getDb: vi.fn(),
  getGlobalDb: vi.fn(),
  saveToStorage: vi.fn(),
  saveGlobalToStorage: vi.fn(),
  withTransaction: vi.fn(),
  withGlobalTransaction: vi.fn(),
}))

vi.mock('@/services/browser-directory-access.service', () => ({
  isBrowserDirectoryPickerSupported: isBrowserDirectoryPickerSupportedMock,
  isDirectoryPickerAbortError: isDirectoryPickerAbortErrorMock,
  pickBrowserDirectory: pickBrowserDirectoryMock,
  isBrowserFilePickerSupported: vi.fn(() => true),
  pickBrowserFile: vi.fn(),
}))

import { useDataCenter } from './useDataCenter'
import { formatBackupTime } from './data-center.helpers'

const versionInfo = {
  schemaVersion: '11',
  dataLabel: '实例A',
  activeSourceLabel: '正在使用当前业务数据',
  activeSourceType: 'live' as const,
  activeUpdatedAt: '2026-04-19T14:00:00.000Z',
  projectCount: 3,
  contractCount: 4,
  settlementCount: 5,
  paymentCount: 6,
  backupCount: 1,
}

const pageState = {
  summary: {
    projects: 3,
    contracts: 4,
    boqItems: 7,
    confirmedSettlements: 5,
    payments: 6,
  },
  backupState: {
    backups: [{
      id: 'backup-001',
      name: '业务备份',
      createdAt: '2026-04-19T14:00:00.000Z',
      size: 2048,
      source: 'web',
      databaseRoot: '实例A/backups/backup-001',
      databaseFilePath: '实例A/backups/backup-001/pave.db',
    }],
    versionInfo,
  },
}

const legacyDbConfig = {
  customDatabaseRoot: 'F:/Settlement/实例A',
  currentDatabaseRoot: 'F:/Settlement/实例A',
  mainDatabaseFilePath: 'F:/Settlement/实例A/pave.db',
  globalDatabaseFilePath: 'F:/Settlement/实例A/global-assets.db',
  databaseFilePath: 'F:/Settlement/实例A/pave.db',
  globalDatabaseFilePathLegacy: 'F:/Settlement/实例A/global-assets.db',
  backupsPath: 'F:/Settlement/实例A/backups',
  mainDatabaseFileExists: true,
  globalDatabaseFileExists: true,
  databaseFileExists: true,
  globalDatabaseFileExistsLegacy: true,
  backupsDirExists: true,
  storageKind: 'dev-api' as const,
  storageLabel: null,
  databaseFileName: 'pave.db',
  databaseFileSize: 1024,
  databaseUpdatedAt: '2026-04-19T14:00:00.000Z',
  globalDatabaseFileSize: 2048,
  globalDatabaseUpdatedAt: '2026-04-19T14:00:00.000Z',
  lastSelectedAt: '2026-04-19T14:00:00.000Z',
}

const browserDbConfig = {
  customDatabaseRoot: '实例A',
  currentDatabaseRoot: '实例A',
  mainDatabaseFilePath: '实例A/pave.db',
  globalDatabaseFilePath: '实例A/global-assets.db',
  databaseFilePath: '实例A/pave.db',
  backupsPath: '实例A/backups',
  mainDatabaseFileExists: true,
  globalDatabaseFileExists: true,
  databaseFileExists: true,
  backupsDirExists: true,
  storageKind: 'browser-file' as const,
  storageLabel: '实例A',
  databaseFileName: 'pave.db',
  databaseFileSize: 2048,
  databaseUpdatedAt: '2026-04-19T14:00:00.000Z',
  globalDatabaseFileSize: 4096,
  globalDatabaseUpdatedAt: '2026-04-19T14:00:00.000Z',
  lastSelectedAt: '2026-04-19T14:00:00.000Z',
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('useDataCenter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    isMainDatabaseConnectedMock.mockReturnValue(true)
    isGlobalDatabaseConnectedMock.mockReturnValue(true)

    getLatestDataCenterVersionInfoMock.mockReturnValue(versionInfo)
    loadDataCenterPageMock.mockResolvedValue(pageState)
    getDbConfigMock.mockResolvedValue(legacyDbConfig)
    setDbConfigMock.mockResolvedValue(true)
    useDefaultMainDatabaseMock.mockResolvedValue(true)
    useDefaultGlobalDatabaseMock.mockResolvedValue(true)
    selectMainDatabaseMock.mockResolvedValue(true)
    selectGlobalDatabaseMock.mockResolvedValue(true)
    createGlobalNextToMainMock.mockResolvedValue(true)

    elMessageBoxConfirmMock.mockResolvedValue(undefined)
    isBrowserDirectoryPickerSupportedMock.mockReturnValue(false)
    isDirectoryPickerAbortErrorMock.mockReturnValue(false)
    pickBrowserDirectoryMock.mockResolvedValue({
      handle: { kind: 'directory' },
      label: '浏览器文件夹A',
    })
    inspectPickedDatabaseDirectoryMock.mockResolvedValue({
      label: '浏览器文件夹A',
      hasDatabase: true,
      databaseFileName: 'pave.db',
      databaseFileSize: 2048,
      databaseUpdatedAt: '2026-04-19T14:00:00.000Z',
      backupCount: 1,
    })
    applyBrowserStorageActionMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hydrates dev-api database state and structure items on mount', async () => {
    const model = useDataCenter()
    await flushPromises()

    expect(loadDataCenterPageMock).toHaveBeenCalledTimes(1)
    expect(getDbConfigMock).toHaveBeenCalledTimes(1)
    expect(model.summary.value).toEqual(pageState.summary)
    expect(model.backupList.value).toEqual(pageState.backupState.backups)
    expect(model.mainDatabaseLocationInput.value).toBe('F:/Settlement/实例A/pave.db')
    expect(model.globalDatabaseLocationInput.value).toBe('F:/Settlement/实例A/global-assets.db')
    expect(model.usingBrowserDirectory.value).toBe(false)
    expect(model.currentLocationValue.value).toBe('F:/Settlement/实例A/pave.db')
    expect(model.structureItems.value).toEqual([
      {
        key: 'database',
        label: '项目事务主库',
        path: 'F:/Settlement/实例A/pave.db',
        ok: true,
        hint: '存储项目、结算、合同、收付款等核心业务数据',
        size: '1.0 KB',
        updatedAt: formatBackupTime(legacyDbConfig.databaseUpdatedAt),
      },
      {
        key: 'globalDatabase',
        label: '企业全局资产库',
        path: 'F:/Settlement/实例A/global-assets.db',
        ok: true,
        hint: '存储价格库、定额模板、参数校验范围和全局系统设置等资产数据',
        size: '2.0 KB',
        updatedAt: formatBackupTime(legacyDbConfig.globalDatabaseUpdatedAt),
      },
    ])
  })

  it('hydrates browser-file state', async () => {
    getDbConfigMock.mockResolvedValue(browserDbConfig)

    const model = useDataCenter()
    await flushPromises()

    expect(model.usingBrowserDirectory.value).toBe(true)
    expect(model.currentLocationValue.value).toBe('实例A/pave.db')
    expect(model.storageModeLabel.value).toBe('浏览器文件')
    expect(model.storageModeTagType.value).toBe('success')
  })

  it('saves custom main database path', async () => {
    const model = useDataCenter()
    await flushPromises()
    model.mainDatabaseLocationInput.value = 'D:/Custom/pave.db'

    await model.handleSaveMainPath()

    expect(selectMainDatabaseMock).toHaveBeenCalledWith('D:/Custom/pave.db')
  })

  it('saves custom global database path', async () => {
    const model = useDataCenter()
    await flushPromises()
    model.globalDatabaseLocationInput.value = 'D:/Custom/global-assets.db'

    await model.handleSaveGlobalPath()

    expect(selectGlobalDatabaseMock).toHaveBeenCalledWith('D:/Custom/global-assets.db')
  })

  it('sets default main database path', async () => {
    const model = useDataCenter()
    await flushPromises()

    await model.handleUseDefaultMain()

    expect(useDefaultMainDatabaseMock).toHaveBeenCalled()
  })

  it('sets default global database path', async () => {
    const model = useDataCenter()
    await flushPromises()

    await model.handleUseDefaultGlobal()

    expect(useDefaultGlobalDatabaseMock).toHaveBeenCalled()
  })

  it('creates global assets database next to main', async () => {
    const model = useDataCenter()
    await flushPromises()

    await model.handleCreateGlobalNextToMain()

    expect(createGlobalNextToMainMock).toHaveBeenCalled()
  })
})
