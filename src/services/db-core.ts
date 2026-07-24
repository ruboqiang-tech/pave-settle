import initSqlJs, { type Database, type QueryExecResult } from 'sql.js'

import type {
  DatabaseBackupMeta,
  DatabaseConfigMode,
  DatabaseConfigState,
  DatabaseFileSelectionConfig,
  StorageBackend,
} from './database-storage.types'

import {
  getCurrentBrowserDatabaseConfig,
  hasBrowserStorageSelection,
  readCurrentBrowserDatabaseFile,
  readCurrentBrowserGlobalDatabaseFile,
  writeCurrentBrowserDatabaseFile,
  writeCurrentBrowserGlobalDatabaseFile,
  connectMainDatabaseFile,
  connectGlobalDatabaseFile,
  clearMainDatabaseFile,
  clearGlobalDatabaseFile,
  verifyHandlePermission,
} from './web-db-storage.service'

import { getErrorMessage } from '@/utils/error'
import { applyDatabaseSchema, CURRENT_DB_VERSION } from './db-schema'
import { clearCurrentStorageDirectorySelection } from './storage-config.service'

// --- Web 开发桥（Vite /api/db 中件间） ---
let _devDbApiAvailable: boolean | null = null

function isTestRuntime(): boolean {
  return (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')
    || (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test')
}

async function isDevDbApiAvailable(): Promise<boolean> {
  if (!isTestRuntime() && _devDbApiAvailable !== null) return _devDbApiAvailable
  try {
    const res = await fetch('/api/db', { method: 'GET' })
    _devDbApiAvailable = res.ok || res.status === 204
  } catch {
    _devDbApiAvailable = false
  }
  return _devDbApiAvailable
}

async function readDatabaseFromDevApi(): Promise<Uint8Array | null | 'error'> {
  try {
    const res = await fetch('/api/db')
    if (res.status === 204) return null
    if (!res.ok) return 'error'
    return new Uint8Array(await res.arrayBuffer())
  } catch (err) {
    console.error('Failed to read database from dev API:', err)
    return 'error'
  }
}

async function writeDatabaseToDevApi(data: Uint8Array): Promise<boolean> {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer]),
    })
    return res.ok
  } catch {
    return false
  }
}

async function readGlobalDatabaseFromDevApi(): Promise<Uint8Array | null | 'error'> {
  try {
    const res = await fetch('/api/db/global')
    if (res.status === 204) return null
    if (!res.ok) return 'error'
    return new Uint8Array(await res.arrayBuffer())
  } catch (err) {
    console.error('Failed to read global database from dev API:', err)
    return 'error'
  }
}

async function writeGlobalDatabaseToDevApi(data: Uint8Array): Promise<boolean> {
  try {
    const res = await fetch('/api/db/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer]),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function getDbConfig(): Promise<DatabaseConfigState> {
  const fallback: DatabaseConfigState = {
    config: null,
    storageKind: 'dev-api',
    mainDatabaseFilePath: null,
    mainDatabaseFileName: 'pave.db',
    mainDatabaseFileExists: false,
    mainDatabaseUpdatedAt: null,
    globalDatabaseFilePath: null,
    globalDatabaseFileName: 'global-assets.db',
    globalDatabaseFileExists: false,
    globalDatabaseUpdatedAt: null,
    canShowPhysicalPath: true,
  }

  try {
    const devApiOk = await isDevDbApiAvailable()
    if (devApiOk) {
      const res = await fetch('/api/db/config')
      if (res.ok) {
        return await res.json() as DatabaseConfigState
      }
    }
  } catch {
    // API not available
  }

  return fallback
}

function normalizeDbConfigErrorMessage(message: string, fallback: string): string {
  const trimmed = message.trim().replace(/^Error:\s*/i, '')
  return trimmed || fallback
}

async function readDbConfigApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const raw = await res.text()
    if (!raw.trim()) return fallback

    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return normalizeDbConfigErrorMessage(parsed.error, fallback)
      }
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return normalizeDbConfigErrorMessage(parsed.message, fallback)
      }
    } catch {
      return normalizeDbConfigErrorMessage(raw, fallback)
    }
  } catch {
    // ignore
  }

  return fallback
}

// Config modification API
export async function setDbConfigAction(action: string, path?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, path }),
    })
    if (!res.ok) {
      throw new Error(await readDbConfigApiErrorMessage(res, '保存配置失败'))
    }
    clearActiveDatabaseSource()
    return true
  } catch (error) {
    throw new Error(normalizeDbConfigErrorMessage(getErrorMessage(error, '保存配置失败'), '保存配置失败'))
  }
}

// Action wrappers
export async function useDefaultMainDatabase(): Promise<boolean> {
  const ok = await setDbConfigAction('use-default-main')
  if (ok) {
    const config = await getDbConfig()
    if (!config.mainDatabaseFileExists) {
      const SQL = await loadSqlRuntime()
      const tempDb = new SQL.Database()
      tempDb.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(tempDb)
      await writeDatabaseToDevApi(tempDb.export())
      tempDb.close()
    }
  }
  return ok
}

export async function useDefaultGlobalDatabase(): Promise<boolean> {
  const ok = await setDbConfigAction('use-default-global')
  if (ok) {
    const config = await getDbConfig()
    if (!config.globalDatabaseFileExists) {
      const SQL = await loadSqlRuntime()
      const tempDb = new SQL.Database()
      tempDb.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(tempDb)
      await writeGlobalDatabaseToDevApi(tempDb.export())
      tempDb.close()
    }
  }
  return ok
}

export async function selectMainDatabase(filePath: string): Promise<boolean> {
  return await setDbConfigAction('select-main', filePath)
}

export async function selectGlobalDatabase(filePath: string): Promise<boolean> {
  return await setDbConfigAction('select-global', filePath)
}

export async function createGlobalNextToMain(): Promise<boolean> {
  const ok = await setDbConfigAction('create-global-next-to-main')
  if (ok) {
    const config = await getDbConfig()
    if (!config.globalDatabaseFileExists) {
      const SQL = await loadSqlRuntime()
      const tempDb = new SQL.Database()
      tempDb.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(tempDb)
      await writeGlobalDatabaseToDevApi(tempDb.export())
      tempDb.close()
    }
  }
  return ok
}

export async function selectMainWithDetectedGlobal(filePath: string): Promise<boolean> {
  return await setDbConfigAction('select-main-with-detected-global', filePath)
}

// Legacy compatibility setDbConfig
export async function setDbConfig(databaseRoot: string, mode: DatabaseConfigMode = 'existing'): Promise<boolean> {
  const normalizedRoot = databaseRoot.trim()
  const fallbackMessage = mode === 'new' ? '新数据库位置保存失败' : '数据库位置切换失败'

  try {
    const res = await fetch('/api/db/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ databaseRoot: normalizedRoot, mode }),
    })
    if (!res.ok) {
      throw new Error(await readDbConfigApiErrorMessage(res, fallbackMessage))
    }
    await clearCurrentStorageDirectorySelection()
    clearActiveDatabaseSource()

    if (mode === 'new') {
      const SQL = await loadSqlRuntime()
      const tempDb = new SQL.Database()
      tempDb.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(tempDb)
      const emptyData = tempDb.export()
      await writeDatabaseToDevApi(emptyData)
      await writeGlobalDatabaseToDevApi(emptyData)
      tempDb.close()
    }

    return true
  } catch (error) {
    throw new Error(normalizeDbConfigErrorMessage(getErrorMessage(error, fallbackMessage), fallbackMessage))
  }
}

type DbRow = Record<string, unknown>

export interface CurrentDatabaseVersionInfo {
  schemaVersion: string
  dataLabel: string
  activeSourceLabel: string
  activeSourceType: 'empty' | 'live' | 'backup' | 'demo'
  activeUpdatedAt: string
  projectCount: number
  contractCount: number
  settlementCount: number
  paymentCount: number
  backupCount: number
}

interface StoredActiveDatabaseSource {
  type?: string
  label?: string
  backupId?: string | null
  snapshotId?: string | null
  updatedAt?: string
}

interface ActiveDatabaseSource {
  type: 'empty' | 'live' | 'backup' | 'demo'
  label: string
  backupId?: string | null
  updatedAt: string
}

interface ReplaceDatabaseContentOptions {
  source?: ActiveDatabaseSource | null
}

let db: Database | null = null
let globalDb: Database | null = null

let _isMainDatabaseConnected = false
let _isGlobalDatabaseConnected = false

export function isDatabaseConnected(): boolean {
  if (import.meta.env.MODE === 'test') {
    return true
  }
  return _isMainDatabaseConnected
}

export function isMainDatabaseConnected(): boolean {
  return isDatabaseConnected()
}

export function isGlobalDatabaseConnected(): boolean {
  if (import.meta.env.MODE === 'test') {
    return true
  }
  return _isGlobalDatabaseConnected
}

const ACTIVE_SOURCE_STORAGE_KEY = 'settlement_db_active_source'

export function getDb(): Database | null {
  return db
}

export function getGlobalDb(): Database | null {
  return globalDb || db
}

export async function withTransaction<T>(operation: (db: Database) => Promise<T> | T): Promise<T> {
  if (!db) throw new Error('Database not initialized')

  db.run('BEGIN TRANSACTION')
  try {
    const result = await operation(db)
    db.run('COMMIT')
    return result
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }
}

export async function withGlobalTransaction<T>(operation: (db: Database) => Promise<T> | T): Promise<T> {
  const gdb = getGlobalDb()
  if (!gdb) throw new Error('Global database not initialized')

  gdb.run('BEGIN TRANSACTION')
  try {
    const result = await operation(gdb)
    gdb.run('COMMIT')
    return result
  } catch (error) {
    gdb.run('ROLLBACK')
    throw error
  }
}

function execScalar(sql: string, params?: unknown[]): number {
  if (!db) return 0
  const result = db.exec(sql, params)
  return Number(result[0]?.values?.[0]?.[0] ?? 0)
}

function execScalarInDb(targetDb: Database | null, sql: string, params?: unknown[]): number {
  if (!targetDb) return 0
  const result = targetDb.exec(sql, params)
  return Number(result[0]?.values?.[0]?.[0] ?? 0)
}

function execToObjectsInDb(targetDb: Database | null, sql: string, params?: unknown[]): Record<string, any>[] {
  if (!targetDb) return []
  const result = targetDb.exec(sql, params)
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map(row => {
    const obj: Record<string, any> = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  })
}

export function getLastInsertId(): number {
  return execScalar('SELECT last_insert_rowid()')
}

async function loadSqlRuntime() {
  if (import.meta.env.MODE === 'test') {
    return initSqlJs()
  }
  const wasmResponse = await fetch('/sql-wasm-browser.wasm')
  if (!wasmResponse.ok) {
    throw new Error(`Failed to fetch WASM: ${wasmResponse.status}`)
  }

  return initSqlJs({
    wasmBinary: await wasmResponse.arrayBuffer()
  })
}

export async function initDatabase(): Promise<boolean> {
  if (db && globalDb) return true

  try {
    const SQL = await loadSqlRuntime()
    const config = await getDbConfig()

    const devApiAvailable = await isDevDbApiAvailable()

    // 1. 初始化项目事务数据库 db
    const devApiDataOrError = devApiAvailable ? await readDatabaseFromDevApi() : null

    if (devApiDataOrError === 'error') {
      throw new Error('从开发桥加载数据库失败，中止初始化以防止数据覆盖。')
    }

    const devApiData = devApiDataOrError as Uint8Array | null

    const isTestMode = import.meta.env.MODE === 'test'

    if (devApiData) {
      db = new SQL.Database(devApiData)
      _isMainDatabaseConnected = true
      db.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(db)
    } else if (isTestMode) {
      db = new SQL.Database()
      _isMainDatabaseConnected = true
      db.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(db)
    } else {
      db = null
      _isMainDatabaseConnected = false
    }

    // 2. 初始化全局资产数据库 globalDb
    const globalDevApiDataOrError = devApiAvailable ? await readGlobalDatabaseFromDevApi() : null

    if (globalDevApiDataOrError === 'error') {
      throw new Error('从开发桥加载全局资产数据库失败，中止初始化以防止数据覆盖。')
    }

    const globalDevApiData = globalDevApiDataOrError as Uint8Array | null

    if (globalDevApiData) {
      globalDb = new SQL.Database(globalDevApiData)
      _isGlobalDatabaseConnected = true
      globalDb.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(globalDb)
    } else if (isTestMode) {
      globalDb = new SQL.Database()
      _isGlobalDatabaseConnected = true
      globalDb.run('PRAGMA foreign_keys = ON;')
      applyDatabaseSchema(globalDb)
    } else {
      globalDb = null
      _isGlobalDatabaseConnected = false
    }

    // 3. 首次启动时：检测并迁移原数据库中的全局资产数据
    if (db && globalDb) {
      const globalAssetCount = execScalarInDb(globalDb, 'SELECT COUNT(*) FROM price_resources')
        + execScalarInDb(globalDb, 'SELECT COUNT(*) FROM quota_items')
      const mainAssetCount = execScalarInDb(db, 'SELECT COUNT(*) FROM price_resources')
        + execScalarInDb(db, 'SELECT COUNT(*) FROM quota_items')

      if (globalAssetCount === 0 && mainAssetCount > 0) {
        console.log('[DualDB Migration] Migrating global asset data from main db to globalDb...')
        const tablesToMigrate = [
          'price_resources',
          'price_quotes',
          'selected_quotes',
          'quota_items',
          'quota_param_rules',
          'system_settings'
        ]

        for (const table of tablesToMigrate) {
          try {
            const rows = execToObjectsInDb(db, `SELECT * FROM ${table}`)
            if (rows.length > 0) {
              const cols = Object.keys(rows[0])
              const colsStr = cols.join(', ')
              const placeholders = cols.map(() => '?').join(', ')

              globalDb.run('BEGIN TRANSACTION')
              for (const row of rows) {
                const vals = cols.map(c => row[c])
                globalDb.run(`INSERT OR REPLACE INTO ${table} (${colsStr}) VALUES (${placeholders})`, vals)
              }
              globalDb.run('COMMIT')

              db.run(`DELETE FROM ${table}`)
            }
          } catch (migrationErr) {
            console.error(`[DualDB Migration] Failed to migrate table ${table}`, migrationErr)
          }
        }

        console.log('[DualDB Migration] Migration completed successfully.')
      }
    }

    return true
  } catch (error) {
    console.error('Failed to initialize database:', error)
    return false
  }
}

export async function saveToStorage(): Promise<void> {
  if (import.meta.env.MODE === 'test') return
  if (!db || !isMainDatabaseConnected()) return

  try {
    const data = db.export()

    const config = await getDbConfig()
    if (config.storageKind === 'browser-file') {
      await writeCurrentBrowserDatabaseFile(data)
      return
    }

    const devApiOk = await isDevDbApiAvailable()
    if (devApiOk) {
      await writeDatabaseToDevApi(data)
      return
    }

    throw new Error('当前环境无文件直存访问权限（浏览器授权失效或 Web API 不可用）')
  } catch (error) {
    console.error('Failed to save database:', error)
    throw error
  }
}

export async function saveGlobalToStorage(): Promise<void> {
  if (import.meta.env.MODE === 'test') return
  if (!globalDb || !isGlobalDatabaseConnected()) return

  try {
    const data = globalDb.export()

    const config = await getDbConfig()
    if (config.storageKind === 'browser-file') {
      await writeCurrentBrowserGlobalDatabaseFile(data)
      return
    }

    const devApiOk = await isDevDbApiAvailable()
    if (devApiOk) {
      await writeGlobalDatabaseToDevApi(data)
      return
    }

    throw new Error('当前环境无全局文件直存访问权限')
  } catch (error) {
    console.error('Failed to save global database:', error)
    throw error
  }
}

function normalizeBackupSourceLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '当前使用备份目录数据'

  const withoutCompatTag = trimmed
    .replace('（历史兼容来源）', '')
    .replace('（兼容导入）', '')

  if (/快照|snapshot/i.test(withoutCompatTag)) {
    return '当前使用备份目录数据'
  }

  return withoutCompatTag
}

function normalizeActiveDatabaseSource(parsed: StoredActiveDatabaseSource): ActiveDatabaseSource | null {
  const normalizedType = parsed.type === 'snapshot' ? 'backup' : parsed.type
  if (normalizedType !== 'empty' && normalizedType !== 'live' && normalizedType !== 'backup' && normalizedType !== 'demo') {
    return null
  }

  const fallbackLabelMap: Record<ActiveDatabaseSource['type'], string> = {
    empty: '空白数据库',
    live: '正在使用当前业务数据',
    backup: '当前使用备份目录数据',
    demo: '演示数据',
  }

  return {
    type: normalizedType,
    label: typeof parsed.label === 'string' && parsed.label.trim()
      ? (normalizedType === 'backup' ? normalizeBackupSourceLabel(parsed.label) : parsed.label)
      : fallbackLabelMap[normalizedType],
    backupId: parsed.backupId ?? parsed.snapshotId ?? null,
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
  }
}

function saveActiveDatabaseSource(source: ActiveDatabaseSource): void {
  localStorage.setItem(ACTIVE_SOURCE_STORAGE_KEY, JSON.stringify({
    ...source,
    backupId: source.backupId ?? null,
  }))
}

function getActiveDatabaseSource(): ActiveDatabaseSource | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SOURCE_STORAGE_KEY)
    if (!raw) return null
    return normalizeActiveDatabaseSource(JSON.parse(raw) as StoredActiveDatabaseSource)
  } catch {
    return null
  }
}

function clearActiveDatabaseSource(): void {
  localStorage.removeItem(ACTIVE_SOURCE_STORAGE_KEY)
}

function exportCurrentDatabase(): Uint8Array | null {
  if (!db) return null
  return db.export()
}

export type BrowserStorageAction = 'use-existing' | 'migrate-current' | 'create-new'

// Deprecated backups operations now return empty/mock objects
export async function listDatabaseBackups(): Promise<DatabaseBackupMeta[]> {
  return []
}

export async function createDatabaseBackup(name: string): Promise<DatabaseBackupMeta> {
  return {
    id: 'dummy',
    name,
    createdAt: new Date().toISOString(),
    size: 0,
    source: 'web',
  }
}

export async function deleteDatabaseBackup(backupId: string): Promise<void> {}

export function getCurrentDatabaseVersionInfo(backupCount = 0): CurrentDatabaseVersionInfo {
  if (!db) {
    return {
      schemaVersion: CURRENT_DB_VERSION,
      dataLabel: '未连接数据库',
      activeSourceLabel: '空白数据库',
      activeSourceType: 'empty',
      activeUpdatedAt: '',
      projectCount: 0,
      contractCount: 0,
      settlementCount: 0,
      paymentCount: 0,
      backupCount: 0,
    }
  }
  const projectCount = execScalar('SELECT count(*) FROM projects')
  const contractCount = execScalar('SELECT count(*) FROM contracts')
  const settlementCount = execScalar('SELECT count(*) FROM settlements')
  const paymentCount = execScalar('SELECT count(*) FROM payments')
  const activeSource = getActiveDatabaseSource()

  let dataLabel = '自定义业务数据'
  if (projectCount === 0) {
    dataLabel = '空库'
  }

  const fallbackSource: ActiveDatabaseSource = projectCount === 0
    ? {
        type: 'empty',
        label: '空白数据库',
        backupId: null,
        updatedAt: '',
      }
    : {
        type: 'live',
        label: '正在使用当前业务数据',
        backupId: null,
        updatedAt: '',
      }

  const isActualStatusEmpty = fallbackSource.type === 'empty'
  const resolvedSource = isActualStatusEmpty ? fallbackSource : (activeSource ?? fallbackSource)

  return {
    schemaVersion: CURRENT_DB_VERSION,
    dataLabel,
    activeSourceLabel: resolvedSource.label,
    activeSourceType: resolvedSource.type,
    activeUpdatedAt: resolvedSource.updatedAt,
    projectCount,
    contractCount,
    settlementCount,
    paymentCount,
    backupCount: 0,
  }
}

async function replaceDatabaseContent(data: Uint8Array, options?: ReplaceDatabaseContentOptions): Promise<boolean> {
  try {
    const SQL = await loadSqlRuntime()
    db?.close()
    db = new SQL.Database(data)
    db.run('PRAGMA foreign_keys = ON;')
    applyDatabaseSchema(db)
    const projectCount = execScalar('SELECT count(*) FROM projects')
    if (projectCount === 0 || !options?.source) {
      clearActiveDatabaseSource()
    } else {
      saveActiveDatabaseSource({
        ...options.source,
        updatedAt: options.source.updatedAt || new Date().toISOString(),
      })
    }
    await saveToStorage()
    return true
  } catch (error) {
    console.error('Failed to replace database content:', error)
    return false
  }
}

export function execToObjects(result: QueryExecResult[]): DbRow[] {
  if (result.length === 0) return []
  const { columns, values } = result[0]
  return values.map(row => {
    const mapped: DbRow = {}
    columns.forEach((column, index) => {
      mapped[column] = row[index]
    })
    return mapped
  })
}

export function getRowNumber(row: Record<string, unknown>, key: string, fallback = 0): number {
  const value = row[key]
  return value === undefined || value === null || value === '' ? fallback : Number(value)
}

export function getRowString(row: Record<string, unknown>, key: string, fallback = ''): string {
  const value = row[key]
  return value === undefined || value === null ? fallback : String(value)
}

// Browser mode action delegates
export async function pickAndConnectBrowserMainFile(handle: unknown, name: string): Promise<void> {
  await connectMainDatabaseFile(handle, name)
}

export async function pickAndConnectBrowserGlobalFile(handle: unknown, name: string): Promise<void> {
  await connectGlobalDatabaseFile(handle, name)
}

export async function disconnectBrowserMainFile(): Promise<void> {
  await clearMainDatabaseFile()
}

export async function disconnectBrowserGlobalFile(): Promise<void> {
  await clearGlobalDatabaseFile()
}

export async function reauthorizeBrowserFile(handle: unknown): Promise<boolean> {
  return await verifyHandlePermission(handle, true)
}

export async function triggerNativeFileDialog(type: 'main' | 'global'): Promise<string | null> {
  try {
    const res = await fetch(`/api/db/open-dialog?type=${type}`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json() as { path: string | null }
      return data.path
    }
  } catch (err) {
    console.error('Failed to trigger native file dialog:', err)
  }
  return null
}
