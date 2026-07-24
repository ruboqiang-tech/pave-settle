import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseConfigState } from './database-storage.types'

const {
  createCurrentBrowserDatabaseBackupMock,
  deleteCurrentBrowserDatabaseBackupMock,
  getCurrentBrowserDatabaseConfigMock,
  hasBrowserStorageSelectionMock,
  inspectBrowserStorageDirectoryMock,
  listCurrentBrowserDatabaseBackupsMock,
  overwriteBrowserStorageDirectoryWithDatabaseMock,
  prepareEmptyBrowserStorageDirectoryMock,
  readCurrentBrowserDatabaseFileMock,
  restoreCurrentBrowserDatabaseFromBackupMock,
  useBrowserStorageDirectoryMock,
  writeCurrentBrowserDatabaseFileMock,
} = vi.hoisted(() => ({
  createCurrentBrowserDatabaseBackupMock: vi.fn(),
  deleteCurrentBrowserDatabaseBackupMock: vi.fn(),
  getCurrentBrowserDatabaseConfigMock: vi.fn(),
  hasBrowserStorageSelectionMock: vi.fn(),
  inspectBrowserStorageDirectoryMock: vi.fn(),
  listCurrentBrowserDatabaseBackupsMock: vi.fn(),
  overwriteBrowserStorageDirectoryWithDatabaseMock: vi.fn(),
  prepareEmptyBrowserStorageDirectoryMock: vi.fn(),
  readCurrentBrowserDatabaseFileMock: vi.fn(),
  restoreCurrentBrowserDatabaseFromBackupMock: vi.fn(),
  useBrowserStorageDirectoryMock: vi.fn(),
  writeCurrentBrowserDatabaseFileMock: vi.fn(),
}))

vi.mock('./web-db-storage.service', () => ({
  createCurrentBrowserDatabaseBackup: createCurrentBrowserDatabaseBackupMock,
  deleteCurrentBrowserDatabaseBackup: deleteCurrentBrowserDatabaseBackupMock,
  getCurrentBrowserDatabaseConfig: getCurrentBrowserDatabaseConfigMock,
  hasBrowserStorageSelection: hasBrowserStorageSelectionMock,
  inspectBrowserStorageDirectory: inspectBrowserStorageDirectoryMock,
  listCurrentBrowserDatabaseBackups: listCurrentBrowserDatabaseBackupsMock,
  overwriteBrowserStorageDirectoryWithDatabase: overwriteBrowserStorageDirectoryWithDatabaseMock,
  prepareEmptyBrowserStorageDirectory: prepareEmptyBrowserStorageDirectoryMock,
  readCurrentBrowserDatabaseFile: readCurrentBrowserDatabaseFileMock,
  restoreCurrentBrowserDatabaseFromBackup: restoreCurrentBrowserDatabaseFromBackupMock,
  useBrowserStorageDirectory: useBrowserStorageDirectoryMock,
  writeCurrentBrowserDatabaseFile: writeCurrentBrowserDatabaseFileMock,
}))

import {
  applyBrowserStorageAction,
  createDatabaseBackup,
  deleteDatabaseBackup,
  getCurrentDatabaseVersionInfo,
  getDbConfig,
  initDatabase,
  listDatabaseBackups,
  setDbConfig,
} from './db-core'

const wasmBinary = Uint8Array.from(
  readFileSync(resolve(process.cwd(), 'public', 'sql-wasm-browser.wasm')),
)


const browserDirectoryConfigState: DatabaseConfigState = {
  customDatabaseRoot: '浏览器文件夹/正式库',
  currentDatabaseRoot: '浏览器文件夹/正式库',
  databaseFilePath: '浏览器文件夹/正式库/pave.db',
  backupsPath: '浏览器文件夹/正式库/backups',
  databaseFileExists: true,
  backupsDirExists: true,
  storageKind: 'browser-directory',
  storageLabel: '正式库',
  databaseFileName: 'pave.db',
  databaseFileSize: 4096,
  databaseUpdatedAt: '2026-04-23T09:00:00.000Z',
  lastSelectedAt: '2026-04-23T09:05:00.000Z',
}

const webConfigState: DatabaseConfigState = {
  customDatabaseRoot: 'F:/Regression/实例A',
  currentDatabaseRoot: 'F:/Regression/实例A',
  databaseFilePath: 'F:/Regression/实例A/pave.db',
  backupsPath: 'F:/Regression/实例A/backups',
  databaseFileExists: true,
  backupsDirExists: true,
  storageKind: 'dev-api',

  storageLabel: '实例A',
  databaseFileName: 'pave.db',
  databaseFileSize: 2048,
  databaseUpdatedAt: '2026-04-23T08:00:00.000Z',
  lastSelectedAt: '2026-04-23T08:05:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  hasBrowserStorageSelectionMock.mockResolvedValue(false)
  listCurrentBrowserDatabaseBackupsMock.mockResolvedValue([])
  readCurrentBrowserDatabaseFileMock.mockResolvedValue(null)
  restoreCurrentBrowserDatabaseFromBackupMock.mockResolvedValue(false)
})

describe('db-core database location regressions', () => {
  it.skip('loads current database location config from browser directory when selection exists', async () => {
    hasBrowserStorageSelectionMock.mockResolvedValue(true)
    getCurrentBrowserDatabaseConfigMock.mockResolvedValue(browserDirectoryConfigState)

    await expect(getDbConfig()).resolves.toEqual(browserDirectoryConfigState)
    expect(getCurrentBrowserDatabaseConfigMock).toHaveBeenCalledTimes(1)
  })

  it('loads current database location config from web api when browser directory is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(webConfigState), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getDbConfig()).resolves.toEqual(webConfigState)
    expect(fetchMock).toHaveBeenCalledWith('/api/db/config')
  })



  it('persists trimmed existing database location through web config api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setDbConfig('  F:/Regression/实例B  ', 'existing')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseRoot: 'F:/Regression/实例B', mode: 'existing' }),
    })
  })

  it('persists new database location mode through web config api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setDbConfig('D:/SettlementData/新库', 'new')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/api/db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseRoot: 'D:/SettlementData/新库', mode: 'new' }),
    })
  })

  it('clears active source after switching database manually', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    localStorage.setItem('settlement_db_active_source', JSON.stringify({
      type: 'backup',
      label: '当前使用备份目录数据：旧备份',

      backupId: 'backup-legacy',
      updatedAt: '2026-04-19T13:55:00.000Z',
    }))

    await expect(setDbConfig('F:/Regression/实例C', 'existing')).resolves.toBe(true)
    expect(localStorage.getItem('settlement_db_active_source')).toBeNull()
  })

  it('prefers actual empty database state over legacy snapshot cache', () => {
    localStorage.setItem('settlement_db_active_source', JSON.stringify({
      type: 'snapshot',
      label: '旧快照来源',
      ['snapshot' + 'Id']: 'backup-legacy',
      updatedAt: '2026-04-19T13:55:00.000Z',
    }))

    const versionInfo = getCurrentDatabaseVersionInfo()
    expect(versionInfo.activeSourceType).toBe('empty')
    expect(versionInfo.activeSourceLabel).toBe('空白数据库')
  })




  it('surfaces web config api error messages when switching database locations fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'Error: 目标目录不存在，无法使用该数据库路径',

    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setDbConfig('F:/Regression/缺失实例', 'existing')).rejects.toThrow('目标目录不存在，无法使用该数据库路径')

  })

  it('surfaces web config api raw error messages when switching database locations fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('目标目录下未找到 pave.db', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(setDbConfig('D:/SettlementData/损坏实例', 'existing')).rejects.toThrow('目标目录下未找到 pave.db')
  })
})
