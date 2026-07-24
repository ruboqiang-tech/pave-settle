export const DATABASE_FILE_NAME = 'pave.db'
export const BACKUPS_DIR_NAME = 'backups'
export const BACKUP_META_FILE_NAME = 'backup.meta.json'
export const BACKUP_SCHEMA_VERSION = '5'

export interface DirectoryHandleLike {
  kind?: string
  name: string
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<unknown>
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<unknown>
  entries?: () => AsyncIterable<[string, unknown]>
  values?: () => AsyncIterable<unknown>
  removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>
}

export interface FileHandleLike {
  kind?: string
  name: string
  getFile: () => Promise<File>
  createWritable: () => Promise<{
    write: (data: BufferSource | Blob | string) => Promise<void>
    close: () => Promise<void>
  }>
}

export function resolveDirectoryHandle(handle: unknown): DirectoryHandleLike {
  if (!handle || typeof handle !== 'object') {
    throw new Error('当前文件夹访问句柄不可用，请重新选择文件夹')
  }

  const directoryHandle = handle as Partial<DirectoryHandleLike>
  if (typeof directoryHandle.getFileHandle !== 'function' || typeof directoryHandle.getDirectoryHandle !== 'function') {
    throw new Error('当前文件夹访问句柄不可用，请重新选择文件夹')
  }

  return directoryHandle as DirectoryHandleLike
}

export function resolveFileHandle(handle: unknown): FileHandleLike {
  if (!handle || typeof handle !== 'object') {
    throw new Error('当前数据库文件句柄不可用')
  }

  const fileHandle = handle as Partial<FileHandleLike>
  if (typeof fileHandle.getFile !== 'function' || typeof fileHandle.createWritable !== 'function') {
    throw new Error('当前数据库文件句柄不可用')
  }

  return fileHandle as FileHandleLike
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function getVirtualFilePath(label: string, fileName: string): string {
  const safeLabel = label.trim() || '已选中文件夹'
  return `${safeLabel}/${fileName}`
}

export async function getOptionalDirectoryHandle(
  parent: DirectoryHandleLike,
  directoryName: string,
): Promise<DirectoryHandleLike | null> {
  try {
    const handle = await parent.getDirectoryHandle(directoryName)
    return resolveDirectoryHandle(handle)
  } catch (error) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

export async function ensureDirectoryHandle(
  parent: DirectoryHandleLike,
  directoryName: string,
): Promise<DirectoryHandleLike> {
  const handle = await parent.getDirectoryHandle(directoryName, { create: true })
  return resolveDirectoryHandle(handle)
}

export async function getOptionalFileHandle(
  parent: DirectoryHandleLike,
  fileName: string,
): Promise<FileHandleLike | null> {
  try {
    const handle = await parent.getFileHandle(fileName)
    return resolveFileHandle(handle)
  } catch (error) {
    if (isNotFoundError(error)) return null
    throw error
  }
}

export async function ensureFileHandle(
  parent: DirectoryHandleLike,
  fileName: string,
): Promise<FileHandleLike> {
  const handle = await parent.getFileHandle(fileName, { create: true })
  return resolveFileHandle(handle)
}

export async function readFileBytes(fileHandle: FileHandleLike): Promise<Uint8Array> {
  const file = await fileHandle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

export async function readFileText(fileHandle: FileHandleLike): Promise<string> {
  const file = await fileHandle.getFile()
  return await file.text()
}

export async function writeFileBytes(fileHandle: FileHandleLike, data: Uint8Array): Promise<void> {
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
}

export async function writeFileText(fileHandle: FileHandleLike, data: string): Promise<void> {
  const writable = await fileHandle.createWritable()
  await writable.write(data)
  await writable.close()
}

export async function getDirectoryEntries(directoryHandle: DirectoryHandleLike): Promise<Array<[string, unknown]>> {
  const entries: Array<[string, unknown]> = []
  if (typeof directoryHandle.entries === 'function') {
    for await (const entry of directoryHandle.entries()) {
      entries.push(entry)
    }
    return entries
  }

  if (typeof directoryHandle.values === 'function') {
    for await (const handle of directoryHandle.values()) {
      const entryHandle = handle as { name?: string }
      entries.push([entryHandle.name ?? '', handle])
    }
  }

  return entries
}

export async function getDirectorySize(directoryHandle: DirectoryHandleLike): Promise<number> {
  const entries = await getDirectoryEntries(directoryHandle)
  let total = 0

  for (const [, entry] of entries) {
    const typedEntry = entry as { kind?: string }
    if (typedEntry.kind === 'directory') {
      total += await getDirectorySize(resolveDirectoryHandle(entry))
      continue
    }

    try {
      const file = await resolveFileHandle(entry).getFile()
      total += file.size
    } catch {
      // 忽略单个文件读取失败，避免阻塞备份列表展示
    }
  }

  return total
}
