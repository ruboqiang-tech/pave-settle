import { getErrorMessage } from '@/utils/error'

export type BrowserDirectoryPermissionState = PermissionState | 'unsupported'

type DirectoryPermissionMode = 'read' | 'readwrite'

interface DirectoryHandleLike {
  name: string
  queryPermission?: (descriptor?: { mode?: DirectoryPermissionMode }) => Promise<PermissionState>
  requestPermission?: (descriptor?: { mode?: DirectoryPermissionMode }) => Promise<PermissionState>
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?: (options?: { mode?: DirectoryPermissionMode }) => Promise<unknown>
}

function resolveDirectoryHandle(handle: unknown): DirectoryHandleLike {
  if (!handle || typeof handle !== 'object') {
    throw new Error('当前文件夹访问句柄不可用，请重新选择文件夹')
  }
  return handle as DirectoryHandleLike
}

export function isDirectoryPickerAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function getBrowserDirectoryLabel(handle: unknown): string {
  try {
    const directoryHandle = resolveDirectoryHandle(handle)
    return directoryHandle.name?.trim() || '已选中文件夹'
  } catch {
    return '已选中文件夹'
  }
}

export function isBrowserDirectoryPickerSupported(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === 'function'
}

export function normalizeBrowserDirectoryError(error: unknown, fallback: string): string {
  if (isDirectoryPickerAbortError(error)) return '已取消选择文件夹'
  const message = getErrorMessage(error, fallback).trim()
  if (/permission|denied|notallowed/i.test(message)) {
    return '当前文件夹访问权限不足，请重新授权后再试'
  }
  return message || fallback
}

export function isStaleBrowserDirectoryHandleError(error: unknown): boolean {
  const message = getErrorMessage(error, '').toLowerCase()
  return /cached in an interface object|state had changed since it was read from disk|invalidstateerror|notreadableerror/.test(message)
}

export async function ensureBrowserDirectoryPermission(
  handle: unknown,
  mode: DirectoryPermissionMode = 'readwrite',
): Promise<BrowserDirectoryPermissionState> {
  const directoryHandle = resolveDirectoryHandle(handle)
  if (typeof directoryHandle.queryPermission !== 'function' && typeof directoryHandle.requestPermission !== 'function') {
    return 'unsupported'
  }

  const descriptor = { mode }
  if (typeof directoryHandle.queryPermission === 'function') {
    const current = await directoryHandle.queryPermission(descriptor)
    if (current === 'granted') return current
  }

  if (typeof directoryHandle.requestPermission === 'function') {
    return directoryHandle.requestPermission(descriptor)
  }

  return 'unsupported'
}

export async function pickBrowserDirectory(): Promise<{ handle: unknown; label: string }> {
  if (!isBrowserDirectoryPickerSupported()) {
    throw new Error('当前浏览器不支持选择文件夹，请使用最新版 Chromium 内核浏览器')
  }

  try {
    const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker
    const handle = await picker?.({ mode: 'readwrite' })
    if (!handle) {
      throw new Error('未获取到文件夹访问句柄')
    }

    const permission = await ensureBrowserDirectoryPermission(handle, 'readwrite')
    if (permission === 'denied') {
      throw new Error('当前文件夹访问权限不足，请重新授权后再试')
    }

    return {
      handle,
      label: getBrowserDirectoryLabel(handle),
    }
  } catch (error) {
    if (isDirectoryPickerAbortError(error)) {
      throw error
    }
    throw new Error(normalizeBrowserDirectoryError(error, '选择文件夹失败'))
  }
}

interface WindowWithFilePicker extends Window {
  showOpenFilePicker?: (options?: unknown) => Promise<unknown[]>
}

export function isBrowserFilePickerSupported(): boolean {
  if (typeof window === 'undefined') return false
  return typeof (window as WindowWithFilePicker).showOpenFilePicker === 'function'
}

export async function pickBrowserFile(): Promise<{ handle: unknown; name: string }> {
  if (!isBrowserFilePickerSupported()) {
    throw new Error('当前浏览器不支持选择文件，请使用最新版 Chromium 内核浏览器')
  }

  try {
    const picker = (window as WindowWithFilePicker).showOpenFilePicker
    const handles = await picker?.({
      multiple: false,
      types: [{
        description: 'SQLite 数据库文件',
        accept: { 'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'] }
      }]
    })
    
    if (!handles || handles.length === 0) {
      throw new Error('未选择任何文件')
    }
    
    const handle = handles[0] as { name: string }
    return {
      handle,
      name: handle.name,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new Error(getErrorMessage(error, '选择文件失败'))
  }
}
