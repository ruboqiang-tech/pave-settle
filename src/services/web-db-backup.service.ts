import type { DatabaseBackupMeta } from './database-storage.types'
import { normalizeBrowserDirectoryError } from './browser-directory-access.service'
import { getCurrentStorageDirectoryMeta } from './storage-config.service'
import { resolveCurrentDirectoryHandle } from './web-db-storage-context.service'
import {
  BACKUP_META_FILE_NAME,
  BACKUP_SCHEMA_VERSION,
  BACKUPS_DIR_NAME,
  DATABASE_FILE_NAME,
  ensureDirectoryHandle,
  ensureFileHandle,
  getDirectoryEntries,
  getDirectorySize,
  getOptionalDirectoryHandle,
  getOptionalFileHandle,
  getVirtualFilePath,
  readFileBytes,
  readFileText,
  resolveDirectoryHandle,
  type DirectoryHandleLike,
  writeFileBytes,
  writeFileText,
} from './web-file-system.service'

interface BackupManifest {
  id: string
  name: string
  createdAt: string
  size: number
  source: 'web' | 'unknown'
  databaseFilePath: string | null
  databaseRoot: string | null
  schemaVersion: string
}

function buildBackupId(name: string): string {
  const safeName = name.trim().replace(/[\\/:*?"<>|]/g, '_') || '未命名备份'
  return `${Date.now()}__${safeName}`
}

function parseBackupId(backupId: string): { createdAt: string; name: string } {
  const [createdAt = new Date().toISOString(), ...nameParts] = backupId.split('__')
  return {
    createdAt,
    name: nameParts.join('__') || '未命名备份',
  }
}

function parseBackupTimestamp(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  if (/^\d+$/.test(trimmed)) {
    const numericValue = Number(trimmed)
    if (!Number.isFinite(numericValue)) return null
    return trimmed.length <= 10 ? numericValue * 1000 : numericValue
  }

  const parsed = Date.parse(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function getBackupSortTime(backup: Pick<DatabaseBackupMeta, 'id' | 'createdAt'>): number {
  return parseBackupTimestamp(backup.createdAt)
    ?? parseBackupTimestamp(parseBackupId(backup.id).createdAt)
    ?? 0
}

async function readBackupManifest(backupDirectory: DirectoryHandleLike): Promise<BackupManifest | null> {
  const manifestHandle = await getOptionalFileHandle(backupDirectory, BACKUP_META_FILE_NAME)
  if (!manifestHandle) return null

  try {
    const parsed = JSON.parse(await readFileText(manifestHandle)) as Partial<BackupManifest>
    if (!parsed.id || !parsed.name || !parsed.createdAt) {
      return null
    }

    return {
      id: String(parsed.id),
      name: String(parsed.name),
      createdAt: String(parsed.createdAt),
      size: Number(parsed.size ?? 0),
      source: parsed.source === 'web' ? 'web' : 'unknown',
      databaseFilePath: typeof parsed.databaseFilePath === 'string' ? parsed.databaseFilePath : null,
      databaseRoot: typeof parsed.databaseRoot === 'string' ? parsed.databaseRoot : null,
      schemaVersion: typeof parsed.schemaVersion === 'string' ? parsed.schemaVersion : BACKUP_SCHEMA_VERSION,
    }
  } catch {
    return null
  }
}

async function writeBackupManifest(
  backupDirectory: DirectoryHandleLike,
  manifest: BackupManifest,
): Promise<void> {
  const manifestHandle = await ensureFileHandle(backupDirectory, BACKUP_META_FILE_NAME)
  await writeFileText(manifestHandle, JSON.stringify(manifest, null, 2))
}

async function buildBackupMetaFromDirectory(
  rootLabel: string,
  backupDirectory: DirectoryHandleLike,
): Promise<DatabaseBackupMeta | null> {
  const backupId = backupDirectory.name
  const fallback = parseBackupId(backupId)
  const manifest = await readBackupManifest(backupDirectory)
  const databaseFileHandle = await getOptionalFileHandle(backupDirectory, DATABASE_FILE_NAME)
  const databaseFile = databaseFileHandle ? await databaseFileHandle.getFile() : null
  if (!databaseFile) return null

  return {
    id: manifest?.id ?? backupId,
    name: manifest?.name ?? fallback.name,
    createdAt: manifest?.createdAt ?? fallback.createdAt,
    size: manifest?.size ?? await getDirectorySize(backupDirectory),
    source: manifest?.source ?? 'web',
    databaseFilePath: getVirtualFilePath(`${rootLabel}/${BACKUPS_DIR_NAME}/${backupDirectory.name}`, DATABASE_FILE_NAME),
    databaseRoot: `${rootLabel}/${BACKUPS_DIR_NAME}/${backupDirectory.name}`,
    schemaVersion: manifest?.schemaVersion ?? BACKUP_SCHEMA_VERSION,
  }
}

export async function listBackupsInDirectory(
  backupsDirectory: DirectoryHandleLike,
  rootLabel: string,
): Promise<DatabaseBackupMeta[]> {
  const entries = await getDirectoryEntries(backupsDirectory)
  const backups = await Promise.all(entries.map(async ([, entry]) => {
    const typedEntry = entry as { kind?: string }
    if (typedEntry.kind !== 'directory') return null
    return buildBackupMetaFromDirectory(rootLabel, resolveDirectoryHandle(entry))
  }))

  return backups
    .filter((item): item is DatabaseBackupMeta => item !== null)
    .sort((left, right) => getBackupSortTime(right) - getBackupSortTime(left))
}

async function findBackupDirectory(
  backupsHandle: DirectoryHandleLike,
  backupId: string,
): Promise<DirectoryHandleLike | null> {
  const target = await getOptionalDirectoryHandle(backupsHandle, backupId)
  if (target) return target

  const entries = await getDirectoryEntries(backupsHandle)
  for (const [, entry] of entries) {
    const typedEntry = entry as { kind?: string }
    if (typedEntry.kind !== 'directory') continue
    const directoryHandle = resolveDirectoryHandle(entry)
    const manifest = await readBackupManifest(directoryHandle)
    if (manifest?.id === backupId) {
      return directoryHandle
    }
  }

  return null
}

export async function listCurrentBrowserDatabaseBackups(): Promise<DatabaseBackupMeta[]> {
  const handle = await resolveCurrentDirectoryHandle()
  const meta = getCurrentStorageDirectoryMeta()
  if (!handle || !meta) return []

  try {
    const backupsHandle = await getOptionalDirectoryHandle(handle, BACKUPS_DIR_NAME)
    if (!backupsHandle) return []
    return await listBackupsInDirectory(backupsHandle, meta.label)
  } catch (error) {
    throw new Error(normalizeBrowserDirectoryError(error, '读取备份列表失败'))
  }
}

const GLOBAL_DATABASE_FILE_NAME = 'global-assets.db'

export async function createCurrentBrowserDatabaseBackup(name: string, data: Uint8Array): Promise<DatabaseBackupMeta> {
  const handle = await resolveCurrentDirectoryHandle()
  const meta = getCurrentStorageDirectoryMeta()
  if (!handle || !meta) {
    throw new Error('当前还没有可用于备份的数据库存放位置，请先选择文件夹')
  }

  const backupsHandle = await ensureDirectoryHandle(handle, BACKUPS_DIR_NAME)
  const backupId = buildBackupId(name)
  const backupDirectory = await ensureDirectoryHandle(backupsHandle, backupId)
  const databaseFileHandle = await ensureFileHandle(backupDirectory, DATABASE_FILE_NAME)
  await writeFileBytes(databaseFileHandle, data)

  // Copy global database if it exists
  const globalFileHandle = await getOptionalFileHandle(handle, GLOBAL_DATABASE_FILE_NAME)
  if (globalFileHandle) {
    try {
      const globalFile = await globalFileHandle.getFile()
      const globalData = new Uint8Array(await globalFile.arrayBuffer())
      const backupGlobalFileHandle = await ensureFileHandle(backupDirectory, GLOBAL_DATABASE_FILE_NAME)
      await writeFileBytes(backupGlobalFileHandle, globalData)
    } catch (e) {
      console.warn('Failed to copy global database to backup directory', e)
    }
  }

  const backupMeta: BackupManifest = {
    id: backupId,
    name: name.trim() || '未命名备份',
    createdAt: new Date().toISOString(),
    size: await getDirectorySize(backupDirectory),
    source: 'web',
    databaseFilePath: getVirtualFilePath(`${meta.label}/${BACKUPS_DIR_NAME}/${backupId}`, DATABASE_FILE_NAME),
    databaseRoot: `${meta.label}/${BACKUPS_DIR_NAME}/${backupId}`,
    schemaVersion: BACKUP_SCHEMA_VERSION,
  }

  await writeBackupManifest(backupDirectory, backupMeta)

  return backupMeta
}

export async function restoreCurrentBrowserDatabaseFromBackup(backupId: string): Promise<boolean> {
  const handle = await resolveCurrentDirectoryHandle()
  if (!handle) {
    throw new Error('当前没有可恢复的数据库目录，请先选择文件夹')
  }

  const backupsHandle = await getOptionalDirectoryHandle(handle, BACKUPS_DIR_NAME)
  if (!backupsHandle) {
    throw new Error('当前目录下没有可恢复的备份数据库')
  }

  const backupDirectory = await findBackupDirectory(backupsHandle, backupId)
  if (!backupDirectory) {
    throw new Error('未找到目标备份数据库')
  }

  const fileHandle = await getOptionalFileHandle(backupDirectory, DATABASE_FILE_NAME)
  if (!fileHandle) {
    throw new Error('目标备份中未找到数据库文件')
  }

  const data = await readFileBytes(fileHandle)
  const currentDatabaseHandle = await ensureFileHandle(handle, DATABASE_FILE_NAME)
  await writeFileBytes(currentDatabaseHandle, data)
  return true
}

export async function deleteCurrentBrowserDatabaseBackup(backupId: string): Promise<void> {
  const handle = await resolveCurrentDirectoryHandle()
  if (!handle) {
    throw new Error('当前没有可删除备份的数据库目录，请先选择文件夹')
  }

  const backupsHandle = await getOptionalDirectoryHandle(handle, BACKUPS_DIR_NAME)
  if (!backupsHandle) {
    throw new Error('当前没有可删除的数据库备份')
  }

  const backupDirectory = await findBackupDirectory(backupsHandle, backupId)
  if (!backupDirectory) {
    throw new Error('未找到需要删除的数据库备份')
  }

  if (typeof backupsHandle.removeEntry !== 'function') {
    throw new Error('当前浏览器不支持删除已创建的数据库备份')
  }

  await backupsHandle.removeEntry(backupDirectory.name, { recursive: true })
}
