import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  loadCurrentStorageDirectoryHandleMock,
  clearCurrentStorageDirectorySelectionMock,
  ensureBrowserDirectoryPermissionMock,
  isStaleBrowserDirectoryHandleErrorMock,
} = vi.hoisted(() => ({
  loadCurrentStorageDirectoryHandleMock: vi.fn(),
  clearCurrentStorageDirectorySelectionMock: vi.fn(),
  ensureBrowserDirectoryPermissionMock: vi.fn(),
  isStaleBrowserDirectoryHandleErrorMock: vi.fn(),
}))

vi.mock('./storage-config.service', () => ({
  loadCurrentStorageDirectoryHandle: loadCurrentStorageDirectoryHandleMock,
  clearCurrentStorageDirectorySelection: clearCurrentStorageDirectorySelectionMock,
}))

vi.mock('./browser-directory-access.service', () => ({
  ensureBrowserDirectoryPermission: ensureBrowserDirectoryPermissionMock,
  isStaleBrowserDirectoryHandleError: isStaleBrowserDirectoryHandleErrorMock,
}))

import { ensureDirectoryPermission, resolveCurrentDirectoryHandle } from './web-db-storage-context.service'

describe('web-db-storage-context.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears stale directory selection and returns null', async () => {
    const staleError = new Error('An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.')
    loadCurrentStorageDirectoryHandleMock.mockResolvedValue({ name: '旧目录' })
    isStaleBrowserDirectoryHandleErrorMock.mockReturnValue(true)
    ensureBrowserDirectoryPermissionMock.mockRejectedValue(staleError)

    await expect(resolveCurrentDirectoryHandle()).resolves.toBeNull()
    expect(clearCurrentStorageDirectorySelectionMock).toHaveBeenCalledTimes(1)
  })

  it('returns permissioned handle when current directory is healthy', async () => {
    const handle = { name: '正式库', getFileHandle: vi.fn(), getDirectoryHandle: vi.fn() }
    loadCurrentStorageDirectoryHandleMock.mockResolvedValue(handle)
    isStaleBrowserDirectoryHandleErrorMock.mockReturnValue(false)
    ensureBrowserDirectoryPermissionMock.mockResolvedValue(handle)

    await expect(resolveCurrentDirectoryHandle()).resolves.toEqual(handle)
  })

  it('requires a valid directory handle for direct permission checks', async () => {
    const handle = { name: '正式库', getFileHandle: vi.fn(), getDirectoryHandle: vi.fn() }
    ensureBrowserDirectoryPermissionMock.mockResolvedValue(handle)

    await expect(ensureDirectoryPermission(handle)).resolves.toEqual(handle)
  })
})
