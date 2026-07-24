import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentDatabaseVersionInfo } from './db-core'

const {
  createDatabaseBackupMock,
  deleteDatabaseBackupMock,
  getCurrentDatabaseVersionInfoMock,
  listDatabaseBackupsMock,
} = vi.hoisted(() => ({
  createDatabaseBackupMock: vi.fn(),
  deleteDatabaseBackupMock: vi.fn(),
  getCurrentDatabaseVersionInfoMock: vi.fn(),
  listDatabaseBackupsMock: vi.fn(),
}))

vi.mock('./db-core', () => ({
  deleteDatabaseBackup: deleteDatabaseBackupMock,
  getCurrentDatabaseVersionInfo: getCurrentDatabaseVersionInfoMock,
  listDatabaseBackups: listDatabaseBackupsMock,
  createDatabaseBackup: createDatabaseBackupMock,
  getDb: vi.fn(),
  getGlobalDb: vi.fn(),
  saveToStorage: vi.fn(),
  saveGlobalToStorage: vi.fn(),
  withTransaction: vi.fn(),
  withGlobalTransaction: vi.fn(),
}))

import {
  createManualDatabaseBackupAndReloadState,
  deleteDatabaseBackupAndReloadState,
  getCurrentDataCenterVersionInfo,
  loadDatabaseBackupState,
} from './data-center.service'

function makeVersionInfo(overrides: Partial<CurrentDatabaseVersionInfo> = {}): CurrentDatabaseVersionInfo {
  return {
    schemaVersion: '11',
    dataLabel: '自定义业务数据',
    activeSourceLabel: '正在使用当前业务数据',
    activeSourceType: 'live',
    activeUpdatedAt: '2026-04-09T00:00:00.000Z',
    projectCount: 1,
    contractCount: 1,
    settlementCount: 1,
    paymentCount: 1,
    backupCount: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentDatabaseVersionInfoMock.mockImplementation((backupCount = 0) => makeVersionInfo({ backupCount }))
})

describe('data-center.service', () => {
  it('loads backup state with refreshed version info', async () => {
    const backups = [{
      id: 'backup-001',
      name: '测试备份',
      createdAt: '2026-04-09T09:30:00.000Z',
      size: 128,
    }]
    listDatabaseBackupsMock.mockResolvedValue(backups)

    await expect(loadDatabaseBackupState()).resolves.toEqual({
      backups,
      versionInfo: makeVersionInfo({ backupCount: 1 }),
    })

    expect(listDatabaseBackupsMock).toHaveBeenCalledTimes(1)
    expect(getCurrentDatabaseVersionInfoMock).toHaveBeenCalledWith(1)
  })

  it('creates and deletes backups through backup state helpers', async () => {
    const backups = [{
      id: 'backup-002',
      name: '月结前备份',
      createdAt: '2026-04-09T10:00:00.000Z',
      size: 256,
    }]
    listDatabaseBackupsMock.mockResolvedValue(backups)

    await expect(createManualDatabaseBackupAndReloadState('月结前备份', '默认备份名')).resolves.toEqual({
      backups,
      versionInfo: makeVersionInfo({ backupCount: 1 }),
    })
    await expect(deleteDatabaseBackupAndReloadState('backup-002')).resolves.toEqual({
      backups,
      versionInfo: makeVersionInfo({ backupCount: 1 }),
    })

    expect(createDatabaseBackupMock).toHaveBeenCalledWith('月结前备份')
    expect(deleteDatabaseBackupMock).toHaveBeenCalledWith('backup-002')
  })

  it('passes through latest version info', () => {
    const versionInfo = makeVersionInfo({ backupCount: 3 })
    getCurrentDatabaseVersionInfoMock.mockReturnValue(versionInfo)
    expect(getCurrentDataCenterVersionInfo(3)).toBe(versionInfo)
  })
})
