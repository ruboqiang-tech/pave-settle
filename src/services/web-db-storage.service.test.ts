import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  currentMainHandleRef,
  currentGlobalHandleRef,
  currentMetaRef,
  loadCurrentMainDbFileHandleMock,
  loadCurrentGlobalDbFileHandleMock,
  saveCurrentMainDbFileHandleMock,
  saveCurrentGlobalDbFileHandleMock,
  clearCurrentMainDbFileHandleMock,
  clearCurrentGlobalDbFileHandleMock,
} = vi.hoisted(() => ({
  currentMainHandleRef: { current: null as unknown },
  currentGlobalHandleRef: { current: null as unknown },
  currentMetaRef: { current: null as any },
  loadCurrentMainDbFileHandleMock: vi.fn(),
  loadCurrentGlobalDbFileHandleMock: vi.fn(),
  saveCurrentMainDbFileHandleMock: vi.fn(),
  saveCurrentGlobalDbFileHandleMock: vi.fn(),
  clearCurrentMainDbFileHandleMock: vi.fn(),
  clearCurrentGlobalDbFileHandleMock: vi.fn(),
}))

vi.mock('./storage-config.service', () => ({
  getCurrentStorageFileMeta: () => currentMetaRef.current,
  loadCurrentMainDbFileHandle: loadCurrentMainDbFileHandleMock,
  loadCurrentGlobalDbFileHandle: loadCurrentGlobalDbFileHandleMock,
  saveCurrentMainDbFileHandle: saveCurrentMainDbFileHandleMock,
  saveCurrentGlobalDbFileHandle: saveCurrentGlobalDbFileHandleMock,
  clearCurrentMainDbFileHandle: clearCurrentMainDbFileHandleMock,
  clearCurrentGlobalDbFileHandle: clearCurrentGlobalDbFileHandleMock,
}))

import {
  getCurrentBrowserDatabaseConfig,
  readCurrentBrowserDatabaseFile,
  writeCurrentBrowserDatabaseFile,
  readCurrentBrowserGlobalDatabaseFile,
  writeCurrentBrowserGlobalDatabaseFile,
} from './web-db-storage.service'

class MemoryFileHandle {
  kind = 'file' as const
  lastModified = Date.now()

  constructor(public name: string, private bytes = new Uint8Array()) {}

  async getFile() {
    const snapshot = new Uint8Array(this.bytes)
    return {
      size: snapshot.byteLength,
      lastModified: this.lastModified,
      arrayBuffer: async () => snapshot.buffer.slice(snapshot.byteOffset, snapshot.byteOffset + snapshot.byteLength),
    }
  }

  async createWritable() {
    return {
      write: async (data: any) => {
        if (data instanceof ArrayBuffer) {
          this.bytes = new Uint8Array(data)
        } else {
          this.bytes = new Uint8Array(data)
        }
        this.lastModified = Date.now()
      },
      close: async () => undefined,
    }
  }
}

describe('web-db-storage.service browser-file slot tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentMainHandleRef.current = null
    currentGlobalHandleRef.current = null
    currentMetaRef.current = null

    loadCurrentMainDbFileHandleMock.mockImplementation(async () => currentMainHandleRef.current)
    loadCurrentGlobalDbFileHandleMock.mockImplementation(async () => currentGlobalHandleRef.current)
  })

  it('returns empty browser config when no file handles are saved', async () => {
    const config = await getCurrentBrowserDatabaseConfig()
    expect(config.mainDatabaseFileExists).toBe(false)
    expect(config.globalDatabaseFileExists).toBe(false)
    expect(config.storageKind).toBe('browser-file')
  })

  it('reads status correctly when only main file handle is present', async () => {
    const mockMain = new MemoryFileHandle('pave.db', new Uint8Array([1, 2, 3]))
    currentMainHandleRef.current = mockMain
    currentMetaRef.current = {
      mainFileName: 'pave.db',
      mainLastSelectedAt: '2026-06-28T12:00:00Z',
    }

    const config = await getCurrentBrowserDatabaseConfig()
    expect(config.mainDatabaseFileExists).toBe(true)
    expect(config.globalDatabaseFileExists).toBe(false)
    expect(config.mainDatabaseFilePath).toBe('pave.db')
    expect(config.databaseFileSize).toBe(3)
  })

  it('reads status correctly when both main and global file handles are present', async () => {
    const mockMain = new MemoryFileHandle('my-pave.db', new Uint8Array([1, 2, 3]))
    const mockGlobal = new MemoryFileHandle('my-global.db', new Uint8Array([4, 5, 6, 7]))
    currentMainHandleRef.current = mockMain
    currentGlobalHandleRef.current = mockGlobal
    currentMetaRef.current = {
      mainFileName: 'my-pave.db',
      mainLastSelectedAt: '2026-06-28T12:00:00Z',
      globalFileName: 'my-global.db',
      globalLastSelectedAt: '2026-06-28T12:05:00Z',
    }

    const config = await getCurrentBrowserDatabaseConfig()
    expect(config.mainDatabaseFileExists).toBe(true)
    expect(config.globalDatabaseFileExists).toBe(true)
    expect(config.mainDatabaseFilePath).toBe('my-pave.db')
    expect(config.globalDatabaseFilePath).toBe('my-global.db')
    expect(config.databaseFileSize).toBe(3)
    expect(config.globalDatabaseFileSize).toBe(4)
  })

  it('reads and writes main database file', async () => {
    const mockMain = new MemoryFileHandle('pave.db', new Uint8Array([10, 20]))
    currentMainHandleRef.current = mockMain
    currentMetaRef.current = { mainFileName: 'pave.db' }

    const content = await readCurrentBrowserDatabaseFile()
    expect(content).toEqual(new Uint8Array([10, 20]))

    await writeCurrentBrowserDatabaseFile(new Uint8Array([30, 40, 50]))
    const content2 = await readCurrentBrowserDatabaseFile()
    expect(content2).toEqual(new Uint8Array([30, 40, 50]))
  })

  it('reads and writes global database file', async () => {
    const mockGlobal = new MemoryFileHandle('global.db', new Uint8Array([100]))
    currentGlobalHandleRef.current = mockGlobal
    currentMetaRef.current = { globalFileName: 'global.db' }

    const content = await readCurrentBrowserGlobalDatabaseFile()
    expect(content).toEqual(new Uint8Array([100]))

    await writeCurrentBrowserGlobalDatabaseFile(new Uint8Array([200, 210]))
    const content2 = await readCurrentBrowserGlobalDatabaseFile()
    expect(content2).toEqual(new Uint8Array([200, 210]))
  })
})
