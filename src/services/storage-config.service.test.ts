import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCurrentStorageDirectorySelection,
  getCurrentStorageDirectoryMeta,
  hasStoredStorageDirectorySelection,
  loadCurrentStorageDirectoryHandle,
  saveCurrentStorageDirectoryHandle,
} from './storage-config.service'

function createFakeIndexedDb() {
  const records = new Map<string, unknown>()
  let storeCreated = false

  function createRequest<T>(transaction: {
    oncomplete?: (() => void) | null
    onerror?: (() => void) | null
    onabort?: (() => void) | null
  }, operation: () => T) {
    const request: {
      result?: T
      error: Error | null
      onsuccess?: (() => void) | null
      onerror?: (() => void) | null
    } = {
      error: null,
      onsuccess: null,
      onerror: null,
    }

    queueMicrotask(() => {
      try {
        request.result = operation()
        request.onsuccess?.()
        transaction.oncomplete?.()
      } catch (error) {
        request.error = error instanceof Error ? error : new Error(String(error))
        request.onerror?.()
        transaction.onerror?.()
      }
    })

    return request
  }

  return {
    open: vi.fn(() => {
      const request: {
        result?: {
          objectStoreNames: { contains: (name: string) => boolean }
          createObjectStore: (name: string) => void
          transaction: (name: string, mode: IDBTransactionMode) => {
            error: Error | null
            oncomplete?: (() => void) | null
            onerror?: (() => void) | null
            onabort?: (() => void) | null
            objectStore: (storeName: string) => {
              put: (value: unknown, key: string) => unknown
              get: (key: string) => unknown
              delete: (key: string) => unknown
            }
          }
          close: () => void
        }
        error: Error | null
        onsuccess?: (() => void) | null
        onerror?: (() => void) | null
        onupgradeneeded?: (() => void) | null
      } = {
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      }

      const database = {
        objectStoreNames: {
          contains: (name: string) => storeCreated && name === 'handles',
        },
        createObjectStore: (_name: string) => {
          storeCreated = true
        },
        transaction: (_name: string, _mode: IDBTransactionMode) => {
          const transaction = {
            error: null,
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: (_storeName: string) => ({
              put: (value: unknown, key: string) => createRequest(transaction, () => {
                records.set(key, value)
                return undefined
              }),
              get: (key: string) => createRequest(transaction, () => records.get(key)),
              delete: (key: string) => createRequest(transaction, () => {
                records.delete(key)
                return undefined
              }),
            }),
          }

          return transaction
        },
        close: vi.fn(),
      }

      queueMicrotask(() => {
        request.result = database
        if (!storeCreated) {
          request.onupgradeneeded?.()
        }
        request.onsuccess?.()
      })

      return request
    }),
  }
}

describe('storage-config.service', () => {
  beforeEach(async () => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.stubGlobal('indexedDB', createFakeIndexedDb())
    await clearCurrentStorageDirectorySelection()
  })

  it('stores meta and handle for current browser directory', async () => {
    const handle = { name: '浏览器文件夹A' }

    const meta = await saveCurrentStorageDirectoryHandle(handle, '浏览器文件夹A')
    const loadedHandle = await loadCurrentStorageDirectoryHandle()

    expect(meta.label).toBe('浏览器文件夹A')
    expect(meta.storageKind).toBe('browser-directory')
    expect(getCurrentStorageDirectoryMeta()).toEqual(meta)
    expect(hasStoredStorageDirectorySelection()).toBe(true)
    expect(loadedHandle).toEqual(handle)
  })

  it('clears stored browser directory selection completely', async () => {
    await saveCurrentStorageDirectoryHandle({ name: '浏览器文件夹B' }, '浏览器文件夹B')
    expect(hasStoredStorageDirectorySelection()).toBe(true)

    await clearCurrentStorageDirectorySelection()

    expect(getCurrentStorageDirectoryMeta()).toBeNull()
    expect(hasStoredStorageDirectorySelection()).toBe(false)
    await expect(loadCurrentStorageDirectoryHandle()).resolves.toBeNull()
  })

  it('returns null handle gracefully when indexedDB is unavailable', async () => {
    vi.unstubAllGlobals()

    await expect(loadCurrentStorageDirectoryHandle()).resolves.toBeNull()
    expect(getCurrentStorageDirectoryMeta()).toBeNull()
    expect(hasStoredStorageDirectorySelection()).toBe(false)
  })
})
