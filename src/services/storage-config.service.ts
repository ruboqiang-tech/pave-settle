const STORAGE_META_KEY = 'settlement_storage_directory_meta_v1'
const HANDLE_DB_NAME = 'settlement-storage-directory-handles'
const HANDLE_STORE_NAME = 'handles'
const CURRENT_HANDLE_KEY = 'current-storage-directory'

export interface StorageDirectoryMeta {
  label: string
  lastSelectedAt: string
  storageKind: 'browser-directory'
}

function isIndexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbSupported()) {
      reject(new Error('当前浏览器不支持目录句柄持久化'))
      return
    }

    const request = indexedDB.open(HANDLE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        database.createObjectStore(HANDLE_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打开目录句柄存储失败'))
  })
}

async function withHandleStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openHandleDatabase()

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(HANDLE_STORE_NAME, mode)
    const store = transaction.objectStore(HANDLE_STORE_NAME)
    const request = operation(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('目录句柄存储操作失败'))
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('目录句柄事务失败'))
    }
    transaction.onabort = () => {
      database.close()
      reject(transaction.error ?? new Error('目录句柄事务已中止'))
    }
  })
}

function readStorageMeta(): StorageDirectoryMeta | null {
  if (typeof localStorage === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_META_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StorageDirectoryMeta>
    if (!parsed || typeof parsed.label !== 'string' || typeof parsed.lastSelectedAt !== 'string') {
      return null
    }

    return {
      label: parsed.label,
      lastSelectedAt: parsed.lastSelectedAt,
      storageKind: 'browser-directory',
    }
  } catch {
    return null
  }
}

function writeStorageMeta(meta: StorageDirectoryMeta): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta))
}

export function getCurrentStorageDirectoryMeta(): StorageDirectoryMeta | null {
  return readStorageMeta()
}

export function hasStoredStorageDirectorySelection(): boolean {
  return getCurrentStorageDirectoryMeta() !== null
}

export async function saveCurrentStorageDirectoryHandle(handle: unknown, label: string): Promise<StorageDirectoryMeta> {
  const meta: StorageDirectoryMeta = {
    label,
    lastSelectedAt: new Date().toISOString(),
    storageKind: 'browser-directory',
  }

  writeStorageMeta(meta)
  await withHandleStore('readwrite', store => store.put(handle, CURRENT_HANDLE_KEY))
  return meta
}

export async function loadCurrentStorageDirectoryHandle(): Promise<unknown | null> {
  if (!isIndexedDbSupported()) return null

  try {
    const result = await withHandleStore<unknown>('readonly', store => store.get(CURRENT_HANDLE_KEY))
    return result ?? null
  } catch {
    return null
  }
}

export async function clearCurrentStorageDirectorySelection(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_META_KEY)
  }

  if (!isIndexedDbSupported()) return

  try {
    await withHandleStore('readwrite', store => store.delete(CURRENT_HANDLE_KEY))
  } catch {
    // 忽略句柄清理失败，避免影响主流程
  }
}

const MAIN_HANDLE_KEY = 'current-main-db-file'
const GLOBAL_HANDLE_KEY = 'current-global-db-file'
const FILE_META_KEY = 'settlement_storage_file_meta_v2'

export interface StorageFileMeta {
  mainLabel: string | null
  globalLabel: string | null
  mainFileName: string | null
  globalFileName: string | null
  lastSelectedAt: string
  storageKind: 'browser-file'
}

export function getCurrentStorageFileMeta(): StorageFileMeta | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(FILE_META_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StorageFileMeta
  } catch {
    return null
  }
}

export function writeStorageFileMeta(meta: StorageFileMeta): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(FILE_META_KEY, JSON.stringify(meta))
}

export async function saveCurrentMainDbFileHandle(handle: unknown, label: string): Promise<StorageFileMeta> {
  const currentMeta = getCurrentStorageFileMeta() || {
    mainLabel: null,
    globalLabel: null,
    mainFileName: null,
    globalFileName: null,
    lastSelectedAt: new Date().toISOString(),
    storageKind: 'browser-file',
  }
  
  const updatedMeta: StorageFileMeta = {
    ...currentMeta,
    mainLabel: label,
    mainFileName: label,
    lastSelectedAt: new Date().toISOString(),
    storageKind: 'browser-file',
  }
  
  writeStorageFileMeta(updatedMeta)
  await withHandleStore('readwrite', store => store.put(handle, MAIN_HANDLE_KEY))
  return updatedMeta
}

export async function loadCurrentMainDbFileHandle(): Promise<unknown | null> {
  if (!isIndexedDbSupported()) return null
  try {
    const result = await withHandleStore<unknown>('readonly', store => store.get(MAIN_HANDLE_KEY))
    return result ?? null
  } catch {
    return null
  }
}

export async function clearCurrentMainDbFileHandle(): Promise<void> {
  const currentMeta = getCurrentStorageFileMeta()
  if (currentMeta) {
    currentMeta.mainLabel = null
    currentMeta.mainFileName = null
    currentMeta.lastSelectedAt = new Date().toISOString()
    writeStorageFileMeta(currentMeta)
  }
  if (!isIndexedDbSupported()) return
  try {
    await withHandleStore('readwrite', store => store.delete(MAIN_HANDLE_KEY))
  } catch {}
}

export async function saveCurrentGlobalDbFileHandle(handle: unknown, label: string): Promise<StorageFileMeta> {
  const currentMeta = getCurrentStorageFileMeta() || {
    mainLabel: null,
    globalLabel: null,
    mainFileName: null,
    globalFileName: null,
    lastSelectedAt: new Date().toISOString(),
    storageKind: 'browser-file',
  }
  
  const updatedMeta: StorageFileMeta = {
    ...currentMeta,
    globalLabel: label,
    globalFileName: label,
    lastSelectedAt: new Date().toISOString(),
    storageKind: 'browser-file',
  }
  
  writeStorageFileMeta(updatedMeta)
  await withHandleStore('readwrite', store => store.put(handle, GLOBAL_HANDLE_KEY))
  return updatedMeta
}

export async function loadCurrentGlobalDbFileHandle(): Promise<unknown | null> {
  if (!isIndexedDbSupported()) return null
  try {
    const result = await withHandleStore<unknown>('readonly', store => store.get(GLOBAL_HANDLE_KEY))
    return result ?? null
  } catch {
    return null
  }
}

export async function clearCurrentGlobalDbFileHandle(): Promise<void> {
  const currentMeta = getCurrentStorageFileMeta()
  if (currentMeta) {
    currentMeta.globalLabel = null
    currentMeta.globalFileName = null
    currentMeta.lastSelectedAt = new Date().toISOString()
    writeStorageFileMeta(currentMeta)
  }
  if (!isIndexedDbSupported()) return
  try {
    await withHandleStore('readwrite', store => store.delete(GLOBAL_HANDLE_KEY))
  } catch {}
}
