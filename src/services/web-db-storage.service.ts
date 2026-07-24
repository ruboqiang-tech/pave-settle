import type { DatabaseConfigState, DatabaseFileSelectionConfig } from './database-storage.types'

import {
  getCurrentStorageFileMeta,
  loadCurrentMainDbFileHandle,
  loadCurrentGlobalDbFileHandle,
  saveCurrentMainDbFileHandle,
  saveCurrentGlobalDbFileHandle,
  clearCurrentMainDbFileHandle,
  clearCurrentGlobalDbFileHandle,
  type StorageFileMeta
} from './storage-config.service'

import {
  readFileBytes,
  writeFileBytes,
  type FileHandleLike
} from './web-file-system.service'

export interface BrowserStorageInspectionResult {
  label: string
  hasDatabase: boolean
  databaseFileName: string
  databaseFileSize: number | null
  databaseUpdatedAt: string | null
  backupCount: number
  hasGlobalDatabase?: boolean
  globalDatabaseFileSize?: number | null
  globalDatabaseUpdatedAt?: string | null
}

function createEmptyBrowserConfig(): DatabaseConfigState {
  return {
    config: null,
    storageKind: 'browser-file',
    mainDatabaseFilePath: null,
    mainDatabaseFileName: null,
    mainDatabaseFileExists: false,
    mainDatabaseUpdatedAt: null,
    globalDatabaseFilePath: null,
    globalDatabaseFileName: null,
    globalDatabaseFileExists: false,
    globalDatabaseUpdatedAt: null,
    canShowPhysicalPath: false,
  }
}

export async function hasBrowserStorageSelection(): Promise<boolean> {
  const meta = getCurrentStorageFileMeta()
  if (!meta) return false
  return meta.mainLabel !== null
}

export async function verifyHandlePermission(handle: unknown, prompt = false): Promise<boolean> {
  if (!handle || typeof handle !== 'object') return false
  const fileHandle = handle as any
  if (typeof fileHandle.queryPermission !== 'function') {
    return true
  }
  
  try {
    let state = await fileHandle.queryPermission({ mode: 'readwrite' })
    if (state === 'prompt' && prompt) {
      state = await fileHandle.requestPermission({ mode: 'readwrite' })
    }
    return state === 'granted'
  } catch (error) {
    console.error('Failed to verify file permission handle:', error)
    return false
  }
}

export async function getCurrentBrowserDatabaseConfig(): Promise<DatabaseConfigState> {
  const meta = getCurrentStorageFileMeta()
  if (!meta) {
    return createEmptyBrowserConfig()
  }

  const mainHandle = await loadCurrentMainDbFileHandle()
  const globalHandle = await loadCurrentGlobalDbFileHandle()

  const mainHasPermission = await verifyHandlePermission(mainHandle, false)
  const globalHasPermission = await verifyHandlePermission(globalHandle, false)

  let mainSize: number | null = null
  let mainMtime: string | null = null
  if (mainHandle && mainHasPermission) {
    try {
      const file = await (mainHandle as { getFile: () => Promise<File> }).getFile()
      mainSize = file.size
      mainMtime = new Date(file.lastModified).toISOString()
    } catch {}
  }

  let globalSize: number | null = null
  let globalMtime: string | null = null
  if (globalHandle && globalHasPermission) {
    try {
      const file = await (globalHandle as { getFile: () => Promise<File> }).getFile()
      globalSize = file.size
      globalMtime = new Date(file.lastModified).toISOString()
    } catch {}
  }

  const configObj: DatabaseFileSelectionConfig = {
    version: 2,
    backend: 'browser-file',
    mainDatabase: {
      label: '主业务库',
      fileName: meta.mainFileName || 'pave.db',
      absolutePath: null,
      virtualPath: meta.mainFileName || 'pave.db',
    },
    globalDatabase: {
      label: '全局资产库',
      fileName: meta.globalFileName || 'global-assets.db',
      absolutePath: null,
      virtualPath: meta.globalFileName || 'global-assets.db',
    },
    updatedAt: meta.lastSelectedAt,
  }

  return {
    config: configObj,
    storageKind: 'browser-file',
    mainDatabaseFilePath: meta.mainFileName || 'pave.db',
    mainDatabaseFileName: meta.mainFileName || 'pave.db',
    mainDatabaseFileExists: mainHandle !== null,
    mainDatabaseUpdatedAt: mainMtime,
    globalDatabaseFilePath: meta.globalFileName || 'global-assets.db',
    globalDatabaseFileName: meta.globalFileName || 'global-assets.db',
    globalDatabaseFileExists: globalHandle !== null,
    globalDatabaseUpdatedAt: globalMtime,
    canShowPhysicalPath: false,

    // Legacy fields
    customDatabaseRoot: meta.mainLabel,
    currentDatabaseRoot: meta.mainLabel || '',
    databaseFilePath: meta.mainFileName || 'pave.db',
    backupsPath: null,
    databaseFileExists: mainHandle !== null,
    backupsDirExists: false,
    databaseFileName: meta.mainFileName || 'pave.db',
    databaseFileSize: mainSize,
    databaseUpdatedAt: mainMtime,
    globalDatabaseFileSize: globalSize,
    lastSelectedAt: meta.lastSelectedAt,
  }
}

export async function readCurrentBrowserDatabaseFile(prompt = true): Promise<Uint8Array | null> {
  const mainHandle = await loadCurrentMainDbFileHandle()
  if (!mainHandle) return null

  const isGranted = await verifyHandlePermission(mainHandle, prompt)
  if (!isGranted) {
    throw new Error('未获得主业务库文件的读写授权')
  }

  return await readFileBytes(mainHandle as FileHandleLike)
}

export async function writeCurrentBrowserDatabaseFile(data: Uint8Array): Promise<void> {
  const mainHandle = await loadCurrentMainDbFileHandle()
  if (!mainHandle) {
    throw new Error('主业务库文件未接入，请在数据中心选择文件')
  }

  const isGranted = await verifyHandlePermission(mainHandle, true)
  if (!isGranted) {
    throw new Error('未获得主业务库文件的读写授权')
  }

  await writeFileBytes(mainHandle as FileHandleLike, data)
}

export async function readCurrentBrowserGlobalDatabaseFile(prompt = true): Promise<Uint8Array | null> {
  const globalHandle = await loadCurrentGlobalDbFileHandle()
  if (!globalHandle) return null

  const isGranted = await verifyHandlePermission(globalHandle, prompt)
  if (!isGranted) {
    throw new Error('未获得全局资产库文件的读写授权')
  }

  return await readFileBytes(globalHandle as FileHandleLike)
}

export async function writeCurrentBrowserGlobalDatabaseFile(data: Uint8Array): Promise<void> {
  const globalHandle = await loadCurrentGlobalDbFileHandle()
  if (!globalHandle) {
    throw new Error('全局资产库文件未接入，请在数据中心选择文件')
  }

  const isGranted = await verifyHandlePermission(globalHandle, true)
  if (!isGranted) {
    throw new Error('未获得全局资产库文件的读写授权')
  }

  await writeFileBytes(globalHandle as FileHandleLike, data)
}

export async function connectMainDatabaseFile(handle: unknown, label: string): Promise<void> {
  await saveCurrentMainDbFileHandle(handle, label)
}

export async function connectGlobalDatabaseFile(handle: unknown, label: string): Promise<void> {
  await saveCurrentGlobalDbFileHandle(handle, label)
}

export async function clearMainDatabaseFile(): Promise<void> {
  await clearCurrentMainDbFileHandle()
}

export async function clearGlobalDatabaseFile(): Promise<void> {
  await clearCurrentGlobalDbFileHandle()
}

// Dummy/empty implementations of deprecated backups/directory APIs to prevent TypeScript errors
export async function createCurrentBrowserDatabaseBackup(name: string, data: Uint8Array) {
  return { id: 'dummy', name, createdAt: new Date().toISOString(), size: data.length }
}
export async function deleteCurrentBrowserDatabaseBackup(id: string) {}
export async function listCurrentBrowserDatabaseBackups() { return [] }
export async function restoreCurrentBrowserDatabaseFromBackup(id: string) {}

export async function inspectBrowserStorageDirectory(handle: unknown) {
  return { label: 'deprecated', hasDatabase: false, databaseFileName: 'pave.db', databaseFileSize: 0, databaseUpdatedAt: null, backupCount: 0 }
}
export async function useBrowserStorageDirectory(handle: unknown) {}
export async function overwriteBrowserStorageDirectoryWithDatabase(handle: unknown, data: Uint8Array, globalData?: Uint8Array) {}
export async function prepareEmptyBrowserStorageDirectory(handle: unknown) {}
