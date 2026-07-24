import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  createManualDatabaseBackupAndReloadStateMock,
  deleteDatabaseBackupAndReloadStateMock,
  getCurrentDataCenterVersionInfoMock,
  getDataSummaryMock,
  loadDatabaseBackupStateMock,
} = vi.hoisted(() => ({
  createManualDatabaseBackupAndReloadStateMock: vi.fn(),
  deleteDatabaseBackupAndReloadStateMock: vi.fn(),
  getCurrentDataCenterVersionInfoMock: vi.fn(),
  getDataSummaryMock: vi.fn(),
  loadDatabaseBackupStateMock: vi.fn(),
}))

vi.mock('@/services/data-center.service', () => ({
  createManualDatabaseBackupAndReloadState: createManualDatabaseBackupAndReloadStateMock,
  deleteDatabaseBackupAndReloadState: deleteDatabaseBackupAndReloadStateMock,
  getCurrentDataCenterVersionInfo: getCurrentDataCenterVersionInfoMock,
  loadDatabaseBackupState: loadDatabaseBackupStateMock,
}))

vi.mock('@/services/integrity.service', () => ({
  getDataSummary: getDataSummaryMock,
}))

import {
  createDataCenterBackup,
  deleteDataCenterBackup,
  getLatestDataCenterVersionInfo,
  loadDataCenterBackups,
  loadDataCenterPage,
  loadDataCenterSummary,
} from './data-center.controller'

const summary = {
  projects: 1,
  contracts: 2,
  boqItems: 3,
  confirmedSettlements: 4,
  payments: 5,
}

const versionInfo = {
  schemaVersion: '11',
  dataLabel: '测试数据',
  activeSourceLabel: '正在使用当前业务数据',
  activeSourceType: 'live' as const,
  activeUpdatedAt: '2026-04-10T00:00:00.000Z',
  projectCount: 1,
  contractCount: 2,
  settlementCount: 3,
  paymentCount: 4,
  backupCount: 1,
}

const backupState = {
  backups: [{
    id: 'backup-001',
    name: '测试备份',
    createdAt: '2026-04-10T00:00:00.000Z',
    size: 128,
  }],
  versionInfo,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('data-center.controller', () => {
  it('loads page summary and backup state together', async () => {
    getDataSummaryMock.mockResolvedValue(summary)
    loadDatabaseBackupStateMock.mockResolvedValue(backupState)

    await expect(loadDataCenterPage()).resolves.toEqual({
      summary,
      backupState,
    })
    await expect(loadDataCenterSummary()).resolves.toEqual(summary)
    await expect(loadDataCenterBackups()).resolves.toEqual(backupState)
  })

  it('proxies latest version info', () => {
    getCurrentDataCenterVersionInfoMock.mockReturnValue(versionInfo)

    expect(getLatestDataCenterVersionInfo(2)).toBe(versionInfo)
    expect(getCurrentDataCenterVersionInfoMock).toHaveBeenCalledWith(2)
  })

  it('creates and deletes database backups through unified controller results', async () => {
    createManualDatabaseBackupAndReloadStateMock.mockResolvedValue(backupState)
    deleteDatabaseBackupAndReloadStateMock.mockResolvedValue(backupState)

    await expect(createDataCenterBackup('手动备份', '回退名称')).resolves.toEqual({
      backupState,
      nextBackupDraftName: '回退名称',
      successMessage: '数据库备份已保存',
    })
    await expect(deleteDataCenterBackup(backupState.backups[0])).resolves.toEqual({
      backupState,
      successMessage: '数据库备份已删除',
    })
  })
})
