import {
  ensureBrowserDirectoryPermission,
  isStaleBrowserDirectoryHandleError,
} from './browser-directory-access.service'
import {
  loadCurrentStorageDirectoryHandle,
  clearCurrentStorageDirectorySelection,
} from './storage-config.service'
import {
  resolveDirectoryHandle,
  type DirectoryHandleLike,
} from './web-file-system.service'

export async function ensureDirectoryPermission(handle: unknown): Promise<DirectoryHandleLike> {
  const directoryHandle = resolveDirectoryHandle(handle)
  const permission = await ensureBrowserDirectoryPermission(directoryHandle, 'readwrite')
  if (permission === 'denied') {
    throw new Error('当前文件夹访问权限不足，请重新授权后再试')
  }
  return directoryHandle
}

export async function resolveCurrentDirectoryHandle(requirePermission = true): Promise<DirectoryHandleLike | null> {
  const storedHandle = await loadCurrentStorageDirectoryHandle()
  if (!storedHandle) return null

  try {
    if (!requirePermission) {
      return resolveDirectoryHandle(storedHandle)
    }

    return await ensureDirectoryPermission(storedHandle)
  } catch (error) {
    if (isStaleBrowserDirectoryHandleError(error)) {
      await clearCurrentStorageDirectorySelection()
      return null
    }
    throw error
  }
}
